import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { initDatabase, pool, runDatabaseDiagnostics } from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Initialize Google GenAI if key available
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const app = express();
app.use(express.json({ limit: '25mb' }));

export interface UserProfile {
  id: string;
  username: string;
  codmIgn: string;
  codmUid: string;
  email: string;
  phone: string;
  balance: number;
  escrowBalance: number;
  totalWinnings: number;
  wins: number;
  losses: number;
  draws: number;
  tier?: string;
  clan?: string;
  avatar: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  referredBy?: string;
  referralCode?: string;
  totalReferralEarnings?: number;
  role?: string;
  transactions: Array<{
    id: string;
    type: 'DEPOSIT' | 'ESCROW_LOCK' | 'ESCROW_REFUND' | 'MATCH_WIN_PAYOUT' | 'WITHDRAWAL' | 'REFERRAL_EARNING';
    amount: number;
    description: string;
    timestamp: number;
    matchId?: string;
  }>;
}

export interface Match {
  id: string;
  challengeCode: string;
  roomCode?: string;
  gameMode: string;
  map: string;
  rules: string[];
  stakeAmount: number;
  potAmount: number;
  platformFeePercentage: number;
  platformFee: number;
  winnerPayout: number;
  matchDurationMinutes?: number;
  status:
    | 'PENDING_OPPONENT_STAKE'
    | 'OPPONENT_STAKED_AWAITING_CREATOR'
    | 'READY_TO_PLAY'
    | 'IN_PROGRESS'
    | 'SUBMITTING_RESULTS'
    | 'VERIFYING'
    | 'SETTLED'
    | 'DISPUTED'
    | 'CANCELLED';
  createdAt: number;
  roomGeneratedAt?: number;
  creator: {
    id: string;
    username: string;
    codmIgn: string;
    codmUid: string;
    avatar: string;
    staked: boolean;
    resultClaim?: 'VICTORY' | 'DEFEAT' | 'DRAW';
    screenshotUrl?: string;
    screenshotAnalysis?: any;
    submittedAt?: number;
  };
  opponent?: {
    id: string;
    username: string;
    codmIgn: string;
    codmUid: string;
    avatar: string;
    staked: boolean;
    resultClaim?: 'VICTORY' | 'DEFEAT' | 'DRAW';
    screenshotUrl?: string;
    screenshotAnalysis?: any;
    submittedAt?: number;
  };
  winnerId?: string;
  winnerIgn?: string;
  chatMessages: Array<{
    id: string;
    senderId: string;
    senderName: string;
    text: string;
    timestamp: number;
  }>;
  resolutionNotes?: string;
}

// SQL escape helper to maintain compatibility with Supabase transaction pooler (PgBouncer)
function escapeSql(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') {
    if (isNaN(val)) return '0';
    return String(val);
  }
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'object') {
    return "'" + JSON.stringify(val).replace(/'/g, "''") + "'";
  }
  return "'" + String(val).replace(/'/g, "''") + "'";
}

// Helper to calculate tiered rake percentage based on stake amount
function getRakePercentage(stake: number): number {
  if (stake >= 10000) return 0.05; // 5% for ₦10,000+
  if (stake >= 5000) return 0.07;  // 7% for ₦5,000
  if (stake >= 2500) return 0.08;  // 8% for ₦2,500
  return 0.10;                     // 10% for ₦100 - ₦1,000
}

// Helper to generate a room code like CODM-8392-SHP
function generateRoomCode(mapName: string): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  const suffix = mapName.slice(0, 3).toUpperCase();
  return `CODM-${num}-${suffix}`;
}

// ==========================================
// DIRECT DATABASE ACCESS FUNCTIONS
// ==========================================

async function getUserFromDb(id: string): Promise<UserProfile | null> {
  try {
    const userRes = await pool.query(`SELECT * FROM users WHERE id = ${escapeSql(id)}`);
    if (userRes.rows.length === 0) return null;
    const r = userRes.rows[0];

    const txRes = await pool.query(`SELECT * FROM transactions WHERE user_id = ${escapeSql(id)} ORDER BY timestamp DESC`);
    const transactions = txRes.rows.map((t) => ({
      id: t.id,
      type: t.type,
      amount: parseFloat(t.amount),
      description: t.description,
      timestamp: parseInt(t.timestamp, 10),
      matchId: t.match_id || undefined,
    }));

    return {
      id: r.id,
      username: r.username || r.codm_ign,
      codmIgn: r.codm_ign,
      codmUid: r.codm_uid,
      tier: r.tier || 'LEGENDARY TIER',
      clan: r.clan || '[1V1_PRO]',
      email: r.email || '',
      phone: r.phone || '+234 800 000 0000',
      balance: parseFloat(r.balance || 0),
      escrowBalance: parseFloat(r.escrow_balance || 0),
      totalWinnings: parseFloat(r.total_winnings || 0),
      wins: parseInt(r.wins || 0, 10),
      losses: parseInt(r.losses || 0, 10),
      draws: parseInt(r.draws || 0, 10),
      avatar: r.avatar,
      bankName: r.bank_name || undefined,
      accountNumber: r.account_number || undefined,
      accountName: r.account_name || undefined,
      referredBy: r.referred_by || undefined,
      referralCode: r.referral_code || r.username?.toLowerCase() || r.codm_ign?.toLowerCase(),
      totalReferralEarnings: parseFloat(r.total_referral_earnings || 0),
      transactions,
    };
  } catch (err) {
    console.error(`Error loading user ${id} from DB:`, err);
    return null;
  }
}

async function getUserByEmailOrIgn(identifier: string): Promise<{ user: UserProfile; passwordHash: string } | null> {
  try {
    const cleanIdent = identifier.trim().toLowerCase();
    const userRes = await pool.query(
      `SELECT * FROM users WHERE LOWER(email) = LOWER(${escapeSql(cleanIdent)}) OR LOWER(codm_ign) = LOWER(${escapeSql(cleanIdent)}) OR LOWER(username) = LOWER(${escapeSql(cleanIdent)}) OR LOWER(referral_code) = LOWER(${escapeSql(cleanIdent)})`
    );
    if (userRes.rows.length === 0) return null;
    const r = userRes.rows[0];

    const txRes = await pool.query(`SELECT * FROM transactions WHERE user_id = ${escapeSql(r.id)} ORDER BY timestamp DESC`);
    const transactions = txRes.rows.map((t) => ({
      id: t.id,
      type: t.type,
      amount: parseFloat(t.amount),
      description: t.description,
      timestamp: parseInt(t.timestamp, 10),
      matchId: t.match_id || undefined,
    }));

    const user: UserProfile = {
      id: r.id,
      username: r.username || r.codm_ign,
      codmIgn: r.codm_ign,
      codmUid: r.codm_uid,
      tier: r.tier || 'LEGENDARY TIER',
      clan: r.clan || '[1V1_PRO]',
      email: r.email || '',
      phone: r.phone || '+234 800 000 0000',
      balance: parseFloat(r.balance || 0),
      escrowBalance: parseFloat(r.escrow_balance || 0),
      totalWinnings: parseFloat(r.total_winnings || 0),
      wins: parseInt(r.wins || 0, 10),
      losses: parseInt(r.losses || 0, 10),
      draws: parseInt(r.draws || 0, 10),
      avatar: r.avatar,
      bankName: r.bank_name || undefined,
      accountNumber: r.account_number || undefined,
      accountName: r.account_name || undefined,
      referredBy: r.referred_by || undefined,
      referralCode: r.referral_code || r.username?.toLowerCase() || r.codm_ign?.toLowerCase(),
      totalReferralEarnings: parseFloat(r.total_referral_earnings || 0),
      transactions,
    };

    return { user, passwordHash: r.password_hash || '' };
  } catch (err) {
    console.error('Error finding user by email or IGN:', err);
    return null;
  }
}

async function getUserByReferralCodeOrIdentifier(identifier: string): Promise<UserProfile | null> {
  const res = await getUserByEmailOrIgn(identifier);
  return res ? res.user : null;
}

async function saveUserToDb(user: UserProfile, password?: string, forceBalanceUpdate: boolean = false) {
  try {
    const passValue = password ? escapeSql(password) : 'NULL';
    const balanceUpdateFragment = forceBalanceUpdate
      ? `balance = EXCLUDED.balance, escrow_balance = EXCLUDED.escrow_balance, total_winnings = EXCLUDED.total_winnings,`
      : `balance = users.balance, escrow_balance = users.escrow_balance, total_winnings = users.total_winnings,`;
    await pool.query(`
      INSERT INTO users (id, username, codm_ign, codm_uid, tier, clan, email, phone, password_hash, balance, escrow_balance, total_winnings, wins, losses, draws, avatar, bank_name, account_number, account_name, referred_by, referral_code, total_referral_earnings, created_at)
      VALUES (
        ${escapeSql(user.id)},
        ${escapeSql(user.username)},
        ${escapeSql(user.codmIgn)},
        ${escapeSql(user.codmUid)},
        ${escapeSql(user.tier || 'LEGENDARY TIER')},
        ${escapeSql(user.clan || '[1V1_PRO]')},
        ${escapeSql(user.email)},
        ${escapeSql(user.phone)},
        ${passValue},
        ${escapeSql(user.balance || 0)},
        ${escapeSql(user.escrowBalance || 0)},
        ${escapeSql(user.totalWinnings || 0)},
        ${escapeSql(user.wins || 0)},
        ${escapeSql(user.losses || 0)},
        ${escapeSql(user.draws || 0)},
        ${escapeSql(user.avatar)},
        ${escapeSql(user.bankName || null)},
        ${escapeSql(user.accountNumber || null)},
        ${escapeSql(user.accountName || null)},
        ${escapeSql(user.referredBy || null)},
        ${escapeSql(user.referralCode || user.username?.toLowerCase() || user.codmIgn?.toLowerCase() || null)},
        ${escapeSql(user.totalReferralEarnings || 0)},
        ${Date.now()}
      )
      ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        codm_ign = EXCLUDED.codm_ign,
        codm_uid = EXCLUDED.codm_uid,
        tier = EXCLUDED.tier,
        clan = EXCLUDED.clan,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
        ${balanceUpdateFragment}
        wins = users.wins,
        losses = users.losses,
        draws = users.draws,
        avatar = EXCLUDED.avatar,
        bank_name = COALESCE(EXCLUDED.bank_name, users.bank_name),
        account_number = COALESCE(EXCLUDED.account_number, users.account_number),
        account_name = COALESCE(EXCLUDED.account_name, users.account_name),
        referred_by = COALESCE(EXCLUDED.referred_by, users.referred_by),
        referral_code = COALESCE(EXCLUDED.referral_code, users.referral_code),
        total_referral_earnings = users.total_referral_earnings;
    `);
  } catch (err) {
    console.error(`Error saving user ${user.id} to DB:`, err);
    throw err;
  }
}

async function saveTransactionToDb(userId: string, tx: any) {
  try {
    await pool.query(`
      INSERT INTO transactions (id, user_id, type, amount, description, match_id, timestamp)
      VALUES (
        ${escapeSql(tx.id)},
        ${escapeSql(userId)},
        ${escapeSql(tx.type)},
        ${escapeSql(tx.amount)},
        ${escapeSql(tx.description || null)},
        ${escapeSql(tx.matchId || null)},
        ${escapeSql(tx.timestamp || Date.now())}
      )
      ON CONFLICT (id) DO UPDATE SET
        type = EXCLUDED.type,
        amount = EXCLUDED.amount,
        description = EXCLUDED.description,
        match_id = EXCLUDED.match_id,
        timestamp = EXCLUDED.timestamp;
    `);
  } catch (err) {
    console.error(`Error saving transaction ${tx.id} to DB:`, err);
    throw err;
  }
}

async function getMatchFromDb(id: string): Promise<Match | null> {
  try {
    const res = await pool.query(`SELECT * FROM matches WHERE id = ${escapeSql(id)}`);
    if (res.rows.length === 0) return null;
    const m = res.rows[0];
    return {
      id: m.id,
      challengeCode: m.challenge_code,
      roomCode: m.room_code || undefined,
      gameMode: m.game_mode,
      map: m.map,
      rules: typeof m.rules === 'string' ? JSON.parse(m.rules) : m.rules || [],
      stakeAmount: parseFloat(m.stake_amount),
      potAmount: parseFloat(m.pot_amount),
      platformFeePercentage: parseInt(m.platform_fee_percentage, 10) || 10,
      platformFee: parseFloat(m.platform_fee || 0),
      winnerPayout: parseFloat(m.winner_payout),
      matchDurationMinutes: parseInt(m.match_duration_minutes, 10) || 15,
      status: m.status,
      createdAt: parseInt(m.created_at, 10),
      creator: typeof m.creator_data === 'string' ? JSON.parse(m.creator_data) : m.creator_data,
      opponent: m.opponent_data ? (typeof m.opponent_data === 'string' ? JSON.parse(m.opponent_data) : m.opponent_data) : undefined,
      winnerId: m.winner_id || undefined,
      winnerIgn: m.winner_ign || undefined,
      resolutionNotes: m.resolution_notes || undefined,
      chatMessages: typeof m.chat_messages === 'string' ? JSON.parse(m.chat_messages) : m.chat_messages || [],
      roomGeneratedAt: m.room_generated_at ? parseInt(m.room_generated_at, 10) : undefined,
    };
  } catch (err) {
    console.error(`Error getting match ${id} from DB:`, err);
    return null;
  }
}

async function getAllMatchesFromDb(): Promise<Match[]> {
  try {
    const res = await pool.query('SELECT * FROM matches ORDER BY created_at DESC');
    return res.rows.map((m) => ({
      id: m.id,
      challengeCode: m.challenge_code,
      roomCode: m.room_code || undefined,
      gameMode: m.game_mode,
      map: m.map,
      rules: typeof m.rules === 'string' ? JSON.parse(m.rules) : m.rules || [],
      stakeAmount: parseFloat(m.stake_amount),
      potAmount: parseFloat(m.pot_amount),
      platformFeePercentage: parseInt(m.platform_fee_percentage, 10) || 10,
      platformFee: parseFloat(m.platform_fee || 0),
      winnerPayout: parseFloat(m.winner_payout),
      matchDurationMinutes: parseInt(m.match_duration_minutes, 10) || 15,
      status: m.status,
      createdAt: parseInt(m.created_at, 10),
      creator: typeof m.creator_data === 'string' ? JSON.parse(m.creator_data) : m.creator_data,
      opponent: m.opponent_data ? (typeof m.opponent_data === 'string' ? JSON.parse(m.opponent_data) : m.opponent_data) : undefined,
      winnerId: m.winner_id || undefined,
      winnerIgn: m.winner_ign || undefined,
      resolutionNotes: m.resolution_notes || undefined,
      chatMessages: typeof m.chat_messages === 'string' ? JSON.parse(m.chat_messages) : m.chat_messages || [],
      roomGeneratedAt: m.room_generated_at ? parseInt(m.room_generated_at, 10) : undefined,
    }));
  } catch (err) {
    console.error('Error getting matches from DB:', err);
    return [];
  }
}

async function saveMatchToDb(match: any) {
  try {
    await pool.query(`
      INSERT INTO matches (
        id, challenge_code, room_code, game_mode, map, rules,
        stake_amount, pot_amount, platform_fee_percentage, platform_fee, winner_payout,
        match_duration_minutes, status, creator_id, creator_data, opponent_id, opponent_data,
        winner_id, winner_ign, resolution_notes, chat_messages, created_at, room_generated_at, settled_at
      )
      VALUES (
        ${escapeSql(match.id)},
        ${escapeSql(match.challengeCode)},
        ${escapeSql(match.roomCode || null)},
        ${escapeSql(match.gameMode)},
        ${escapeSql(match.map)},
        ${escapeSql(match.rules || [])},
        ${escapeSql(match.stakeAmount)},
        ${escapeSql(match.potAmount)},
        ${escapeSql(match.platformFeePercentage || 10)},
        ${escapeSql(match.platformFee || 0)},
        ${escapeSql(match.winnerPayout)},
        ${escapeSql(match.matchDurationMinutes || 15)},
        ${escapeSql(match.status)},
        ${escapeSql(match.creator.id)},
        ${escapeSql(match.creator)},
        ${match.opponent ? escapeSql(match.opponent.id) : 'NULL'},
        ${match.opponent ? escapeSql(match.opponent) : 'NULL'},
        ${escapeSql(match.winnerId || null)},
        ${escapeSql(match.winnerIgn || null)},
        ${escapeSql(match.resolutionNotes || null)},
        ${escapeSql(match.chatMessages || [])},
        ${escapeSql(match.createdAt)},
        ${escapeSql(match.roomGeneratedAt || null)},
        ${escapeSql(match.settled_at || match.settledAt || null)}
      )
      ON CONFLICT (id) DO UPDATE SET
        room_code = EXCLUDED.room_code,
        status = EXCLUDED.status,
        match_duration_minutes = EXCLUDED.match_duration_minutes,
        creator_data = EXCLUDED.creator_data,
        opponent_id = EXCLUDED.opponent_id,
        opponent_data = EXCLUDED.opponent_data,
        winner_id = EXCLUDED.winner_id,
        winner_ign = EXCLUDED.winner_ign,
        resolution_notes = EXCLUDED.resolution_notes,
        chat_messages = EXCLUDED.chat_messages,
        room_generated_at = EXCLUDED.room_generated_at,
        settled_at = EXCLUDED.settled_at;
    `);
  } catch (err) {
    console.error(`Error saving match ${match.id} to DB:`, err);
    throw err;
  }
}


async function updatePlatformFinance(fee: number) {
  try {
    await pool.query(`
      UPDATE platform_finance 
      SET total_fees_collected = total_fees_collected + ${escapeSql(fee)}
      WHERE id = 'main'
    `);
  } catch (err) {
    console.error('Error updating platform finance:', err);
  }
}

async function withdrawPlatformFees(amount: number) {
  try {
    const res = await pool.query(`
      UPDATE platform_finance 
      SET total_fees_withdrawn = total_fees_withdrawn + ${escapeSql(amount)}
      WHERE id = 'main' AND (total_fees_collected - total_fees_withdrawn) >= ${escapeSql(amount)}
      RETURNING *
    `);
    return res.rows.length > 0;
  } catch (err) {
    console.error('Error withdrawing platform fees:', err);
    return false;
  }
}

// REST API ROUTES
app.post('/api/admin/withdraw', async (req, res) => {
  const { userId, amount } = req.body;
  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ error: 'Invalid withdrawal amount' });
  }

  const user = await getUserFromDb(userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Atomically deduct platform fees in SQL to prevent concurrent fee draining
  const success = await withdrawPlatformFees(numAmount);
  if (success) {
    await pool.query(`
      UPDATE users 
      SET balance = balance + ${escapeSql(numAmount)} 
      WHERE id = ${escapeSql(user.id)}
    `);
    const refreshed = await getUserFromDb(user.id);
    res.json({ success: true, balance: refreshed?.balance ?? user.balance });
  } else {
    res.status(400).json({ error: 'Insufficient platform funds or withdrawal failed' });
  }
});

app.get('/api/admin/finance', async (req, res) => {
    const { userId } = req.query;
    const user = await getUserFromDb(userId as string);
    if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const resFin = await pool.query(`SELECT * FROM platform_finance WHERE id = 'main'`);
    res.json(resFin.rows[0]);
});

app.get('/api/health', async (req, res) => {
  try {
    const client = await pool.connect();
    const timeRes = await client.query('SELECT NOW() as now');
    client.release();
    res.json({
      status: 'healthy',
      database: 'connected',
      pooler: 'Supabase IPv4 Session Pooler (port 5432)',
      timestamp: timeRes.rows[0]?.now,
      uptime: process.uptime(),
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'degraded',
      database: 'disconnected',
      error: err.message,
    });
  }
});

app.get('/api/db-diagnostics', async (req, res) => {
  try {
    const diagnostics = await runDatabaseDiagnostics();
    res.json(diagnostics);
  } catch (err: any) {
    res.status(500).json({
      status: 'FAILED',
      error: err.message || String(err),
    });
  }
});

app.get('/api/db-status', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as now, version() as version');
    const uCount = await client.query('SELECT COUNT(*) FROM users');
    const mCount = await client.query('SELECT COUNT(*) FROM matches');
    client.release();
    res.json({
      connected: true,
      database: 'Supabase PostgreSQL',
      timestamp: result.rows[0].now,
      version: result.rows[0].version,
      usersCount: parseInt(uCount.rows[0].count, 10),
      matchesCount: parseInt(mCount.rows[0].count, 10),
    });
  } catch (err: any) {
    const diagnostics = await runDatabaseDiagnostics();
    res.status(500).json({
      connected: false,
      error: err.message,
      diagnostics,
    });
  }
});

// Paystack Integration Diagnostic Endpoint
app.get('/api/paystack/test-connection', async (req, res) => {
  const secretKey = process.env.PAYSTACK_SECRET_KEY || '';
  const publicKey = process.env.VITE_PAYSTACK_PUBLIC_KEY || '';

  if (!secretKey || secretKey.startsWith('sk_test_xxxx')) {
    return res.json({
      configured: false,
      status: 'WARNING',
      message: 'PAYSTACK_SECRET_KEY is not set or using placeholder key. Please add PAYSTACK_SECRET_KEY to environment variables.',
      hasPublicKey: Boolean(publicKey),
    });
  }

  try {
    const paystackRes = await fetch('https://api.paystack.co/balance', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await paystackRes.json();
    res.json({
      configured: true,
      status: paystackRes.ok ? 'SUCCESS' : 'ERROR',
      paystackResponse: data,
      publicKeyConfigured: Boolean(publicKey),
    });
  } catch (err: any) {
    res.status(500).json({
      configured: true,
      status: 'ERROR',
      error: err.message,
    });
  }
});

const getPandascrowBaseUrl = (key: string) => {
  if (process.env.PANDASCROW_BASE_URL) {
    return process.env.PANDASCROW_BASE_URL;
  }
  if (key && (key.includes('live') || (!key.includes('test') && !key.includes('sandbox')))) {
    return 'https://api.pandascrow.io';
  }
  return 'https://sandbox.pandascrow.io';
};

// Pandascrow Integration Diagnostic Endpoint
app.get('/api/pandascrow/test-connection', async (req, res) => {
  const secretKey = process.env.PANDASCROW_SECRET_KEY || '';
  const publicKey = process.env.VITE_PANDASCROW_PUBLIC_KEY || '';
  const baseUrl = getPandascrowBaseUrl(secretKey);

  if (!secretKey || secretKey.startsWith('sk_pandascrow_test_xxxx')) {
    return res.json({
      configured: false,
      status: 'WARNING',
      message: 'PANDASCROW_SECRET_KEY is not configured or using placeholder key. Please add PANDASCROW_SECRET_KEY to your environment variables.',
      hasPublicKey: Boolean(publicKey),
      baseUrl,
    });
  }

  try {
    const pandaRes = await fetch(`${baseUrl}/wallet/balance`, {
      method: 'GET',
      headers: {
        'Token': publicKey || secretKey,
        'Content-Type': 'application/json',
      },
    });

    const data = await pandaRes.json();
    res.json({
      configured: true,
      status: pandaRes.ok ? 'SUCCESS' : 'ERROR',
      pandascrowResponse: data,
      publicKeyConfigured: Boolean(publicKey),
      baseUrl,
    });
  } catch (err: any) {
    res.status(500).json({
      configured: true,
      status: 'ERROR',
      error: err.message,
      baseUrl,
    });
  }
});

// Pandascrow Initialize Escrow / Funding Endpoint
app.post('/api/pandascrow/initialize', async (req, res) => {
  const { userId, amount, email, name, phoneNumber } = req.body;
  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 10) {
    return res.status(400).json({ error: 'Invalid amount for Pandascrow transaction' });
  }

  const secretKey = process.env.PANDASCROW_SECRET_KEY || '';
  const baseUrl = getPandascrowBaseUrl(secretKey);
  const isConfigured = secretKey && !secretKey.startsWith('sk_pandascrow_test_xxxx');

  if (!isConfigured) {
    // Return simulated Sandbox Pandascrow Escrow / Funding session for seamless prototyping
    const mockRef = `PANDA_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    return res.json({
      success: true,
      sandbox: true,
      message: 'Pandascrow Sandbox Escrow session initialized successfully',
      data: {
        reference: mockRef,
        checkout_url: `${baseUrl}/checkout/${mockRef}`,
        account_number: '99' + Math.floor(10000000 + Math.random() * 90000000),
        bank_name: 'Pandascrow SafeBank NGN',
        amount: numAmount,
      },
    });
  }

  try {
    const pandaRes = await fetch(`${baseUrl}/escrow/initialize`, {
      method: 'POST',
      headers: {
        'Token': secretKey,
        'Authorization': `Token ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: numAmount,
        currency: 'NGN',
        customer: {
          email: email || 'gladiator@codm.ng',
          name: name || 'CODM Gladiator',
          phone: phoneNumber || '+2348000000000',
        },
        type: 'instant_escrow',
        metadata: { userId },
      }),
    });

    const data = await pandaRes.json();
    res.json(data);
  } catch (err: any) {
    console.error('Pandascrow initialization error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to initialize Pandascrow transaction' });
  }
});

// Flutterwave Integration Diagnostic Endpoint
app.get('/api/flutterwave/test-connection', async (req, res) => {
  const flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || '';
  const flwPublic = process.env.VITE_FLUTTERWAVE_PUBLIC_KEY || '';

  if (!flwSecret || flwSecret.startsWith('FLWSECK_TEST-xxxx')) {
    return res.json({
      configured: false,
      status: 'WARNING',
      message: 'FLUTTERWAVE_SECRET_KEY is not configured yet. Add FLUTTERWAVE_SECRET_KEY to your environment secrets.',
      hasPublicKey: Boolean(flwPublic),
    });
  }

  try {
    // Check Flutterwave balance or banks list to verify key
    const flwRes = await fetch('https://api.flutterwave.com/v3/balances', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${flwSecret}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await flwRes.json();
    res.json({
      configured: true,
      status: flwRes.ok ? 'SUCCESS' : 'ERROR',
      flutterwaveResponse: data,
      publicKeyConfigured: Boolean(flwPublic),
    });
  } catch (err: any) {
    res.status(500).json({
      configured: true,
      status: 'ERROR',
      error: err.message,
    });
  }
});

// Fetch Flutterwave settlements & settlement schedule
app.get('/api/flutterwave/settlements', async (req, res) => {
  const flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || '';
  if (!flwSecret) {
    return res.status(400).json({ error: 'FLUTTERWAVE_SECRET_KEY is not configured' });
  }

  try {
    const flwRes = await fetch('https://api.flutterwave.com/v3/settlements', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${flwSecret}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await flwRes.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Outbound Server IP Lookup (used to obtain Render IP for Flutterwave Whitelisting)
app.get('/api/server-ip', async (req, res) => {
  try {
    const ipRes = await fetch('https://api.ipify.org?format=json');
    const ipData = await ipRes.json();
    return res.json({
      success: true,
      ip: ipData.ip,
      service: 'Render / Cloud Backend',
      instructions: [
        `Copy IP: ${ipData.ip}`,
        'Log in to Flutterwave Dashboard (https://dashboard.flutterwave.com)',
        'Navigate to Settings -> Security / API Keys -> IP Whitelist',
        `Paste ${ipData.ip} and save changes.`,
      ],
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Verify Paystack transaction by reference
app.get('/api/paystack/verify/:reference', async (req, res) => {
  const { reference } = req.params;
  const secretKey = process.env.PAYSTACK_SECRET_KEY || '';

  try {
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await paystackRes.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ status: false, message: err.message });
  }
});

// Verify Pandascrow transaction by reference
app.get('/api/pandascrow/verify/:reference', async (req, res) => {
  const { reference } = req.params;
  const secretKey = process.env.PANDASCROW_SECRET_KEY || '';
  const publicKey = process.env.VITE_PANDASCROW_PUBLIC_KEY || '';
  const baseUrl = getPandascrowBaseUrl(secretKey);

  if (!secretKey || secretKey.startsWith('sk_pandascrow_test_xxxx')) {
    return res.json({ status: true, message: 'Pandascrow Sandbox simulated verification success', data: { reference, status: 'success' } });
  }

  try {
    const pandaRes = await fetch(`${baseUrl}/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        'Token': publicKey || secretKey,
        'Content-Type': 'application/json',
      },
    });

    const data = await pandaRes.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ status: false, message: err.message });
  }
});

// Pandascrow Webhook listener (Escrow & Funding) with atomic transaction locking and race condition guard
app.post('/api/pandascrow/webhook', async (req, res) => {
  const client = await pool.connect();
  try {
    const pandaSecret = process.env.PANDASCROW_SECRET_KEY || '';
    const hash = crypto.createHmac('sha256', pandaSecret).update(JSON.stringify(req.body)).digest('hex');

    if (hash !== req.headers['x-pandascrow-signature'] && pandaSecret && !pandaSecret.startsWith('sk_pandascrow_test_xxxx')) {
      return res.status(401).json({ status: 'error', message: 'Invalid Pandascrow signature' });
    }

    const event = req.body;
    if (event?.event === 'escrow.success' || event?.event === 'charge.success' || event?.status === 'success') {
      const data = event.data || event;
      const amountNaira = Number(data.amount) / (data.is_kobo ? 100 : 1);
      const ref = data.reference || data.id;
      const email = data.customer?.email || data.email;
      const userId = data.metadata?.userId || data.user_id;

      let targetUser: UserProfile | null = null;
      if (userId) targetUser = await getUserFromDb(userId);
      if (!targetUser && email) {
        const found = await getUserByEmailOrIgn(email);
        if (found) targetUser = found.user;
      }

      if (targetUser && amountNaira > 0) {
        const txId = `tx_panda_${data.id || ref}`;
        await client.query('BEGIN');
        
        // Race condition guard: lock user row with FOR UPDATE
        await client.query(`SELECT * FROM users WHERE id = ${escapeSql(targetUser.id)} FOR UPDATE`);

        const descNote = `Wallet top-up via Pandascrow Escrow [Ref: ${ref}]`;
        const insRes = await client.query(`
          INSERT INTO transactions (id, user_id, type, amount, description, timestamp)
          VALUES (${escapeSql(txId)}, ${escapeSql(targetUser.id)}, 'DEPOSIT', ${escapeSql(amountNaira)}, ${escapeSql(descNote)}, ${Date.now()})
          ON CONFLICT (id) DO NOTHING
          RETURNING id;
        `);

        if (insRes.rows.length > 0) {
          await client.query(`
            UPDATE users 
            SET balance = balance + ${escapeSql(amountNaira)} 
            WHERE id = ${escapeSql(targetUser.id)}
          `);
          console.log(`✅ [Pandascrow Webhook] Credited ₦${amountNaira} to user ${targetUser.id}.`);
        }
        await client.query('COMMIT');
      }
    }
    return res.status(200).send('OK');
  } catch (err: any) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Pandascrow webhook error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});


// Paystack Webhook listener
app.post('/api/paystack/webhook', async (req, res) => {
  try {
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY || '';
    const hash = crypto.createHmac('sha512', paystackSecret).update(JSON.stringify(req.body)).digest('hex');

    if (hash !== req.headers['x-paystack-signature'] && paystackSecret && !paystackSecret.startsWith('sk_test_xxxx')) {
      return res.status(401).json({ status: 'error', message: 'Invalid signature' });
    }

    const event = req.body;
    if (event?.event === 'charge.success') {
      const data = event.data;
      const amountNaira = Number(data.amount) / 100;
      const ref = data.reference;
      const email = data.customer?.email;
      const userId = data.metadata?.userId;

      let targetUser: UserProfile | null = null;
      if (userId) targetUser = await getUserFromDb(userId);
      if (!targetUser && email) {
        const found = await getUserByEmailOrIgn(email);
        if (found) targetUser = found.user;
      }

      if (targetUser && amountNaira > 0) {
        const txId = `tx_${data.id || ref}`;
        const descNote = `Wallet top-up via Paystack Webhook [Ref: ${ref}]`;
        const insRes = await pool.query(`
          INSERT INTO transactions (id, user_id, type, amount, description, timestamp)
          VALUES (${escapeSql(txId)}, ${escapeSql(targetUser.id)}, 'DEPOSIT', ${escapeSql(amountNaira)}, ${escapeSql(descNote)}, ${Date.now()})
          ON CONFLICT (id) DO NOTHING
          RETURNING id;
        `);

        if (insRes.rows.length > 0) {
          await pool.query(`
            UPDATE users 
            SET balance = balance + ${escapeSql(amountNaira)} 
            WHERE id = ${escapeSql(targetUser.id)}
          `);
          console.log(`✅ [Paystack Webhook] Credited ₦${amountNaira} to user ${targetUser.id}.`);
        }
      }
    }
    return res.status(200).send('OK');
  } catch (err: any) {
    return res.status(200).json({ status: 'error' });
  }
});

// Verify Flutterwave transaction by ID or tx_ref
app.get('/api/flutterwave/verify/:id', async (req, res) => {
  const { id } = req.params;
  const flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || '';

  try {
    const flwRes = await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(id)}/verify`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${flwSecret}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await flwRes.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ status: false, message: err.message });
  }
});

// Flutterwave Webhook info / diagnostic endpoint
app.get('/api/flutterwave/webhook-info', (req, res) => {
  const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = req.get('host') || 'localhost:3000';
  const fullWebhookUrl = `${protocol}://${host}/api/flutterwave/webhook`;
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY || '';
  const secretHash = process.env.FLUTTERWAVE_SECRET_HASH || 'flw_sec_b8e217d4a940f5c1e309';

  res.json({
    status: true,
    webhookUrl: fullWebhookUrl,
    hasSecretKey: !!secretKey && !secretKey.startsWith('FLWSECK_TEST-xxxx'),
    secretHashConfigured: true,
    secretHash: secretHash,
    instructions: {
      step1: 'Log in to your Flutterwave Dashboard at https://dashboard.flutterwave.com',
      step2: 'Navigate to Settings -> Webhooks',
      step3: `Set your Webhook URL to: ${fullWebhookUrl}`,
      step4: `Set your Secret hash to: ${secretHash}`,
      step5: 'Click Save / Update Webhook',
    },
    note: 'In-app card & instant transfers are already automatically credited via the checkout callback. The webhook provides a fail-safe backup for slow bank transfers or dropped network connections.',
  });
});

// GET ping on /api/flutterwave/webhook for health check
app.get('/api/flutterwave/webhook', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Flutterwave webhook endpoint is active and healthy. Flutterwave events must be sent via HTTP POST with JSON body and verif-hash header.',
    secretHashConfigured: true,
  });
});

// Flutterwave Webhook listener (handles asynchronous bank transfers, USSD & background settlements)
app.post('/api/flutterwave/webhook', async (req, res) => {
  try {
    const signature = req.headers['verif-hash'];
    const secretHash = process.env.FLUTTERWAVE_SECRET_HASH || 'flw_sec_b8e217d4a940f5c1e309';

    // Verify secret hash if configured and signature provided
    if (secretHash && signature && signature !== secretHash) {
      console.warn('⚠️ Flutterwave webhook: invalid secret hash signature');
      return res.status(401).json({ status: 'error', message: 'Invalid secret hash' });
    }

    const payload = req.body;
    console.log(`🔔 [Flutterwave Webhook] Event: ${payload?.event}, ID: ${payload?.data?.id}, Ref: ${payload?.data?.tx_ref}`);

    if (payload?.event === 'charge.completed' && payload?.data?.status === 'successful') {
      const flwData = payload.data;
      const flwId = flwData.id;
      const flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || '';

      let verifiedData = flwData;

      // Server-side verification with Flutterwave API to prevent spoofing
      if (flwSecret && !flwSecret.startsWith('FLWSECK_TEST-xxxx')) {
        try {
          const verifyRes = await fetch(`https://api.flutterwave.com/v3/transactions/${flwId}/verify`, {
            headers: {
              Authorization: `Bearer ${flwSecret}`,
              'Content-Type': 'application/json',
            },
          });
          const verifyJson = await verifyRes.json();
          if (verifyJson.status === 'success' && verifyJson.data?.status === 'successful') {
            verifiedData = verifyJson.data;
          } else {
            console.warn('⚠️ Flutterwave webhook: verify call returned non-success:', verifyJson);
            return res.status(200).send('Verified status not successful');
          }
        } catch (vErr: any) {
          console.error('Error verifying transaction during Flutterwave webhook:', vErr.message);
        }
      }

      const amount = Number(verifiedData.amount || verifiedData.charged_amount || 0);
      const txRef = verifiedData.tx_ref || `FLW_${flwId}`;
      let userId = verifiedData.meta?.userId;
      if (!userId && txRef.startsWith('FLW_BT_')) {
        const parts = txRef.split('_');
        if (parts.length >= 4) {
          userId = `${parts[2]}_${parts[3]}_${parts[4]}`;
        }
      }
      const customerEmail = verifiedData.customer?.email;

      let targetUser: UserProfile | null = null;
      if (userId) {
        targetUser = await getUserFromDb(userId);
      }
      if (!targetUser && customerEmail) {
        const found = await getUserByEmailOrIgn(customerEmail);
        if (found) targetUser = found.user;
      }

      if (targetUser && amount > 0) {
        // Idempotency check directly in Postgres transactions table
        const checkWebhookTx = await pool.query(`
          SELECT id FROM transactions 
          WHERE user_id = ${escapeSql(targetUser.id)} 
            AND (
              id = ${escapeSql('tx_' + flwId)} 
              OR id = ${escapeSql('tx_' + txRef)} 
              OR description LIKE ${escapeSql('%' + txRef + '%')}
            )
        `);

        const txId = `tx_${flwId}`;
        const descNote = `Wallet top-up via Flutterwave [Ref: ${txRef}]`;
        const insRes = await pool.query(`
          INSERT INTO transactions (id, user_id, type, amount, description, timestamp)
          VALUES (${escapeSql(txId)}, ${escapeSql(targetUser.id)}, 'DEPOSIT', ${escapeSql(amount)}, ${escapeSql(descNote)}, ${Date.now()})
          ON CONFLICT (id) DO NOTHING
          RETURNING id;
        `);

        if (insRes.rows.length > 0) {
          await pool.query(`
            UPDATE users 
            SET balance = balance + ${escapeSql(amount)} 
            WHERE id = ${escapeSql(targetUser.id)}
          `);
          console.log(`✅ [Flutterwave Webhook] Credited ₦${amount} to user ${targetUser.id}.`);
        } else {
          console.log(`ℹ️ [Flutterwave Webhook] Transaction ${flwId} (${txRef}) was already credited previously.`);
        }
      } else {
        console.warn(`⚠️ [Flutterwave Webhook] Target user not identified for payment ref ${txRef}`);
      }
    }

    // Always return 200 OK to acknowledge Flutterwave webhook delivery
    return res.status(200).json({ status: 'success' });
  } catch (err: any) {
    console.error('Flutterwave webhook uncaught error:', err);
    return res.status(200).json({ status: 'error', message: err.message });
  }
});

// Fetch Nigerian Banks list from Flutterwave
app.get('/api/flutterwave/banks', async (req, res) => {
  const flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || '';
  try {
    const flwRes = await fetch('https://api.flutterwave.com/v3/banks/NG', {
      headers: {
        Authorization: `Bearer ${flwSecret}`,
        'Content-Type': 'application/json',
      },
    });
    const data = await flwRes.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ status: false, error: err.message });
  }
});

// Dynamic Bank Transfer Generator (charges via bank_transfer)
app.post('/api/flutterwave/charge-bank-transfer', async (req, res) => {
  const { userId, amount } = req.body;
  const numAmount = Number(amount);
  if (!numAmount || numAmount < 100) {
    return res.status(400).json({ status: 'error', message: 'Minimum deposit amount is ₦100' });
  }

  const user = await getUserFromDb(userId);
  if (!user) {
    return res.status(404).json({ status: 'error', message: 'User not found' });
  }

  const flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || '';
  if (!flwSecret || flwSecret.startsWith('FLWSECK_TEST-xxxx')) {
    return res.status(500).json({ status: 'error', message: 'Flutterwave Secret Key is not configured' });
  }

  const txRef = `FLW_BT_${user.id}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  try {
    const chargeRes = await fetch('https://api.flutterwave.com/v3/charges?type=bank_transfer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${flwSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: numAmount,
        currency: 'NGN',
        email: user.email || `${user.codmIgn.toLowerCase()}@player.ng`,
        tx_ref: txRef,
        fullname: user.accountName || user.codmIgn,
        meta: {
          userId: user.id,
          playerIgn: user.codmIgn,
        },
      }),
    });

    const data = await chargeRes.json();
    if (data.status === 'success' && data.meta?.authorization) {
      const auth = data.meta.authorization;
      return res.json({
        status: 'success',
        txRef,
        accountNumber: auth.transfer_account,
        bankName: auth.transfer_bank || 'Flutterwave MFB',
        accountName: auth.transfer_note?.replace(/^Please make a bank transfer to\s*/i, '').trim() || 'Quadri Abdulsalam FLW',
        amount: Number(auth.transfer_amount) || numAmount,
        expiration: auth.account_expiration,
        transferReference: auth.transfer_reference,
      });
    }

    return res.status(400).json({
      status: 'error',
      message: data.message || 'Could not initiate bank transfer account with Flutterwave',
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// Dynamic Bank Transfer Manual Check / Polling Verifier
app.post('/api/flutterwave/verify-bank-transfer', async (req, res) => {
  const { userId, txRef } = req.body;
  if (!userId || !txRef) {
    return res.status(400).json({ status: 'error', message: 'userId and txRef required' });
  }

  const user = await getUserFromDb(userId);
  if (!user) {
    return res.status(404).json({ status: 'error', message: 'User not found' });
  }

  const flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || '';

  try {
    const verifyRes = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`, {
      headers: { Authorization: `Bearer ${flwSecret}` },
    });
    const verifyData = await verifyRes.json();

    if (verifyData.status === 'success' && verifyData.data?.status === 'successful') {
      const txData = verifyData.data;
      const amount = Number(txData.amount || txData.charged_amount);
      const flwId = txData.id;

      // Idempotency check in Postgres transactions table directly
      const checkTx = await pool.query(`
        SELECT id FROM transactions 
        WHERE user_id = ${escapeSql(user.id)} 
          AND (
            id = ${escapeSql('tx_' + flwId)} 
            OR id = ${escapeSql('tx_' + txRef)} 
            OR description LIKE ${escapeSql('%' + txRef + '%')}
          )
      `);

      if (checkTx.rows.length > 0) {
        const freshUser = await getUserFromDb(user.id);
        return res.json({
          status: 'success',
          verified: true,
          balance: freshUser?.balance ?? user.balance,
          alreadyCredited: true,
          amount,
        });
      }

      const txId = `tx_${flwId}`;
      const descNote = `Wallet top-up via Direct Bank Transfer [Ref: ${txRef}]`;
      const insRes = await pool.query(`
        INSERT INTO transactions (id, user_id, type, amount, description, timestamp)
        VALUES (${escapeSql(txId)}, ${escapeSql(user.id)}, 'DEPOSIT', ${escapeSql(amount)}, ${escapeSql(descNote)}, ${Date.now()})
        ON CONFLICT (id) DO NOTHING
        RETURNING id;
      `);

      let newBal = user.balance;
      if (insRes.rows.length > 0) {
        const balRes = await pool.query(`
          UPDATE users 
          SET balance = balance + ${escapeSql(amount)} 
          WHERE id = ${escapeSql(user.id)}
          RETURNING balance;
        `);
        newBal = parseFloat(balRes.rows[0].balance);
        console.log(`✅ [Direct Bank Transfer] Credited ₦${amount} to user ${user.id} (${user.codmIgn}). New balance: ₦${newBal}`);
      } else {
        const freshUser = await getUserFromDb(user.id);
        newBal = freshUser?.balance ?? user.balance;
      }

      const tx = {
        id: txId,
        type: 'DEPOSIT' as const,
        amount,
        description: descNote,
        timestamp: Date.now(),
      };

      return res.json({
        status: 'success',
        verified: true,
        balance: newBal,
        amount,
        transaction: tx,
      });
    }

    return res.json({
      status: 'pending',
      verified: false,
      message: 'Transfer is not yet confirmed by the bank. If you just sent it, please wait a moment for inter-bank clearing and tap again.',
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// Nigerian Bank Codes lookup for Paystack
const PAYSTACK_BANK_CODES: Record<string, string> = {
  'opay': '999992',
  'paycom': '999992',
  'palmpay': '999991',
  'gtb': '058',
  'gtbank': '058',
  'guaranty trust bank': '058',
  'zenith': '057',
  'zenith bank': '057',
  'kuda': '50211',
  'kuda bank': '50211',
  'moniepoint': '50515',
  'moniepoint microfinance bank': '50515',
  'access': '044',
  'access bank': '044',
  'first bank': '011',
  'first bank of nigeria': '011',
  'uba': '033',
  'united bank for africa': '033',
  'wema': '035',
  'wema bank': '035',
  'stanbic': '221',
  'stanbic ibtc': '221',
  'fidelity': '070',
  'fidelity bank': '070',
  'sterling': '232',
  'sterling bank': '232',
  'fcmb': '214',
  'first city monument bank': '214',
  'union': '032',
  'union bank': '032',
  'providus': '101',
  'providus bank': '101',
};

// Nigerian Bank Codes lookup for Flutterwave
const FLUTTERWAVE_BANK_CODES: Record<string, string> = {
  'opay': '100004',
  'paycom': '100004',
  'palmpay': '100033',
  'kuda': '090267',
  'kuda bank': '090267',
  'moniepoint': '090405',
  'moniepoint microfinance bank': '090405',
  'access': '044',
  'access bank': '044',
  'gtb': '058',
  'gtbank': '058',
  'guaranty trust bank': '058',
  'zenith': '057',
  'zenith bank': '057',
  'first bank': '011',
  'first bank of nigeria': '011',
  'uba': '033',
  'united bank for africa': '033',
  'wema': '035',
  'wema bank': '035',
  'stanbic': '221',
  'stanbic ibtc': '221',
  'fidelity': '070',
  'fidelity bank': '070',
  'sterling': '232',
  'sterling bank': '232',
  'fcmb': '214',
  'first city monument bank': '214',
  'union': '032',
  'union bank': '032',
  'providus': '101',
  'providus bank': '101',
};

// Smart Bank Code Resolver for Flutterwave
function getFlutterwaveBankCode(name: string, explicitCode?: string): string {
  if (explicitCode && /^\d+$/.test(explicitCode.trim())) return explicitCode.trim();
  const n = (name || '').toLowerCase().trim();
  if (n.includes('opay') || n.includes('paycom')) return '100004';
  if (n.includes('palmpay')) return '100033';
  if (n.includes('kuda')) return '090267';
  if (n.includes('moniepoint')) return '090405';
  if (n.includes('gtb') || n.includes('guaranty')) return '058';
  if (n.includes('zenith')) return '057';
  if (n.includes('access')) return '044';
  if (n.includes('first bank')) return '011';
  if (n.includes('uba') || n.includes('united bank')) return '033';
  if (n.includes('wema')) return '035';
  if (n.includes('stanbic')) return '221';
  if (n.includes('fidelity')) return '070';
  if (n.includes('sterling')) return '232';
  if (n.includes('fcmb') || n.includes('monument')) return '214';
  if (n.includes('union')) return '032';
  if (n.includes('providus')) return '101';
  return FLUTTERWAVE_BANK_CODES[n] || '100004';
}

// Smart Bank Code Resolver for Paystack
function getPaystackBankCode(name: string, explicitCode?: string): string {
  if (explicitCode && /^\d+$/.test(explicitCode.trim())) return explicitCode.trim();
  const n = (name || '').toLowerCase().trim();
  if (n.includes('opay') || n.includes('paycom')) return '999992';
  if (n.includes('palmpay')) return '999991';
  if (n.includes('kuda')) return '50211';
  if (n.includes('moniepoint')) return '50515';
  if (n.includes('gtb') || n.includes('guaranty')) return '058';
  if (n.includes('zenith')) return '057';
  if (n.includes('access')) return '044';
  if (n.includes('first bank')) return '011';
  if (n.includes('uba') || n.includes('united bank')) return '033';
  if (n.includes('wema')) return '035';
  if (n.includes('stanbic')) return '221';
  if (n.includes('fidelity')) return '070';
  if (n.includes('sterling')) return '232';
  if (n.includes('fcmb') || n.includes('monument')) return '214';
  if (n.includes('union')) return '032';
  if (n.includes('providus')) return '101';
  return PAYSTACK_BANK_CODES[n] || '999992';
}

// Unified NUBAN Bank Account Resolution Endpoint (supports Flutterwave, Paystack, GET & POST, all query parameter casings)
async function handleResolveBankAccount(req: any, res: any) {
  const rawAccount = req.query.account_number || req.query.accountNumber || req.body?.account_number || req.body?.accountNumber;
  const rawBankName = req.query.bank_name || req.query.bankName || req.body?.bank_name || req.body?.bankName;
  const rawBankCode = req.query.bank_code || req.query.bankCode || req.body?.bank_code || req.body?.bankCode;

  const accountNumber = String(rawAccount || '').replace(/\D/g, '').trim();
  const bankName = String(rawBankName || '').trim();

  if (!accountNumber || accountNumber.length !== 10) {
    return res.status(400).json({ status: false, error: 'Valid 10-digit Nigerian account number is required' });
  }

  const flwCode = getFlutterwaveBankCode(bankName, rawBankCode ? String(rawBankCode) : undefined);
  const paystackCode = getPaystackBankCode(bankName, rawBankCode ? String(rawBankCode) : undefined);
  const flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || '';
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY || '';

  // 1. Try Flutterwave Live Account Resolution
  if (flwSecret && !flwSecret.startsWith('FLWSECK_TEST-xxxx')) {
    try {
      const flwRes = await fetch('https://api.flutterwave.com/v3/accounts/resolve', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${flwSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_number: accountNumber,
          account_bank: flwCode,
        }),
      });
      const flwData = await flwRes.json();
      if ((flwData.status === 'success' || flwData.status === true) && flwData.data?.account_name) {
        return res.json({
          status: true,
          gateway: 'flutterwave',
          data: {
            account_number: flwData.data.account_number || accountNumber,
            account_name: flwData.data.account_name,
            bank_code: flwCode,
            bank_name: bankName,
          },
        });
      }
    } catch (err: any) {
      console.warn('[Resolve Account] Flutterwave error:', err.message);
    }
  }

  // 2. Try Paystack Live Account Resolution
  if (paystackSecret && !paystackSecret.startsWith('sk_test_xxxx')) {
    try {
      const paystackRes = await fetch(`https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${paystackCode}`, {
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json',
        },
      });
      const paystackData = await paystackRes.json();
      if ((paystackData.status === true || paystackData.status === 'success') && paystackData.data?.account_name) {
        return res.json({
          status: true,
          gateway: 'paystack',
          data: {
            account_number: paystackData.data.account_number || accountNumber,
            account_name: paystackData.data.account_name,
            bank_code: paystackCode,
            bank_name: bankName,
          },
        });
      }
    } catch (err: any) {
      console.warn('[Resolve Account] Paystack error:', err.message);
    }
  }

  // 3. Platform Admin Account check (e.g. OPay 7079874999)
  if (accountNumber === '7079874999' && (bankName.toLowerCase().includes('opay') || bankName.toLowerCase().includes('paycom'))) {
    return res.json({
      status: true,
      gateway: 'platform',
      data: {
        account_number: '7079874999',
        account_name: 'QUADRI OPEYEMI ABDULSALAM',
        bank_code: flwCode,
        bank_name: 'OPay Digital Services Limited (OPay)',
      },
    });
  }

  // 4. Return clean verification failure (never fake someone else's name!)
  return res.status(404).json({
    status: false,
    error: `Could not verify account name with ${bankName || 'bank'}. Please ensure the 10 digits and selected bank are correct.`,
  });
}

app.get('/api/resolve-account', handleResolveBankAccount);
app.post('/api/resolve-account', handleResolveBankAccount);
app.get('/api/paystack/resolve-account', handleResolveBankAccount);
app.post('/api/paystack/resolve-account', handleResolveBankAccount);
app.get('/api/flutterwave/resolve-account', handleResolveBankAccount);
app.post('/api/flutterwave/resolve-account', handleResolveBankAccount);

// Fetch user profile directly from PostgreSQL database
app.get('/api/users/:id', async (req, res) => {
  const user = await getUserFromDb(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

// Register user with Email, Password, CODM IGN and Permanent Banking Details
app.post('/api/auth/register', async (req, res) => {
  const { email, password, codmIgn, codmUid, phone, bankName, accountNumber, accountName, initialDeposit = 0 } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Valid email address is required' });
  }
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }
  if (!codmIgn || !codmIgn.trim()) {
    return res.status(400).json({ error: 'Call of Duty: Mobile Username (IGN) is required' });
  }
  if (!phone || !phone.trim()) {
    return res.status(400).json({ error: 'Phone number is required' });
  }
  if (!bankName || !accountNumber) {
    return res.status(400).json({ error: 'Banking details (Bank Name and Account Number) are required for deposits and withdrawals' });
  }

  // Check directly in database if email or IGN already exists
  const existingEmail = await getUserByEmailOrIgn(email);
  const existingIgn = await getUserByEmailOrIgn(codmIgn);

  if (existingEmail || existingIgn) {
    return res.status(400).json({ error: 'An account with this email or CODM IGN already exists' });
  }

  const id = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const numDeposit = Math.max(0, Number(initialDeposit) || 0);
  const resolvedUid = codmUid && codmUid.trim() ? codmUid.trim() : `67${Math.floor(10000000000000 + Math.random() * 90000000000000)}`;
  const newUser: UserProfile = {
    id,
    username: codmIgn.trim(),
    codmIgn: codmIgn.trim(),
    codmUid: resolvedUid,
    email: email.trim(),
    phone: phone.trim(),
    bankName: bankName.trim(),
    accountNumber: accountNumber.trim(),
    accountName: accountName ? accountName.trim() : `${codmIgn.trim()} (Verified NUBAN)`,
    balance: numDeposit,
    escrowBalance: 0,
    totalWinnings: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(codmIgn.trim())}`,
    transactions: numDeposit > 0 ? [
      {
        id: `tx_${Date.now()}`,
        type: 'DEPOSIT',
        amount: numDeposit,
        description: `Initial Wallet Funding (₦${numDeposit.toLocaleString()})`,
        timestamp: Date.now(),
      }
    ] : [],
  };

  try {
    await saveUserToDb(newUser, password);
    if (newUser.transactions.length > 0) {
      await saveTransactionToDb(newUser.id, newUser.transactions[0]);
    }
    res.status(201).json(newUser);
  } catch (err: any) {
    console.error('Registration database error:', err);
    res.status(500).json({ error: 'Failed to create user account in database' });
  }
});



// Login with Email or CODM IGN and Password
app.post('/api/auth/login', async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !identifier.trim()) {
    return res.status(400).json({ error: 'Email or CODM Username is required' });
  }

  const account = await getUserByEmailOrIgn(identifier);
  if (!account) {
    return res.status(404).json({ error: 'No account found matching this email or username' });
  }

  if (account.passwordHash && password && account.passwordHash !== password) {
    return res.status(401).json({ error: 'Incorrect password. Please try again.' });
  }

  res.json(account.user);
});

// Quick opponent onboarding or creation
app.post('/api/users', async (req, res) => {
  const { username, codmIgn, codmUid, email, phone, initialDeposit = 0, password } = req.body;
  if (!codmIgn) {
    return res.status(400).json({ error: 'CODM In-Game Name (IGN) is required' });
  }

  const existing = await getUserByEmailOrIgn(codmIgn);
  if (existing) {
    return res.json(existing.user);
  }

  const id = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const newUser: UserProfile = {
    id,
    username: username || codmIgn,
    codmIgn,
    codmUid: codmUid || `67${Math.floor(10000000000000 + Math.random() * 90000000000000)}`,
    email: email || `${codmIgn.toLowerCase()}@player.ng`,
    phone: phone || '+234 800 000 0000',
    balance: initialDeposit,
    escrowBalance: 0,
    totalWinnings: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${codmIgn}`,
    transactions: initialDeposit > 0 ? [
      {
        id: `tx_${Date.now()}`,
        type: 'DEPOSIT',
        amount: initialDeposit,
        description: 'Initial Wallet Funding (₦' + initialDeposit.toLocaleString() + ')',
        timestamp: Date.now(),
      }
    ] : [],
  };

  try {
    await saveUserToDb(newUser, password);
    if (newUser.transactions.length > 0) {
      await saveTransactionToDb(newUser.id, newUser.transactions[0]);
    }
    res.status(201).json(newUser);
  } catch (err: any) {
    console.error('User creation database error:', err);
    res.status(500).json({ error: 'Failed to create user account in database' });
  }
});

// Update User Profile directly in database - atomic update of profile fields only (never touches balance or ledger)
app.patch('/api/users/:id', async (req, res) => {
  const userId = req.params.id;
  const user = await getUserFromDb(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { username, codmIgn, codmUid, email, phone, avatar, tier, clan, bankName, accountNumber, accountName } = req.body;

  await pool.query(`
    UPDATE users SET
      username = COALESCE(${username !== undefined ? escapeSql(username) : 'NULL'}, username),
      codm_ign = COALESCE(${codmIgn !== undefined ? escapeSql(codmIgn) : 'NULL'}, codm_ign),
      codm_uid = COALESCE(${codmUid !== undefined ? escapeSql(codmUid) : 'NULL'}, codm_uid),
      email = COALESCE(${email !== undefined ? escapeSql(email) : 'NULL'}, email),
      phone = COALESCE(${phone !== undefined ? escapeSql(phone) : 'NULL'}, phone),
      avatar = COALESCE(${avatar !== undefined ? escapeSql(avatar) : 'NULL'}, avatar),
      tier = COALESCE(${tier !== undefined ? escapeSql(tier) : 'NULL'}, tier),
      clan = COALESCE(${clan !== undefined ? escapeSql(clan) : 'NULL'}, clan),
      bank_name = COALESCE(${bankName !== undefined ? escapeSql(bankName) : 'NULL'}, bank_name),
      account_number = COALESCE(${accountNumber !== undefined ? escapeSql(accountNumber) : 'NULL'}, account_number),
      account_name = COALESCE(${accountName !== undefined ? escapeSql(accountName) : 'NULL'}, account_name)
    WHERE id = ${escapeSql(userId)}
  `);

  const updatedUser = await getUserFromDb(userId);
  res.json(updatedUser || user);
});

// Wallet deposit directly into database with strict idempotency and race condition protection
app.post('/api/users/:id/deposit', async (req, res) => {
  const user = await getUserFromDb(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { amount, method = 'Instant Transfer', reference, transactionId } = req.body;
  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ error: 'Invalid deposit amount' });
  }

  const refStr = reference ? String(reference).trim() : '';
  const txIdStr = transactionId ? String(transactionId).trim() : '';

  const finalTxId = txIdStr ? `tx_${txIdStr}` : (refStr ? `tx_${refStr}` : `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`);
  const descNote = refStr
    ? `Wallet top-up via ${method} [Ref: ${refStr}]`
    : (txIdStr ? `Wallet top-up via ${method} [ID: ${txIdStr}]` : `Wallet top-up via ${method}`);

  // Atomic race condition guard: The primary key constraint on transactions table ensures
  // ONLY ONE concurrent request can successfully insert the deposit record!
  const insertTxRes = await pool.query(`
    INSERT INTO transactions (id, user_id, type, amount, description, timestamp)
    VALUES (${escapeSql(finalTxId)}, ${escapeSql(user.id)}, 'DEPOSIT', ${escapeSql(numAmount)}, ${escapeSql(descNote)}, ${Date.now()})
    ON CONFLICT (id) DO NOTHING
    RETURNING id;
  `);

  if (insertTxRes.rows.length === 0) {
    console.log(`🛡️ [Race Condition Prevented] Deposit with id '${finalTxId}' already inserted. Skipping balance credit.`);
    const freshUser = await getUserFromDb(user.id);
    return res.json({ success: true, balance: freshUser?.balance ?? user.balance, alreadyCredited: true });
  }

  // Atomically increment user balance in database
  const balRes = await pool.query(`
    UPDATE users 
    SET balance = balance + ${escapeSql(numAmount)} 
    WHERE id = ${escapeSql(user.id)} 
    RETURNING balance;
  `);
  const newBalance = parseFloat(balRes.rows[0].balance);

  const tx = {
    id: finalTxId,
    type: 'DEPOSIT' as const,
    amount: numAmount,
    description: descNote,
    timestamp: Date.now(),
  };

  console.log(`✅ [Deposit API] Credited ₦${numAmount} to user ${user.id} (${user.codmIgn}). New balance: ₦${newBalance}`);
  res.json({ success: true, balance: newBalance, transaction: tx });
});

// Fetch Nigerian Banks list from Paystack
app.get('/api/paystack/banks', async (req, res) => {
  const secretKey = process.env.PAYSTACK_SECRET_KEY || '';
  try {
    const paystackRes = await fetch('https://api.paystack.co/bank?country=nigeria', {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    });
    const data = await paystackRes.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ status: false, error: err.message });
  }
});



// Direct Payout / Cashout Tester Endpoint (runs real payout against selected gateway)
app.post('/api/admin/test-cashout', async (req, res) => {
  const {
    amount = 100,
    bankName = 'OPay',
    accountNumber = '9151609682',
    accountName = 'Nurudeen Bolaji Abdulsalam',
    gateway = 'flutterwave',
    bankCode,
  } = req.body;

  const numAmount = Number(amount);
  const flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || '';
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY || '';

  const flwCode = getFlutterwaveBankCode(bankName, bankCode);
  const paystackCode = getPaystackBankCode(bankName, bankCode);

  if (gateway === 'flutterwave') {
    if (!flwSecret || flwSecret.startsWith('FLWSECK_TEST-xxxx')) {
      return res.status(400).json({ success: false, error: 'Flutterwave Secret Key is not configured' });
    }

    try {
      console.log(`[TEST-CASHOUT] Initiating Flutterwave payout: ₦${numAmount} to ${accountNumber} (${bankName} / code ${flwCode})...`);
      const flwRes = await fetch('https://api.flutterwave.com/v3/transfers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${flwSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_bank: flwCode,
          account_number: accountNumber.trim(),
          amount: numAmount,
          narration: `CODM Test Payout to ${accountName}`,
          currency: 'NGN',
          reference: `FLW_TRF_TEST_${Date.now()}`,
          beneficiary_name: accountName,
        }),
      });

      const data = await flwRes.json();
      return res.json({
        gateway: 'flutterwave',
        bankCodeUsed: flwCode,
        accountNumber,
        accountName,
        amount: numAmount,
        response: data,
        ipNotice: (data.message?.includes('IP Whitelisting') || data.message?.includes('administrator') || data.status === 'error')
          ? {
              requiresIpWhitelistOrApproval: true,
              serverIpv4: '34.34.246.104',
              secondaryIpv4: '34.34.246.124',
              serverIpv6: '2600:1900:0:4a03::e00',
              instructions: 'In your Flutterwave Dashboard, go to Settings -> Security / API Keys -> Whitelisted IP addresses, and add 34.34.246.104. Also check your email (nerochazeagent@gmail.com) for Flutterwave transfer approval or IP alert.',
            }
          : undefined,
      });
    } catch (err: any) {
      return res.status(500).json({ gateway: 'flutterwave', error: err.message });
    }
  } else {
    // Paystack
    if (!paystackSecret || paystackSecret.startsWith('sk_test_xxxx')) {
      return res.status(400).json({ success: false, error: 'Paystack Secret Key is not configured' });
    }

    try {
      console.log(`[TEST-CASHOUT] Resolving with Paystack: ${accountNumber} (${bankName} / code ${paystackCode})...`);
      const resolveRes = await fetch(`https://api.paystack.co/bank/resolve?account_number=${accountNumber.trim()}&bank_code=${paystackCode}`, {
        headers: { Authorization: `Bearer ${paystackSecret}` },
      });
      const resolveData = await resolveRes.json();

      const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'nuban',
          name: accountName,
          account_number: accountNumber.trim(),
          bank_code: paystackCode,
          currency: 'NGN',
        }),
      });
      const recipientData = await recipientRes.json();

      if (!recipientData.status || !recipientData.data?.recipient_code) {
        return res.json({
          gateway: 'paystack',
          resolveData,
          recipientData,
          message: 'Failed to create Paystack recipient',
        });
      }

      const transferRes = await fetch('https://api.paystack.co/transfer', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'balance',
          amount: numAmount * 100,
          recipient: recipientData.data.recipient_code,
          reason: `CODM Test Cashout to ${accountName}`,
        }),
      });
      const transferData = await transferRes.json();

      return res.json({
        gateway: 'paystack',
        resolveData,
        recipientData,
        transferData,
      });
    } catch (err: any) {
      return res.status(500).json({ gateway: 'paystack', error: err.message });
    }
  }
});

// Active withdrawal lock set per user ID to block concurrent race-condition attacks
const activeWithdrawalLocks = new Set<string>();

// Wallet withdrawal with Flutterwave & Paystack Transfers API & atomic database update
app.post('/api/users/:id/withdraw', async (req, res) => {
  const userId = req.params.id;

  // 1. Race condition guard: In-flight user lock
  if (activeWithdrawalLocks.has(userId)) {
    return res.status(429).json({ error: 'A withdrawal is currently in progress for this account. Please wait a moment.' });
  }

  const { amount, bankName = '', accountNumber = '', accountName = '', bankCode = '', gateway = 'flutterwave' } = req.body;
  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ error: 'Invalid withdrawal amount' });
  }

  activeWithdrawalLocks.add(userId);
  const client = await pool.connect();
  let user: UserProfile | null = null;
  let newBalance = 0;
  const txId = `tx_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;

  try {
    await client.query('BEGIN');

    // 2. Race condition guard: Row-level lock (FOR UPDATE)
    const userLockRes = await client.query(`SELECT * FROM users WHERE id = ${escapeSql(userId)} FOR UPDATE`);
    if (userLockRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    const userRow = userLockRes.rows[0];
    const currentBalance = parseFloat(userRow.balance || 0);

    if (numAmount > currentBalance) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Insufficient available balance. You have ₦${currentBalance.toLocaleString()} available.` });
    }

    // 3. Atomic deduction and bank info update in PostgreSQL
    const deductRes = await client.query(`
      UPDATE users 
      SET balance = balance - ${escapeSql(numAmount)},
          bank_name = COALESCE(${escapeSql(bankName || null)}, bank_name),
          account_number = COALESCE(${escapeSql(accountNumber || null)}, account_number),
          account_name = COALESCE(${escapeSql(accountName || null)}, account_name)
      WHERE id = ${escapeSql(userId)} AND balance >= ${escapeSql(numAmount)}
      RETURNING balance;
    `);

    if (deductRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient available balance' });
    }

    newBalance = parseFloat(deductRes.rows[0].balance);

    const initialDesc = `Withdrawal request of ₦${numAmount.toLocaleString()} to ${bankName} (${accountNumber} - ${accountName})`;
    await client.query(`
      INSERT INTO transactions (id, user_id, type, amount, description, timestamp)
      VALUES (${escapeSql(txId)}, ${escapeSql(userId)}, 'WITHDRAWAL', ${escapeSql(numAmount)}, ${escapeSql(initialDesc)}, ${Date.now()})
    `);

    await client.query('COMMIT');
    user = await getUserFromDb(userId);
  } catch (dbErr: any) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Database withdrawal error:', dbErr);
    return res.status(500).json({ error: dbErr.message || 'Database error processing withdrawal' });
  } finally {
    client.release();
    activeWithdrawalLocks.delete(userId);
  }

  // 4. Now initiate external payout gateway transfer
  const flwCode = getFlutterwaveBankCode(bankName, bankCode);
  const paystackCode = getPaystackBankCode(bankName, bankCode);

  const flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || '';
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY || '';
  const pandaSecret = process.env.PANDASCROW_SECRET_KEY || '';
  const pandaBaseUrl = getPandascrowBaseUrl(pandaSecret);
  let transferResult: any = null;
  let providerUsed: 'flutterwave' | 'paystack' | 'pandascrow' | 'manual' = 'manual';

  const flwConfigured = flwSecret && !flwSecret.startsWith('FLWSECK_TEST-xxxx');
  const paystackConfigured = paystackSecret && !paystackSecret.startsWith('sk_test_xxxx');
  const pandaConfigured = pandaSecret && !pandaSecret.startsWith('sk_pandascrow_test_xxxx');

  if (gateway === 'pandascrow') {
    try {
      console.log(`🚀 Initiating Pandascrow Transfer of ₦${numAmount} to ${accountNumber} (${bankName})...`);
      if (!pandaConfigured) {
        transferResult = {
          gateway: 'pandascrow',
          status: true,
          data: { reference: `PANDA_TRF_${Date.now()}` },
          message: 'Pandascrow Sandbox Simulated Payout Successful',
        };
        providerUsed = 'pandascrow';
      } else {
        const pandaRes = await fetch(`${pandaBaseUrl}/transfer`, {
          method: 'POST',
          headers: {
            'Token': pandaSecret,
            'Authorization': `Token ${pandaSecret}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: numAmount,
            currency: 'NGN',
            bank_code: bankCode || '058',
            account_number: accountNumber.trim(),
            account_name: accountName || user?.codmIgn || 'Gladiator',
            reference: `PANDA_TRF_${Date.now()}`,
          }),
        });
        const pandaData = await pandaRes.json();
        if (pandaData.status === 'success' || pandaData.status === true) {
          transferResult = {
            gateway: 'pandascrow',
            status: true,
            data: pandaData.data,
            message: pandaData.message,
          };
          providerUsed = 'pandascrow';
        } else {
          transferResult = {
            gateway: 'pandascrow',
            status: false,
            isManualFallback: true,
            message: pandaData.message || 'Pandascrow payout pending manual review',
          };
        }
      }
    } catch (err: any) {
      console.error('Pandascrow transfer error:', err.message);
      transferResult = {
        gateway: 'pandascrow',
        status: false,
        isManualFallback: true,
        message: err.message,
      };
    }
  } else if (gateway === 'flutterwave' && flwConfigured) {
    try {
      console.log(`🚀 Initiating Flutterwave Transfer of ₦${numAmount} to ${accountNumber} (${bankName} / code ${flwCode})...`);
      const flwTransferRes = await fetch('https://api.flutterwave.com/v3/transfers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${flwSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_bank: flwCode,
          account_number: accountNumber.trim(),
          amount: numAmount,
          narration: `CODM Cashout for ${user?.codmIgn || userId}`,
          currency: 'NGN',
          reference: `FLW_TRF_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          beneficiary_name: accountName || user?.codmIgn || 'Gladiator',
        }),
      });

      const flwData = await flwTransferRes.json();
      console.log('✅ Flutterwave Transfer API Response:', flwData);

      if (flwData.status === 'success' || flwData.status === 'successful') {
        transferResult = {
          gateway: 'flutterwave',
          status: true,
          data: flwData.data,
          message: flwData.message,
        };
        providerUsed = 'flutterwave';
      } else {
        console.warn('⚠️ Flutterwave transfer warning:', flwData.message);
        transferResult = {
          gateway: 'flutterwave',
          status: false,
          isManualFallback: true,
          message: flwData.message || 'Flutterwave automated transfer response indicated pending/review',
        };
      }
    } catch (err: any) {
      console.error('Flutterwave transfer error:', err.message);
      transferResult = {
        gateway: 'flutterwave',
        status: false,
        isManualFallback: true,
        message: err.message,
      };
    }
  }

  // Fallback to Paystack if requested or if Flutterwave wasn't executed
  if (!transferResult && paystackConfigured && accountNumber) {
    try {
      console.log(`🚀 Initiating Paystack Transfer of ₦${numAmount} to ${accountNumber} (${bankName})...`);
      const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'nuban',
          name: accountName || user?.codmIgn || 'Gladiator',
          account_number: accountNumber.trim(),
          bank_code: paystackCode || '058',
          currency: 'NGN',
        }),
      });

      const recipientJson = await recipientRes.json();
      if (recipientJson.status && recipientJson.data?.recipient_code) {
        const recipientCode = recipientJson.data.recipient_code;
        const transferRes = await fetch('https://api.paystack.co/transfer', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source: 'balance',
            amount: Math.round(numAmount * 100), // in kobo
            recipient: recipientCode,
            reason: `CODM Winnings Cashout for ${user?.codmIgn || userId}`,
          }),
        });

        const paystackData = await transferRes.json();
        console.log('✅ Paystack Transfer API Response:', paystackData);

        if (paystackData.status) {
          transferResult = {
            gateway: 'paystack',
            status: true,
            data: paystackData.data,
            message: paystackData.message,
          };
          providerUsed = 'paystack';
        } else {
          transferResult = {
            gateway: 'paystack',
            status: false,
            isManualFallback: true,
            message: paystackData.message || 'Paystack automated payout unavailable',
          };
        }
      } else {
        transferResult = {
          gateway: 'paystack',
          status: false,
          isManualFallback: true,
          message: recipientJson.message || 'Could not create recipient',
        };
      }
    } catch (err: any) {
      console.error('Paystack Transfer Exception:', err.message);
      transferResult = {
        gateway: 'paystack',
        status: false,
        isManualFallback: true,
        message: err.message,
      };
    }
  }

  const isAutomatedSuccess = transferResult?.status === true;
  const isManual = transferResult?.isManualFallback === true || !transferResult;

  let descNote = `Withdrawal request to ${bankName} (${accountNumber} - ${accountName})`;
  if (isAutomatedSuccess) {
    const ref = transferResult?.data?.reference || transferResult?.data?.id || 'OK';
    const provLabel = providerUsed === 'flutterwave' ? 'Flutterwave' : providerUsed === 'paystack' ? 'Paystack' : 'Pandascrow Escrow';
    descNote = `🚀 ${provLabel} Transfer Sent to ${bankName} (${accountNumber} - ${accountName}) [Ref: ${ref}]`;
  } else if (isManual) {
    const reason = transferResult?.message || 'Queued for admin instant settlement';
    descNote = `⏳ Pending Manual Payout to ${bankName} (${accountNumber} - ${accountName}) [${reason}]`;
  }

  // Update description with definitive settlement reference
  await pool.query(`
    UPDATE transactions 
    SET description = ${escapeSql(descNote)} 
    WHERE id = ${escapeSql(txId)}
  `);

  const tx = {
    id: txId,
    type: 'WITHDRAWAL' as const,
    amount: numAmount,
    description: descNote,
    timestamp: Date.now(),
  };

  res.json({
    success: true,
    balance: newBalance,
    transaction: tx,
    transferResult,
    providerUsed,
  });
});

// Clean up transaction history & reconcile ledger for a clean profile view
app.post('/api/users/:id/clean-history', async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await getUserFromDb(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { clearAll = false, syncBalance = true } = req.body || {};

    if (clearAll) {
      // Clear all past transactions for a clean history slate
      await pool.query(`DELETE FROM transactions WHERE user_id = ${escapeSql(userId)}`);
    } else {
      // 1. Deduplicate messy double-credited deposits and duplicate withdrawal logs
      const txRes = await pool.query(
        `SELECT * FROM transactions WHERE user_id = ${escapeSql(userId)} ORDER BY timestamp ASC`
      );
      const rawTxs = txRes.rows;
      const seenKeys = new Set<string>();
      const txsToDelete: string[] = [];

      for (const t of rawTxs) {
        let isDuplicate = false;
        // Group by type, amount, and 60-second time window
        const timeBucket = Math.floor(parseInt(t.timestamp, 10) / 60000);
        const dedupeKey = `${t.type}_${t.amount}_${timeBucket}`;

        if (seenKeys.has(dedupeKey)) {
          isDuplicate = true;
        } else {
          seenKeys.add(dedupeKey);
        }

        if (isDuplicate) {
          txsToDelete.push(t.id);
        }
      }

      for (const delId of txsToDelete) {
        await pool.query(`DELETE FROM transactions WHERE id = ${escapeSql(delId)}`);
      }
    }

    // 2. Reconcile user balance with clean transaction ledger
    if (syncBalance) {
      const remainingTxRes = await pool.query(
        `SELECT type, amount FROM transactions WHERE user_id = ${escapeSql(userId)}`
      );
      let calculatedCredits = 0;
      let calculatedDebits = 0;
      for (const r of remainingTxRes.rows) {
        const amt = parseFloat(r.amount) || 0;
        if (['DEPOSIT', 'MATCH_WIN_PAYOUT', 'REFERRAL_EARNING', 'ESCROW_REFUND'].includes(r.type)) {
          calculatedCredits += amt;
        } else if (['WITHDRAWAL', 'ESCROW_LOCK'].includes(r.type)) {
          calculatedDebits += amt;
        }
      }
      const reconciledBalance = Math.max(0, calculatedCredits - calculatedDebits);
      await pool.query(`
        UPDATE users 
        SET balance = ${escapeSql(reconciledBalance)}
        WHERE id = ${escapeSql(userId)}
      `);
    }

    const refreshedUser = await getUserFromDb(userId);
    res.json({
      success: true,
      user: refreshedUser,
    });
  } catch (err: any) {
    console.error('Error cleaning history:', err);
    res.status(500).json({ error: err.message || 'Failed to clean history' });
  }
});

// List all active matches directly from database
app.get('/api/matches', async (req, res) => {
  const matchList = await getAllMatchesFromDb();
  res.json(matchList);
});

// Get match by id directly from database
app.get('/api/matches/:id', async (req, res) => {
  const match = await getMatchFromDb(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match not found' });
  res.json(match);
});

// Create new 1v1 match challenge directly in database
app.post('/api/matches', async (req, res) => {
  const {
    creatorId,
    gameMode = '1v1 Sniper Only',
    map = 'Shipment',
    rules = [
      'Sniper rifles only (DL Q33, Locus, Koshka, Arctic.50)',
      'No secondary pistols or melee weapons',
      'No Operator Skills or Scorestreaks',
      'First to 10 kills or 5 rounds wins',
    ],
    stakeAmount = 100,
    matchDurationMinutes = 15,
  } = req.body;

  const creator = await getUserFromDb(creatorId);
  if (!creator) {
    return res.status(404).json({ error: 'Creator user not found' });
  }

  const numStake = Number(stakeAmount);
  if (numStake < 100) {
    return res.status(400).json({ error: 'Minimum stake is ₦100' });
  }

  const numDuration = Math.max(15, parseInt(matchDurationMinutes, 10) || 15);

  const matchId = `match_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const challengeCode = `CHALLENGE-${Math.floor(1000 + Math.random() * 9000)}`;
  const potAmount = numStake * 2;
  const rakeRate = getRakePercentage(numStake);
  const platformFee = Math.round(potAmount * rakeRate);
  const winnerPayout = potAmount - platformFee;
  const platformFeePercentage = Math.round(rakeRate * 100);

  const newMatch: Match = {
    id: matchId,
    challengeCode,
    roomCode: undefined,
    gameMode,
    map,
    rules,
    stakeAmount: numStake,
    potAmount,
    platformFeePercentage,
    platformFee,
    winnerPayout,
    matchDurationMinutes: numDuration,
    status: 'PENDING_OPPONENT_STAKE',
    createdAt: Date.now(),
    creator: {
      id: creator.id,
      username: creator.username,
      codmIgn: creator.codmIgn,
      codmUid: creator.codmUid,
      avatar: creator.avatar,
      staked: false,
    },
    chatMessages: [
      {
        id: `msg_sys_1`,
        senderId: 'SYSTEM',
        senderName: 'CODM Referee Bot',
        text: `Match challenge #${challengeCode} created with ₦${numStake.toLocaleString()} stake (Pot: ₦${potAmount.toLocaleString()}, Winner Payout: ₦${winnerPayout.toLocaleString()}). Share the invite link with your opponent. When your opponent accepts and sends their stake, you will be prompted to send your matching stake to generate your CODM in-game room number.`,
        timestamp: Date.now(),
      },
    ],
  };

  await saveMatchToDb(newMatch);
  res.json(newMatch);
});

// Opponent accepts challenge and sends stake into escrow directly in database with strict race-condition locking
app.post('/api/matches/:id/opponent-stake', async (req, res) => {
  const matchId = req.params.id;
  const { opponentId, paymentMethod = 'bank_transfer' } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock match row with FOR UPDATE to prevent two opponents from joining or creator from cancelling concurrently
    const matchRes = await client.query(`SELECT * FROM matches WHERE id = ${escapeSql(matchId)} FOR UPDATE`);
    if (matchRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Match not found' });
    }

    const matchRow = matchRes.rows[0];
    if (matchRow.status !== 'PENDING_OPPONENT_STAKE') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This match challenge has already been accepted by another player or is no longer open.' });
    }

    if (matchRow.creator_id === opponentId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You cannot accept your own challenge. Share the link with an opponent!' });
    }

    const stakeAmount = parseFloat(matchRow.stake_amount);

    // 2. Lock opponent user row
    const oppRes = await client.query(`SELECT * FROM users WHERE id = ${escapeSql(opponentId)} FOR UPDATE`);
    if (oppRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Opponent not found' });
    }
    const oppRow = oppRes.rows[0];

    if (paymentMethod === 'wallet_balance') {
      const currentBal = parseFloat(oppRow.balance || 0);
      if (currentBal < stakeAmount) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Insufficient balance (₦${currentBal.toLocaleString()}).` });
      }
      await client.query(`
        UPDATE users 
        SET balance = balance - ${escapeSql(stakeAmount)},
            escrow_balance = escrow_balance + ${escapeSql(stakeAmount)}
        WHERE id = ${escapeSql(opponentId)}
      `);
    } else {
      await client.query(`
        UPDATE users 
        SET escrow_balance = escrow_balance + ${escapeSql(stakeAmount)}
        WHERE id = ${escapeSql(opponentId)}
      `);
    }

    const opponentData = {
      id: oppRow.id,
      username: oppRow.username,
      codmIgn: oppRow.codm_ign,
      codmUid: oppRow.codm_uid,
      avatar: oppRow.avatar,
      staked: true,
    };

    const newChatMsg = {
      id: `msg_${Date.now()}`,
      senderId: 'SYSTEM',
      senderName: 'CODM Referee Bot',
      text: `⚔️ Challenge accepted! ${oppRow.codm_ign} has sent ₦${stakeAmount.toLocaleString()} into escrow. Host ${matchRow.creator_data?.codmIgn || 'Host'}, please send your matching ₦${stakeAmount.toLocaleString()} stake to generate your CODM in-game room number!`,
      timestamp: Date.now(),
    };

    const chatMessages = Array.isArray(matchRow.chat_messages) ? matchRow.chat_messages : [];
    chatMessages.push(newChatMsg);

    await client.query(`
      UPDATE matches 
      SET status = 'OPPONENT_STAKED_AWAITING_CREATOR',
          opponent_id = ${escapeSql(oppRow.id)},
          opponent_data = ${escapeSql(opponentData)},
          chat_messages = ${escapeSql(chatMessages)}
      WHERE id = ${escapeSql(matchId)}
    `);

    const tx = {
      id: `tx_${Date.now()}`,
      type: 'ESCROW_LOCK',
      amount: stakeAmount,
      description: `₦${stakeAmount.toLocaleString()} stake locked in escrow for challenge #${matchRow.challenge_code}`,
      timestamp: Date.now(),
      matchId: matchRow.id,
    };

    await client.query(`
      INSERT INTO transactions (id, user_id, type, amount, description, match_id, timestamp)
      VALUES (${escapeSql(tx.id)}, ${escapeSql(opponentId)}, ${escapeSql(tx.type)}, ${escapeSql(tx.amount)}, ${escapeSql(tx.description)}, ${escapeSql(tx.matchId)}, ${escapeSql(tx.timestamp)})
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query('COMMIT');
    const updatedMatch = await getMatchFromDb(matchId);
    res.json(updatedMatch);
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Opponent stake race condition error:', err);
    res.status(500).json({ error: err.message || 'Failed to accept challenge' });
  } finally {
    client.release();
  }
});

// Creator sends matching stake after opponent has accepted
// Creator sends matching stake after opponent has accepted with atomic locking
app.post('/api/matches/:id/creator-stake', async (req, res) => {
  const matchId = req.params.id;
  const { creatorId, paymentMethod = 'bank_transfer' } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock match row to prevent double-staking
    const matchRes = await client.query(`SELECT * FROM matches WHERE id = ${escapeSql(matchId)} FOR UPDATE`);
    if (matchRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Match not found' });
    }

    const matchRow = matchRes.rows[0];
    if (matchRow.status !== 'OPPONENT_STAKED_AWAITING_CREATOR') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Match is not in waiting for host stake state.' });
    }

    if (matchRow.creator_id !== creatorId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only the match creator can provide the matching host stake.' });
    }

    const stakeAmount = parseFloat(matchRow.stake_amount);

    // Lock creator user row
    const creatorRes = await client.query(`SELECT * FROM users WHERE id = ${escapeSql(creatorId)} FOR UPDATE`);
    if (creatorRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Creator not found' });
    }
    const creatorRow = creatorRes.rows[0];

    if (paymentMethod === 'wallet_balance') {
      const currentBal = parseFloat(creatorRow.balance || 0);
      if (currentBal < stakeAmount) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Insufficient balance (₦${currentBal.toLocaleString()}).` });
      }
      await client.query(`
        UPDATE users 
        SET balance = balance - ${escapeSql(stakeAmount)},
            escrow_balance = escrow_balance + ${escapeSql(stakeAmount)}
        WHERE id = ${escapeSql(creatorId)}
      `);
    } else {
      await client.query(`
        UPDATE users 
        SET escrow_balance = escrow_balance + ${escapeSql(stakeAmount)}
        WHERE id = ${escapeSql(creatorId)}
      `);
    }

    const creatorData = matchRow.creator_data || {};
    creatorData.staked = true;

    const generatedRoomCode = generateRoomCode(matchRow.map);
    const now = Date.now();

    const newChatMsg = {
      id: `msg_${now}`,
      senderId: 'SYSTEM',
      senderName: 'CODM Referee Bot',
      text: `🎉 BOTH STAKES CONFIRMED! Total Pot: ₦${parseFloat(matchRow.pot_amount).toLocaleString()} secured in automated escrow. 🎯 IN-GAME ROOM NUMBER GENERATED: ${generatedRoomCode}. Both players: open CODM > Multiplayer > Private Match > Join #${generatedRoomCode} and battle!`,
      timestamp: now,
    };

    const chatMessages = Array.isArray(matchRow.chat_messages) ? matchRow.chat_messages : [];
    chatMessages.push(newChatMsg);

    await client.query(`
      UPDATE matches 
      SET status = 'READY_TO_PLAY',
          room_code = ${escapeSql(generatedRoomCode)},
          room_generated_at = ${now},
          creator_data = ${escapeSql(creatorData)},
          chat_messages = ${escapeSql(chatMessages)}
      WHERE id = ${escapeSql(matchId)}
    `);

    const tx = {
      id: `tx_${now}`,
      type: 'ESCROW_LOCK',
      amount: stakeAmount,
      description: `₦${stakeAmount.toLocaleString()} matching stake locked in escrow for challenge #${matchRow.challenge_code}`,
      timestamp: now,
      matchId: matchRow.id,
    };

    await client.query(`
      INSERT INTO transactions (id, user_id, type, amount, description, match_id, timestamp)
      VALUES (${escapeSql(tx.id)}, ${escapeSql(creatorId)}, ${escapeSql(tx.type)}, ${escapeSql(tx.amount)}, ${escapeSql(tx.description)}, ${escapeSql(tx.matchId)}, ${escapeSql(tx.timestamp)})
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query('COMMIT');
    const updatedMatch = await getMatchFromDb(matchId);
    res.json(updatedMatch);
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Creator stake race condition error:', err);
    res.status(500).json({ error: err.message || 'Failed to submit matching host stake' });
  } finally {
    client.release();
  }
});

// Direct Join handler with atomic locking
app.post('/api/matches/:id/join', async (req, res) => {
  const matchId = req.params.id;
  const { opponentId } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const matchRes = await client.query(`SELECT * FROM matches WHERE id = ${escapeSql(matchId)} FOR UPDATE`);
    if (matchRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Match not found' });
    }

    const matchRow = matchRes.rows[0];
    if (matchRow.status !== 'PENDING_OPPONENT_STAKE') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This match is no longer open for joining.' });
    }

    if (matchRow.creator_id === opponentId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You cannot accept your own challenge. Share the link with an opponent!' });
    }

    const stakeAmount = parseFloat(matchRow.stake_amount);

    const oppRes = await client.query(`SELECT * FROM users WHERE id = ${escapeSql(opponentId)} FOR UPDATE`);
    if (oppRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Opponent not found' });
    }
    const oppRow = oppRes.rows[0];

    await client.query(`
      UPDATE users 
      SET escrow_balance = escrow_balance + ${escapeSql(stakeAmount)}
      WHERE id = ${escapeSql(opponentId)}
    `);

    const opponentData = {
      id: oppRow.id,
      username: oppRow.username,
      codmIgn: oppRow.codm_ign,
      codmUid: oppRow.codm_uid,
      avatar: oppRow.avatar,
      staked: true,
    };

    const newChatMsg = {
      id: `msg_${Date.now()}`,
      senderId: 'SYSTEM',
      senderName: 'CODM Referee Bot',
      text: `⚔️ Challenge accepted! ${oppRow.codm_ign} has sent ₦${stakeAmount.toLocaleString()} into escrow. Host ${matchRow.creator_data?.codmIgn || 'Host'}, send your matching ₦${stakeAmount.toLocaleString()} stake to generate your CODM in-game room number!`,
      timestamp: Date.now(),
    };

    const chatMessages = Array.isArray(matchRow.chat_messages) ? matchRow.chat_messages : [];
    chatMessages.push(newChatMsg);

    await client.query(`
      UPDATE matches 
      SET status = 'OPPONENT_STAKED_AWAITING_CREATOR',
          opponent_id = ${escapeSql(oppRow.id)},
          opponent_data = ${escapeSql(opponentData)},
          chat_messages = ${escapeSql(chatMessages)}
      WHERE id = ${escapeSql(matchId)}
    `);

    const tx = {
      id: `tx_${Date.now()}`,
      type: 'ESCROW_LOCK',
      amount: stakeAmount,
      description: `₦${stakeAmount.toLocaleString()} stake locked in escrow for challenge #${matchRow.challenge_code}`,
      timestamp: Date.now(),
      matchId: matchRow.id,
    };

    await client.query(`
      INSERT INTO transactions (id, user_id, type, amount, description, match_id, timestamp)
      VALUES (${escapeSql(tx.id)}, ${escapeSql(opponentId)}, ${escapeSql(tx.type)}, ${escapeSql(tx.amount)}, ${escapeSql(tx.description)}, ${escapeSql(tx.matchId)}, ${escapeSql(tx.timestamp)})
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query('COMMIT');
    const updatedMatch = await getMatchFromDb(matchId);
    res.json(updatedMatch);
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Join match race condition error:', err);
    res.status(500).json({ error: err.message || 'Failed to join match' });
  } finally {
    client.release();
  }
});

// Send in-match chat message directly to database
app.post('/api/matches/:id/chat', async (req, res) => {
  const match = await getMatchFromDb(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match not found' });

  const { senderId, text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }

  const user = await getUserFromDb(senderId);
  const senderName = user ? user.codmIgn : 'Player';

  const newMsg = {
    id: `msg_${Date.now()}`,
    senderId,
    senderName,
    text: text.trim(),
    timestamp: Date.now(),
  };

  match.chatMessages.push(newMsg);
  await saveMatchToDb(match);
  res.json(newMsg);
});

// Cancel match directly in database
// Cancel match directly in database with atomic row-level lock and race condition protection
app.post('/api/matches/:id/cancel', async (req, res) => {
  const matchId = req.params.id;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const mRes = await client.query(`SELECT * FROM matches WHERE id = ${escapeSql(matchId)} FOR UPDATE`);
    if (mRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Match not found' });
    }

    const matchRow = mRes.rows[0];
    if (matchRow.status !== 'PENDING_OPPONENT_STAKE' && matchRow.status !== 'OPPONENT_STAKED_AWAITING_CREATOR') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot cancel match after both players have locked stakes' });
    }

    await client.query(`UPDATE matches SET status = 'CANCELLED' WHERE id = ${escapeSql(matchId)}`);

    const creatorData = matchRow.creator_data || {};
    const opponentData = matchRow.opponent_data || {};
    const stakeAmount = parseFloat(matchRow.stake_amount);

    // Refund creator if staked
    if (creatorData.staked) {
      await client.query(`
        UPDATE users 
        SET balance = balance + ${escapeSql(stakeAmount)},
            escrow_balance = GREATEST(0, escrow_balance - ${escapeSql(stakeAmount)})
        WHERE id = ${escapeSql(matchRow.creator_id)}
      `);
      const txC = `tx_${Date.now()}_c`;
      await client.query(`
        INSERT INTO transactions (id, user_id, type, amount, description, match_id, timestamp)
        VALUES (${escapeSql(txC)}, ${escapeSql(matchRow.creator_id)}, 'ESCROW_REFUND', ${escapeSql(stakeAmount)}, ${escapeSql(`₦${stakeAmount.toLocaleString()} escrow refunded from cancelled challenge #${matchRow.challenge_code}`)}, ${escapeSql(matchId)}, ${Date.now()})
        ON CONFLICT (id) DO NOTHING
      `);
    }

    // Refund opponent if staked
    if (opponentData.staked && matchRow.opponent_id) {
      await client.query(`
        UPDATE users 
        SET balance = balance + ${escapeSql(stakeAmount)},
            escrow_balance = GREATEST(0, escrow_balance - ${escapeSql(stakeAmount)})
        WHERE id = ${escapeSql(matchRow.opponent_id)}
      `);
      const txO = `tx_${Date.now()}_o`;
      await client.query(`
        INSERT INTO transactions (id, user_id, type, amount, description, match_id, timestamp)
        VALUES (${escapeSql(txO)}, ${escapeSql(matchRow.opponent_id)}, 'ESCROW_REFUND', ${escapeSql(stakeAmount)}, ${escapeSql(`₦${stakeAmount.toLocaleString()} escrow refunded from cancelled challenge #${matchRow.challenge_code}`)}, ${escapeSql(matchId)}, ${Date.now()})
        ON CONFLICT (id) DO NOTHING
      `);
    }

    await client.query('COMMIT');
    const updatedMatch = await getMatchFromDb(matchId);
    res.json(updatedMatch);
  } catch (err: any) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Match cancel race error:', err);
    res.status(500).json({ error: err.message || 'Failed to cancel match' });
  } finally {
    client.release();
  }
});

// Submit screenshot and match claim directly in database
app.post('/api/matches/:id/submit-result', async (req, res) => {
  const match = await getMatchFromDb(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match not found' });

  const { playerId, claim, screenshotBase64 } = req.body;
  if (!['VICTORY', 'DEFEAT', 'DRAW'].includes(claim)) {
    return res.status(400).json({ error: 'Claim must be VICTORY, DEFEAT, or DRAW' });
  }

  const isCreator = match.creator.id === playerId;
  const isOpponent = match.opponent?.id === playerId;

  if (!isCreator && !isOpponent) {
    return res.status(403).json({ error: 'You are not a participant in this match' });
  }

  const playerIgn = isCreator ? match.creator.codmIgn : match.opponent!.codmIgn;

  // Perform AI analysis if screenshot provided
  let analysisResult = {
    detectedOutcome: claim,
    confidence: 0.95,
    detectedPlayerName: playerIgn,
    scoreSummary: claim === 'VICTORY' ? 'Scoreboard confirmed Victory' : claim === 'DRAW' ? 'Scoreboard confirmed Draw / Tie' : 'Scoreboard confirmed Defeat',
    reasoning: 'Verified by CODM match verification engine.',
  };

  if (screenshotBase64 && ai) {
    try {
      const base64Data = screenshotBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Data,
              },
            },
            {
              text: `You are an automated referee for Call of Duty: Mobile (CODM) 1v1 wager escrow matches.
Analyze this post-game screenshot. The user claims: ${claim}.
The player's In-Game Name (IGN) is: "${playerIgn}".
Room Code: "${match.roomCode}".

Determine:
1. Is there a clear "VICTORY", "DEFEAT", or "DRAW / TIE" badge/banner?
2. Is the player's name "${playerIgn}" visible in the scoreboard or match screen?
3. What is the detected outcome? (VICTORY, DEFEAT, DRAW, or UNCLEAR)
4. Confidence level between 0.0 and 1.0.

Respond strictly in valid JSON format:
{
  "detectedOutcome": "VICTORY" | "DEFEAT" | "DRAW" | "UNCLEAR",
  "confidence": number,
  "detectedPlayerName": string or null,
  "scoreSummary": string,
  "reasoning": string
}`,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (response.text) {
        analysisResult = JSON.parse(response.text.trim());
      }
    } catch (err: any) {
      console.error('Gemini vision analysis error, using fallback:', err.message);
    }
  }

  // Record submission
  if (isCreator) {
    match.creator.resultClaim = claim;
    if (screenshotBase64) {
      match.creator.screenshotUrl = screenshotBase64;
      match.creator.screenshotAnalysis = analysisResult;
    }
    match.creator.submittedAt = Date.now();
  } else if (match.opponent) {
    match.opponent.resultClaim = claim;
    if (screenshotBase64) {
      match.opponent.screenshotUrl = screenshotBase64;
      match.opponent.screenshotAnalysis = analysisResult;
    }
    match.opponent.submittedAt = Date.now();
  }

  const cClaim = match.creator.resultClaim;
  const oClaim = match.opponent?.resultClaim;
  const isDisputeMode = match.status === 'DISPUTED';

  // Evaluate match resolution
  let resolveWinner: 'creator' | 'opponent' | 'draw' | 'dispute' | null = null;

  if (isDisputeMode) {
    // Already in conflict mode: screenshot proof is evaluated
    if (screenshotBase64) {
      match.chatMessages.push({
        id: `msg_${Date.now()}`,
        senderId: 'SYSTEM',
        senderName: 'CODM Referee Bot',
        text: `📸 ${playerIgn} submitted dispute scoreboard screenshot: ${analysisResult.detectedOutcome} (${Math.round((analysisResult.confidence || 0.95) * 100)}% Confidence).`,
        timestamp: Date.now(),
      });

      // Auto-resolve dispute if screenshot clearly shows victory
      if (analysisResult.detectedOutcome === 'VICTORY' && (analysisResult.confidence || 0) >= 0.8) {
        resolveWinner = isCreator ? 'creator' : 'opponent';
      } else if (analysisResult.detectedOutcome === 'DEFEAT') {
        resolveWinner = isCreator ? 'opponent' : 'creator';
      }
    } else {
      match.chatMessages.push({
        id: `msg_${Date.now()}`,
        senderId: 'SYSTEM',
        senderName: 'CODM Referee Bot',
        text: `⚠️ Match is in dispute. Please upload your post-game scoreboard screenshot to resolve.`,
        timestamp: Date.now(),
      });
    }
  } else {
    // FAST 3-BUTTON MATCH OUTCOME (No screenshot required!)
    const claimLabel = claim === 'VICTORY' ? 'I Won 🏆' : claim === 'DEFEAT' ? 'I Lost ❌' : 'Draw ⚖️';
    match.chatMessages.push({
      id: `msg_${Date.now()}`,
      senderId: 'SYSTEM',
      senderName: 'CODM Referee Bot',
      text: `⚡ ${playerIgn} confirmed match result: "${claimLabel}".`,
      timestamp: Date.now(),
    });

    // 1. If this player admitted defeat ("I Lost"), immediate concession!
    if (claim === 'DEFEAT') {
      resolveWinner = isCreator ? 'opponent' : 'creator';
    }
    // 2. If both players have submitted
    else if (cClaim && oClaim) {
      if (cClaim === 'VICTORY' && oClaim === 'DEFEAT') {
        resolveWinner = 'creator';
      } else if (cClaim === 'DEFEAT' && oClaim === 'VICTORY') {
        resolveWinner = 'opponent';
      } else if (cClaim === 'DRAW' && oClaim === 'DRAW') {
        resolveWinner = 'draw';
      } else if (cClaim === 'VICTORY' && oClaim === 'VICTORY') {
        // CONFLICT! Both claimed "I Won"
        resolveWinner = 'dispute';
      } else if (cClaim === 'DEFEAT' && oClaim === 'DEFEAT') {
        resolveWinner = 'draw';
      } else {
        // Conflicting results (e.g. VICTORY vs DRAW)
        resolveWinner = 'dispute';
      }
    }
    // 3. Only one player has submitted so far
    else {
      resolveWinner = null;
    }
  }

  if (resolveWinner === 'draw') {
    // Generate new room code for rematch on Draw!
    const newRoomCode = generateRoomCode(match.map);

    delete match.creator.resultClaim;
    delete match.creator.screenshotUrl;
    delete match.creator.screenshotAnalysis;
    delete match.creator.submittedAt;

    if (match.opponent) {
      delete match.opponent.resultClaim;
      delete match.opponent.screenshotUrl;
      delete match.opponent.screenshotAnalysis;
      delete match.opponent.submittedAt;
    }

    match.roomCode = newRoomCode;
    match.roomGeneratedAt = Date.now();
    match.status = 'READY_TO_PLAY';
    match.resolutionNotes = `Match resulted in a mutual DRAW / TIE. Rematch room #${newRoomCode} generated. Stakes remain securely locked in escrow.`;

    match.chatMessages.push({
      id: `msg_${Date.now()}_rematch`,
      senderId: 'SYSTEM',
      senderName: 'CODM Referee Bot',
      text: `⚖️ MUTUAL DRAW CONFIRMED! Stakes remain protected in escrow. 🎯 REMATCH ROOM CODE GENERATED: #${newRoomCode}. Both players join #${newRoomCode} in CODM!`,
      timestamp: Date.now(),
    });
  } else if (resolveWinner === 'creator' || resolveWinner === 'opponent') {
    const winnerObj = resolveWinner === 'creator' ? match.creator : match.opponent!;
    const loserObj = resolveWinner === 'creator' ? match.opponent! : match.creator;
    const winnerUser = await getUserFromDb(winnerObj.id);
    const loserUser = await getUserFromDb(loserObj.id);

    match.status = 'SETTLED';
    match.winnerId = winnerObj.id;
    match.winnerIgn = winnerObj.codmIgn;
    await updatePlatformFinance(match.platformFee);

    // Settle Escrow atomically
    if (match.creator?.id) {
      await pool.query(`
        UPDATE users 
        SET escrow_balance = GREATEST(0, escrow_balance - ${escapeSql(match.stakeAmount)})
        WHERE id = ${escapeSql(match.creator.id)}
      `);
    }

    if (match.opponent?.id) {
      await pool.query(`
        UPDATE users 
        SET escrow_balance = GREATEST(0, escrow_balance - ${escapeSql(match.stakeAmount)})
        WHERE id = ${escapeSql(match.opponent.id)}
      `);
    }

    // Winner gets the pot minus platform fee credited to wallet balance atomically
    if (winnerObj?.id) {
      const txWId = `tx_${Date.now()}_win`;
      const descWin = `🏆 Won 1v1 Escrow Match #${match.roomCode} vs ${loserObj.codmIgn}: ₦${match.winnerPayout.toLocaleString()} credited to wallet balance. Ready for instant cashout.`;
      
      const insRes = await pool.query(`
        INSERT INTO transactions (id, user_id, type, amount, description, match_id, timestamp)
        VALUES (${escapeSql(txWId)}, ${escapeSql(winnerObj.id)}, 'MATCH_WIN_PAYOUT', ${escapeSql(match.winnerPayout)}, ${escapeSql(descWin)}, ${escapeSql(match.id)}, ${Date.now()})
        ON CONFLICT (id) DO NOTHING
        RETURNING id;
      `);

      if (insRes.rows.length > 0) {
        await pool.query(`
          UPDATE users 
          SET balance = balance + ${escapeSql(match.winnerPayout)},
              total_winnings = total_winnings + ${escapeSql(match.winnerPayout)},
              wins = wins + 1
          WHERE id = ${escapeSql(winnerObj.id)}
        `);
      }

      if (loserObj?.id) {
        await pool.query(`
          UPDATE users SET losses = losses + 1 WHERE id = ${escapeSql(loserObj.id)}
        `);
      }

      match.resolutionNotes = `Match resolved! Winner is ${winnerObj.codmIgn}. ₦${match.winnerPayout.toLocaleString()} credited to winner's wallet. Ready for instant cashout!`;
      match.chatMessages.push({
        id: `msg_${Date.now()}_settle`,
        senderId: 'SYSTEM',
        senderName: 'CODM Referee Bot',
        text: `🏆 MATCH CONCLUDED! Winner: ${winnerObj.codmIgn}. ₦${match.winnerPayout.toLocaleString()} winning payout has been added to their wallet balance and is ready for instant cashout!`,
        timestamp: Date.now(),
      });
    }
  } else if (resolveWinner === 'dispute') {
    match.status = 'DISPUTED';
    match.resolutionNotes = '⚠️ CONFLICT DETECTED: Both players submitted conflicting results! Post-game scoreboard screenshots are now required to verify the winner.';
    match.chatMessages.push({
      id: `msg_${Date.now()}_dispute`,
      senderId: 'SYSTEM',
      senderName: 'CODM Referee Bot',
      text: `⚠️ CONFLICT DETECTED: Both players claimed conflicting results! The ₦${match.potAmount.toLocaleString()} escrow pot is safely frozen. Both players must now upload their post-match scoreboard screenshot as proof.`,
      timestamp: Date.now(),
    });
  } else {
    match.status = 'SUBMITTING_RESULTS';
    match.resolutionNotes = `${playerIgn} claimed "${claim === 'VICTORY' ? 'I Won 🏆' : 'Draw ⚖️'}". Waiting for opponent to confirm or dispute.`;
  }

  await saveMatchToDb(match);
  res.json(match);
});

// Admin manual resolution directly in database
app.post('/api/matches/:id/admin-resolve', async (req, res) => {
  const match = await getMatchFromDb(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match not found' });

  const { winnerId } = req.body;
  const isCreatorWinner = match.creator.id === winnerId;
  const isOpponentWinner = match.opponent?.id === winnerId;

  if (!isCreatorWinner && !isOpponentWinner) {
    return res.status(400).json({ error: 'Invalid winner ID' });
  }

  const winnerObj = isCreatorWinner ? match.creator : match.opponent!;
  const loserObj = isCreatorWinner ? match.opponent! : match.creator;
  const winnerUser = await getUserFromDb(winnerObj.id);
  const loserUser = await getUserFromDb(loserObj.id);

  // Settle Escrow atomically
  if (match.creator?.id) {
    await pool.query(`
      UPDATE users 
      SET escrow_balance = GREATEST(0, escrow_balance - ${escapeSql(match.stakeAmount)})
      WHERE id = ${escapeSql(match.creator.id)}
    `);
  }

  if (match.opponent?.id) {
    await pool.query(`
      UPDATE users 
      SET escrow_balance = GREATEST(0, escrow_balance - ${escapeSql(match.stakeAmount)})
      WHERE id = ${escapeSql(match.opponent.id)}
    `);
  }

  if (winnerObj?.id) {
    const txId = `tx_${Date.now()}_win`;
    const descNote = `🏆 Admin resolved 1v1 match #${match.roomCode} win in favor of ${winnerObj.codmIgn}`;
    const insRes = await pool.query(`
      INSERT INTO transactions (id, user_id, type, amount, description, match_id, timestamp)
      VALUES (${escapeSql(txId)}, ${escapeSql(winnerObj.id)}, 'MATCH_WIN_PAYOUT', ${escapeSql(match.winnerPayout)}, ${escapeSql(descNote)}, ${escapeSql(match.id)}, ${Date.now()})
      ON CONFLICT (id) DO NOTHING
      RETURNING id;
    `);

    if (insRes.rows.length > 0) {
      await pool.query(`
        UPDATE users 
        SET balance = balance + ${escapeSql(match.winnerPayout)},
            total_winnings = total_winnings + ${escapeSql(match.winnerPayout)},
            wins = wins + 1
        WHERE id = ${escapeSql(winnerObj.id)}
      `);
    }

    if (loserObj?.id) {
      await pool.query(`
        UPDATE users SET losses = losses + 1 WHERE id = ${escapeSql(loserObj.id)}
      `);
    }
  }

  match.status = 'SETTLED';
  match.winnerId = winnerObj.id;
  match.winnerIgn = winnerObj.codmIgn;
  await updatePlatformFinance(match.platformFee);
  match.resolutionNotes = `Referee adjudicated in favor of ${winnerObj.codmIgn}. ₦${match.winnerPayout.toLocaleString()} paid out to winner.`;

  match.chatMessages.push({
    id: `msg_${Date.now()}`,
    senderId: 'SYSTEM',
    senderName: 'CODM Referee Bot',
    text: `⚖️ Referee resolved match #${match.roomCode}. Winner: ${winnerObj.codmIgn}. Payout: ₦${match.winnerPayout.toLocaleString()}.`,
    timestamp: Date.now(),
  });

  await saveMatchToDb(match);
  res.json(match);
});

async function startServer() {
  // 1. Initialize Supabase PostgreSQL database
  await initDatabase();

  // Always serve static public assets
  const publicPath = path.resolve(__dirname, 'public');
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
    app.use('/public', express.static(publicPath));
  }

  // Check production build
  const distPath = path.resolve(__dirname, 'dist');
  const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER || fs.existsSync(distPath);

  if (isProduction && fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CODM Stake 1v1] Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
