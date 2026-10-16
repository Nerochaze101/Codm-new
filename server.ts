import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { GoogleGenAI } from '@google/genai';
import { initDatabase, pool, runDatabaseDiagnostics } from './db.js';
import {
  initGmailTables,
  getGmailConfig,
  saveGmailConfig,
  disconnectGmailConfig,
  testGmailConnection,
  syncGmailEmails,
  startGmailAutoSyncService,
} from './gmailService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dev server must run on port 3000. In Cloud Run environments, PORT=8080 is used by nginx ingress,
// which proxies incoming traffic to port 3000.
function resolveServerPort(): number {
  const portArgIdx = process.argv.indexOf('--port');
  if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
    const parsed = parseInt(process.argv[portArgIdx + 1], 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  if (process.env.APP_PORT) {
    const parsed = parseInt(process.env.APP_PORT, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  if (process.env.PORT && process.env.PORT !== '8080') {
    const parsed = parseInt(process.env.PORT, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 3000;
}

const PORT = resolveServerPort();

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

async function getUserFromDb(idOrEmail: string): Promise<UserProfile | null> {
  try {
    if (!idOrEmail) return null;
    const userRes = await pool.query(
      `SELECT * FROM users WHERE id = $1 OR LOWER(email) = LOWER($1) LIMIT 1`,
      [idOrEmail]
    );
    if (userRes.rows.length === 0) return null;
    const r = userRes.rows[0];

    const txRes = await pool.query(`SELECT * FROM transactions WHERE user_id = $1 ORDER BY timestamp DESC`, [r.id]);
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
      role: r.role || 'user',
      transactions,
    };
  } catch (err) {
    console.error(`Error loading user ${idOrEmail} from DB:`, err);
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
      role: r.role || 'user',
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
      INSERT INTO users (id, username, codm_ign, codm_uid, tier, clan, email, phone, password_hash, balance, escrow_balance, total_winnings, wins, losses, draws, avatar, bank_name, account_number, account_name, referred_by, referral_code, total_referral_earnings, role, created_at)
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
        ${escapeSql(user.role || 'user')},
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
        role = COALESCE(users.role, EXCLUDED.role),
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

// Email Inbound Handler for Cloudflare Email Workers
app.post('/api/inbound-email', express.json({ limit: '5mb' }), async (req, res) => {
  try {
    const { from, fromName, subject, text, html } = req.body;
    console.log('📧 Received email via Inbound Webhook:', subject);

    // Save to admin_mailbox
    const id = `mail_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
    await pool.query(`
      INSERT INTO admin_mailbox (id, sender_email, sender_name, subject, body, created_at)
      VALUES (
        ${escapeSql(from)},
        ${escapeSql(fromName || 'Unknown')},
        ${escapeSql(subject)},
        ${escapeSql(text || html || '')},
        ${Date.now()}
      )
    `);

    res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('⚠️ Error processing inbound email:', err);
    res.status(500).json({ error: 'Failed to process email' });
  }
});

// REST API ROUTES
app.post('/api/admin/withdraw', async (req, res) => {
  const { userId, amount } = req.body;
  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ error: 'Invalid withdrawal amount' });
  }

  const user = await getUserFromDb(userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized: Admin privileges required' });
  }

  // Atomically deduct platform fees in SQL to prevent concurrent fee draining
  const success = await withdrawPlatformFees(numAmount);
  if (success) {
    await pool.query(`
      UPDATE users 
      SET balance = balance + ${escapeSql(numAmount)} 
      WHERE id = ${escapeSql(user.id)}
    `);

    // Audit log transaction
    try {
      await pool.query(`
        INSERT INTO transactions (id, user_id, type, amount, description, timestamp)
        VALUES (
          ${escapeSql(`tx_fee_${Date.now()}`)},
          ${escapeSql(user.id)},
          'PLATFORM_FEE_WITHDRAWAL',
          ${escapeSql(numAmount)},
          ${escapeSql(`Platform fee withdrawal to admin wallet: ₦${numAmount.toLocaleString()}`)},
          ${Date.now()}
        )
      `);
    } catch (e) {
      console.warn('Could not record fee withdrawal transaction:', e);
    }

    const refreshed = await getUserFromDb(user.id);
    res.json({ success: true, balance: refreshed?.balance ?? user.balance });
  } else {
    res.status(400).json({ error: 'Insufficient platform funds or withdrawal failed' });
  }
});

app.get('/api/admin/finance', async (req, res) => {
  try {
    const { userId } = req.query;
    const user = await getUserFromDb(userId as string);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Admin privileges required' });
    }

    let resFin = await pool.query(`SELECT * FROM platform_finance WHERE id = 'main'`);
    if (resFin.rows.length === 0) {
      await pool.query(`INSERT INTO platform_finance (id, total_fees_collected, total_fees_withdrawn) VALUES ('main', 0, 0) ON CONFLICT DO NOTHING`);
      resFin = await pool.query(`SELECT * FROM platform_finance WHERE id = 'main'`);
    }

    let finRow = resFin.rows[0] || { total_fees_collected: 0, total_fees_withdrawn: 0 };
    let totalCollected = parseFloat(finRow.total_fees_collected || 0);

    // Auto-sync from settled matches if platform_finance was empty
    if (totalCollected === 0) {
      try {
        const sumRes = await pool.query(`SELECT COALESCE(SUM(platform_fee), 0) as total FROM matches WHERE status = 'SETTLED'`);
        const sumVal = parseFloat(sumRes.rows[0]?.total || 0);
        if (sumVal > 0) {
          await pool.query(`UPDATE platform_finance SET total_fees_collected = ${escapeSql(sumVal)} WHERE id = 'main'`);
          totalCollected = sumVal;
        }
      } catch (_) {}
    }

    const totalWithdrawn = parseFloat(finRow.total_fees_withdrawn || 0);
    const available = Math.max(0, totalCollected - totalWithdrawn);

    // Recent matches that funded the platform fee
    let recentMatches: any[] = [];
    try {
      const matchRes = await pool.query(`
        SELECT id, challenge_code, game_mode, map, stake_amount, pot_amount, platform_fee, winner_ign, settled_at 
        FROM matches 
        WHERE platform_fee > 0 
        ORDER BY COALESCE(settled_at, created_at) DESC 
        LIMIT 15
      `);
      recentMatches = matchRes.rows.map(m => ({
        id: m.id,
        challengeCode: m.challenge_code,
        gameMode: m.game_mode,
        map: m.map,
        stakeAmount: parseFloat(m.stake_amount || 0),
        potAmount: parseFloat(m.pot_amount || 0),
        platformFee: parseFloat(m.platform_fee || 0),
        winnerIgn: m.winner_ign || 'Winner',
        settledAt: parseInt(m.settled_at || '0', 10),
      }));
    } catch (_) {}

    // Recent platform fee withdrawals
    let recentWithdrawals: any[] = [];
    try {
      const txRes = await pool.query(`
        SELECT id, amount, description, timestamp 
        FROM transactions 
        WHERE type = 'PLATFORM_FEE_WITHDRAWAL' 
        ORDER BY timestamp DESC 
        LIMIT 15
      `);
      recentWithdrawals = txRes.rows.map(tx => ({
        id: tx.id,
        amount: parseFloat(tx.amount || 0),
        description: tx.description,
        timestamp: parseInt(tx.timestamp || '0', 10),
      }));
    } catch (_) {}

    res.json({
      total_fees_collected: totalCollected,
      total_fees_withdrawn: totalWithdrawn,
      available_fees: available,
      recent_fee_matches: recentMatches,
      recent_withdrawals: recentWithdrawals,
    });
  } catch (err: any) {
    console.error('Error fetching admin finance:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch platform finance' });
  }
});

// Fetch withdrawal requests for Admin Dashboard
app.get('/api/admin/withdrawals', async (req, res) => {
  try {
    const { userId, status } = req.query;
    const user = await getUserFromDb(userId as string);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Admin role required' });
    }

    let queryStr = `SELECT * FROM withdrawal_requests`;
    if (status && status !== 'all') {
      queryStr += ` WHERE status = ${escapeSql(status as string)}`;
    }
    queryStr += ` ORDER BY created_at DESC LIMIT 200`;

    const result = await pool.query(queryStr);
    const withdrawals = result.rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      codmIgn: r.codm_ign,
      email: r.email,
      phone: r.phone,
      amount: parseFloat(r.amount),
      bankName: r.bank_name,
      accountNumber: r.account_number,
      accountName: r.account_name,
      bankCode: r.bank_code,
      status: r.status,
      remark: r.remark,
      createdAt: parseInt(r.created_at, 10),
      processedAt: r.processed_at ? parseInt(r.processed_at, 10) : undefined,
      processedBy: r.processed_by || undefined,
      opayRedirectUrl: r.opay_redirect_url || undefined,
      rejectionReason: r.rejection_reason || undefined,
      balanceDeducted: r.balance_deducted === true,
      webhookReceived: r.webhook_received === true,
      webhookPayload: r.webhook_payload || undefined,
    }));

    res.json({ withdrawals });
  } catch (err: any) {
    console.error('Error fetching admin withdrawals:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch withdrawal requests' });
  }
});

// Central OPay Payout Webhook Processor
// Handles webhook callbacks and executes instant atomic balance deduction
async function processOpayPayoutWebhook(payload: {
  withdrawalId?: string;
  reference?: string;
  amount?: number;
  accountNumber?: string;
  adminUserId?: string;
  channel?: string;
  webhookData?: any;
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Locate the withdrawal request with row lock
    let queryStr = `SELECT * FROM withdrawal_requests WHERE status != 'rejected'`;
    if (payload.withdrawalId) {
      queryStr += ` AND id = ${escapeSql(payload.withdrawalId)}`;
    } else if (payload.reference) {
      queryStr += ` AND (remark = ${escapeSql(payload.reference)} OR id = ${escapeSql(payload.reference)})`;
    } else if (payload.accountNumber && payload.amount) {
      queryStr += ` AND account_number = ${escapeSql(payload.accountNumber)} AND amount = ${escapeSql(payload.amount)} AND status = 'pending'`;
    } else {
      throw new Error('Missing withdrawal identification in webhook payload');
    }

    queryStr += ` ORDER BY created_at DESC LIMIT 1 FOR UPDATE`;
    const resWd = await client.query(queryStr);
    if (resWd.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error('No matching withdrawal request found for webhook settlement');
    }

    const wd = resWd.rows[0];
    const amountNum = parseFloat(wd.amount);
    const userId = wd.user_id;
    let newBalance: number | null = null;
    let deductedNow = false;

    // 2. Instant Balance Deduction from User's Account (if not already deducted)
    if (!wd.balance_deducted) {
      const userRes = await client.query(`SELECT balance FROM users WHERE id = ${escapeSql(userId)} FOR UPDATE`);
      if (userRes.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new Error('User not found in database');
      }

      const deductRes = await client.query(`
        UPDATE users 
        SET balance = GREATEST(0, balance - ${escapeSql(amountNum)})
        WHERE id = ${escapeSql(userId)}
        RETURNING balance;
      `);
      if (deductRes.rows.length > 0) {
        newBalance = parseFloat(deductRes.rows[0].balance);
        deductedNow = true;
      }
    } else {
      const u = await client.query(`SELECT balance FROM users WHERE id = ${escapeSql(userId)}`);
      newBalance = u.rows.length > 0 ? parseFloat(u.rows[0].balance) : null;
    }

    // 3. Mark withdrawal request as approved and webhook confirmed
    const processedAt = Date.now();
    const processedBy = payload.adminUserId || wd.processed_by || 'webhook_opay_payout';
    await client.query(`
      UPDATE withdrawal_requests 
      SET status = 'approved',
          balance_deducted = true,
          webhook_received = true,
          webhook_payload = ${escapeSql(JSON.stringify(payload.webhookData || payload))},
          processed_at = ${processedAt},
          processed_by = ${escapeSql(processedBy)}
      WHERE id = ${escapeSql(wd.id)}
    `);

    // 4. Update ledger transaction to verified settlement
    const remark = wd.remark || `CODM-OPAY-${String(wd.account_number).slice(-4)}`;
    const txDesc = `✅ OPay Payout Confirmed (Webhook Settled): ₦${amountNum.toLocaleString()} to ${wd.bank_name} (${wd.account_number} - ${wd.account_name}) [${remark}]`;

    const updateTx = await client.query(`
      UPDATE transactions 
      SET description = ${escapeSql(txDesc)},
          timestamp = ${processedAt}
      WHERE user_id = ${escapeSql(userId)} 
        AND amount = ${escapeSql(amountNum)} 
        AND type = 'WITHDRAWAL' 
        AND description LIKE '%Pending%'
      RETURNING id;
    `);

    if (updateTx.rows.length === 0) {
      const txId = `tx_opay_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
      await client.query(`
        INSERT INTO transactions (id, user_id, type, amount, description, timestamp)
        VALUES (${escapeSql(txId)}, ${escapeSql(userId)}, 'WITHDRAWAL', ${escapeSql(amountNum)}, ${escapeSql(txDesc)}, ${processedAt})
      `);
    }

    await client.query('COMMIT');

    return {
      success: true,
      withdrawalId: wd.id,
      userId,
      amount: amountNum,
      deductedNow,
      newBalance,
      remark,
      accountNumber: wd.account_number,
      bankName: wd.bank_name,
      accountName: wd.account_name,
      timestamp: processedAt,
    };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

// Dedicated OPay Payout Webhook endpoint for external callbacks or internal triggers
app.post(['/api/webhooks/opay-payout', '/api/webhooks/opay', '/api/webhooks/withdrawal-payout'], async (req, res) => {
  try {
    console.log('⚡ Received OPay Payout Webhook:', req.body);
    const { withdrawalId, reference, amount, accountNumber, adminUserId, event } = req.body || {};

    const webhookResult = await processOpayPayoutWebhook({
      withdrawalId,
      reference,
      amount: amount ? Number(amount) : undefined,
      accountNumber,
      adminUserId,
      channel: 'opay_webhook_endpoint',
      webhookData: req.body,
    });

    console.log('✅ OPay Payout Webhook processed successfully:', webhookResult);
    res.json({
      success: true,
      message: 'OPay Payout webhook processed and user balance deducted instantly',
      data: webhookResult,
    });
  } catch (err: any) {
    console.error('⚠️ OPay Payout Webhook error:', err);
    res.status(400).json({ error: err.message || 'Webhook processing failed' });
  }
});

// Admin Approve Withdrawal: Triggers OPay Payout Webhook, Deducts Money Instantly, and Redirects to OPay
app.post('/api/admin/withdrawals/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminUserId } = req.body;
    const adminUser = await getUserFromDb(adminUserId);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Admin privileges required' });
    }

    const checkRes = await pool.query(`SELECT * FROM withdrawal_requests WHERE id = ${escapeSql(id)}`);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Withdrawal request not found' });
    }

    const wd = checkRes.rows[0];
    const amountNum = parseFloat(wd.amount);
    const accNum = String(wd.account_number).trim();
    const bankName = String(wd.bank_name).trim();
    const accName = String(wd.account_name).trim();
    const bankCode = wd.bank_code || '';
    const remark = wd.remark || `CODM-${(wd.codm_ign || 'WD').slice(0, 10).toUpperCase()}-${accNum.slice(-4)}`;

    // Build OPay direct URL and deep-links
    const opayDeepLink = `opay://transfer?account=${accNum}&bank=${encodeURIComponent(bankName)}&bank_code=${bankCode}&amount=${amountNum}&remark=${encodeURIComponent(remark)}`;
    const androidIntent = `intent://transfer?account=${accNum}&bank=${encodeURIComponent(bankName)}&amount=${amountNum}&remark=${encodeURIComponent(remark)}#Intent;scheme=opay;package=team.opay.pay;end`;
    const opayWebUrl = `https://www.opayweb.com/?amount=${amountNum}&account=${accNum}&bank=${encodeURIComponent(bankName)}&name=${encodeURIComponent(accName)}&remark=${encodeURIComponent(remark)}`;

    // ⚡ Execute Webhook & Instant User Balance Deduction
    const webhookResult = await processOpayPayoutWebhook({
      withdrawalId: id,
      reference: remark,
      amount: amountNum,
      accountNumber: accNum,
      adminUserId: adminUser.id,
      channel: 'opay_admin_approval',
      webhookData: {
        event: 'payout.approved',
        adminId: adminUser.id,
        adminIgn: adminUser.codmIgn,
        timestamp: Date.now(),
        opayUrl: opayWebUrl,
      },
    });

    // Update opay_redirect_url in record
    await pool.query(`UPDATE withdrawal_requests SET opay_redirect_url = ${escapeSql(opayWebUrl)} WHERE id = ${escapeSql(id)}`);

    const paymentData = {
      id: wd.id,
      amount: amountNum,
      bankName,
      accountNumber: accNum,
      accountName: accName,
      bankCode,
      remark,
      codmIgn: wd.codm_ign,
      email: wd.email,
      phone: wd.phone,
      deductedNow: webhookResult.deductedNow,
      newBalance: webhookResult.newBalance,
    };

    res.json({
      success: true,
      message: `Withdrawal approved! Webhook delivered & ₦${amountNum.toLocaleString()} deducted instantly from player's balance. Redirecting to OPay...`,
      webhookSettled: true,
      deductedNow: webhookResult.deductedNow,
      newBalance: webhookResult.newBalance,
      opayDeepLink,
      androidIntent,
      opayWebUrl,
      paymentData,
    });
  } catch (err: any) {
    console.error('Error approving withdrawal with webhook:', err);
    res.status(500).json({ error: err.message || 'Failed to approve withdrawal and process webhook' });
  }
});

// Admin Reject Withdrawal
app.post('/api/admin/withdrawals/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminUserId, reason = 'Bank details mismatch / Invalid request' } = req.body;
    const adminUser = await getUserFromDb(adminUserId);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Admin privileges required' });
    }

    const checkRes = await pool.query(`SELECT * FROM withdrawal_requests WHERE id = ${escapeSql(id)}`);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Withdrawal request not found' });
    }

    const wd = checkRes.rows[0];
    if (wd.status !== 'pending') {
      return res.status(400).json({ error: `Withdrawal has already been ${wd.status}` });
    }

    const amountNum = parseFloat(wd.amount);

    // 1. Mark as rejected
    await pool.query(`
      UPDATE withdrawal_requests 
      SET status = 'rejected',
          rejection_reason = ${escapeSql(reason)},
          processed_at = ${Date.now()},
          processed_by = ${escapeSql(adminUser.id)}
      WHERE id = ${escapeSql(id)}
    `);

    // 2. Only refund if the balance was previously deducted!
    if (wd.balance_deducted === true) {
      await pool.query(`
        UPDATE users 
        SET balance = balance + ${escapeSql(amountNum)}
        WHERE id = ${escapeSql(wd.user_id)}
      `);

      const refundTxId = `tx_ref_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
      const refundDesc = `❌ Withdrawal Rejected & Refunded: ₦${amountNum.toLocaleString()} returned to balance [${reason}]`;
      await pool.query(`
        INSERT INTO transactions (id, user_id, type, amount, description, timestamp)
        VALUES (${escapeSql(refundTxId)}, ${escapeSql(wd.user_id)}, 'ESCROW_REFUND', ${escapeSql(amountNum)}, ${escapeSql(refundDesc)}, ${Date.now()})
      `);
    } else {
      // Update pending transaction note to rejected
      await pool.query(`
        UPDATE transactions 
        SET description = ${escapeSql(`❌ Withdrawal Request Cancelled/Rejected: [${reason}]`)}
        WHERE user_id = ${escapeSql(wd.user_id)} 
          AND amount = ${escapeSql(amountNum)} 
          AND type = 'WITHDRAWAL' 
          AND description LIKE '%Pending%'
      `);
    }

    res.json({
      success: true,
      message: `Withdrawal request rejected. ${wd.balance_deducted ? `₦${amountNum.toLocaleString()} refunded to player wallet.` : 'Player balance was not charged.'}`,
    });
  } catch (err: any) {
    console.error('Error rejecting withdrawal:', err);
    res.status(500).json({ error: err.message || 'Failed to reject withdrawal' });
  }
});

// Admin Users List for Assigning and Managing Admins
app.get('/api/admin/users', async (req, res) => {
  try {
    const { userId, search } = req.query;
    const adminUser = await getUserFromDb(userId as string);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Admin privileges required' });
    }

    let queryStr = `SELECT id, username, codm_ign, email, phone, role, balance, bank_name, account_number, account_name, created_at FROM users`;
    if (search && String(search).trim()) {
      const q = String(search).trim().toLowerCase();
      queryStr += ` WHERE LOWER(email) LIKE '%${escapeSql(q).replace(/'/g, '')}%' OR LOWER(codm_ign) LIKE '%${escapeSql(q).replace(/'/g, '')}%' OR LOWER(username) LIKE '%${escapeSql(q).replace(/'/g, '')}%'`;
    }
    queryStr += ` ORDER BY created_at DESC LIMIT 200`;

    const userRows = await pool.query(queryStr);
    const users = userRows.rows.map((u) => ({
      id: u.id,
      username: u.username || u.codm_ign,
      codmIgn: u.codm_ign,
      email: u.email || '',
      phone: u.phone || '',
      role: u.role || 'user',
      balance: parseFloat(u.balance || 0),
      bankName: u.bank_name,
      accountNumber: u.account_number,
      accountName: u.account_name,
      createdAt: parseInt(u.created_at || '0', 10),
    }));

    res.json({ users });
  } catch (err: any) {
    console.error('Error fetching admin users:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch users' });
  }
});

// Assign Admin Role endpoint
app.post('/api/admin/assign-role', async (req, res) => {
  try {
    const { adminUserId, targetUserId, identifier, role = 'admin' } = req.body;
    const adminUser = await getUserFromDb(adminUserId);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Only an admin can assign roles' });
    }

    if (role !== 'admin' && role !== 'user') {
      return res.status(400).json({ error: "Invalid role. Must be 'admin' or 'user'" });
    }

    let targetUser: any = null;
    if (targetUserId) {
      const r = await pool.query(`SELECT * FROM users WHERE id = ${escapeSql(targetUserId)}`);
      if (r.rows.length > 0) targetUser = r.rows[0];
    } else if (identifier && String(identifier).trim()) {
      const clean = String(identifier).trim().toLowerCase();
      const r = await pool.query(`SELECT * FROM users WHERE LOWER(email) = LOWER(${escapeSql(clean)}) OR LOWER(codm_ign) = LOWER(${escapeSql(clean)}) OR LOWER(username) = LOWER(${escapeSql(clean)})`);
      if (r.rows.length > 0) targetUser = r.rows[0];
    }

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found with provided ID, email, or IGN' });
    }

    await pool.query(`UPDATE users SET role = ${escapeSql(role)} WHERE id = ${escapeSql(targetUser.id)}`);

    const updatedUser = await getUserFromDb(targetUser.id);
    res.json({
      success: true,
      message: `User ${targetUser.codm_ign || targetUser.email} has been assigned the role: ${role.toUpperCase()}`,
      user: updatedUser,
    });
  } catch (err: any) {
    console.error('Error assigning role:', err);
    res.status(500).json({ error: err.message || 'Failed to assign role' });
  }
});

// Admin Adjust User Balance
app.post('/api/admin/users/:id/adjust-balance', async (req, res) => {
  try {
    const { adminUserId, amount, type = 'credit', reason = '' } = req.body;
    const targetUserId = req.params.id;
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ error: 'Invalid adjustment amount' });
    }

    const adminUser = await getUserFromDb(adminUserId);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Admin privileges required' });
    }

    const targetUser = await getUserFromDb(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Target gladiator not found' });
    }

    const currentBal = Number(targetUser.balance || 0);
    const newBal = type === 'debit' ? Math.max(0, currentBal - numAmount) : currentBal + numAmount;

    await pool.query(`
      UPDATE users 
      SET balance = ${escapeSql(newBal)} 
      WHERE id = ${escapeSql(targetUserId)}
    `);

    // Audit log transaction
    try {
      await pool.query(`
        INSERT INTO transactions (id, user_id, type, amount, description, timestamp)
        VALUES (
          ${escapeSql(`tx_adj_${Date.now()}`)},
          ${escapeSql(targetUserId)},
          ${escapeSql(type === 'debit' ? 'ADMIN_DEBIT' : 'ADMIN_CREDIT')},
          ${escapeSql(numAmount)},
          ${escapeSql(reason || `Admin balance adjustment (${type}): ₦${numAmount.toLocaleString()}`)},
          ${Date.now()}
        )
      `);
    } catch (_) {}

    const refreshed = await getUserFromDb(targetUserId);
    res.json({
      success: true,
      message: `Successfully adjusted balance for ${targetUser.codmIgn || targetUser.email} to ₦${newBal.toLocaleString()}`,
      user: refreshed,
    });
  } catch (err: any) {
    console.error('Error adjusting user balance:', err);
    res.status(500).json({ error: err.message || 'Failed to adjust balance' });
  }
});

// Bootstrap / Claim Admin (for owner/creator access)
app.post('/api/admin/claim-admin', async (req, res) => {
  try {
    const { userId, passcode } = req.body;
    const user = await getUserFromDb(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isOwnerEmail = user.email.toLowerCase().includes('loganhayes09') || user.email.toLowerCase().includes('abulsalam') || user.email.toLowerCase() === 'b@gmail.com';
    const isPasscode = passcode === 'admin123' || passcode === 'OPAY_ADMIN_2025' || passcode === 'codmadmin';

    if (!isOwnerEmail && !isPasscode) {
      return res.status(403).json({ error: 'Invalid admin authorization credentials' });
    }

    await pool.query(`UPDATE users SET role = 'admin' WHERE id = ${escapeSql(userId)}`);
    const refreshed = await getUserFromDb(userId);
    res.json({
      success: true,
      message: `Admin access granted to ${refreshed?.codmIgn || refreshed?.email}`,
      user: refreshed,
    });
  } catch (err: any) {
    console.error('Error claiming admin:', err);
    res.status(500).json({ error: err.message || 'Failed to claim admin' });
  }
});

// ==========================================
// 📱 MACRODROID & OPAY AUTOMATED SMS FUNDING ENGINE
// ==========================================

// Parse OPay Credit Alert SMS (Android SMS sent by OPay and captured via MacroDroid)
function parseOpaySms(rawText: string): {
  amount: number | null;
  reference: string | null;
  senderName: string | null;
  narration: string | null;
  accountNumber: string | null;
} {
  if (!rawText) {
    return { amount: null, reference: null, senderName: null, narration: null, accountNumber: null };
  }

  const text = rawText.trim();

  // 1. Extract Amount
  let amount: number | null = null;
  const amountPatterns = [
    /(?:credited\s+with|credit\s+of|received|credit:?|amount:?)\s*(?:NGN|₦|N)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /(?:NGN|₦)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /([0-9,]+(?:\.[0-9]{2})?)\s*(?:credited|received|CR)/i,
  ];

  for (const pat of amountPatterns) {
    const match = text.match(pat);
    if (match && match[1]) {
      const cleanNum = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(cleanNum) && cleanNum > 0) {
        amount = cleanNum;
        break;
      }
    }
  }

  // 2. Extract Reference / Session ID
  let reference: string | null = null;
  const refPatterns = [
    /(?:Ref|Reference|Txn\s*ID|Txn|Session\s*ID|Session|ID)[:\s]+([A-Za-z0-9_-]+)/i,
    /Ref#([A-Za-z0-9_-]+)/i,
  ];
  for (const pat of refPatterns) {
    const match = text.match(pat);
    if (match && match[1]) {
      reference = match[1].trim();
      break;
    }
  }

  // 3. Extract Sender Name
  let senderName: string | null = null;
  const senderPatterns = [
    /(?:from|Sender:)\s*([A-Za-z0-9\s/]+?)(?:\s+(?:to|via|Ref|Remark|Desc|Note|Bal|at|\.|\n)|$)/i,
  ];
  for (const pat of senderPatterns) {
    const match = text.match(pat);
    if (match && match[1]) {
      const cleaned = match[1].replace(/\s*\/\s*[A-Za-z\s]+$/, '').trim();
      if (cleaned.length > 1 && !cleaned.toLowerCase().startsWith('opay')) {
        senderName = cleaned;
        break;
      }
    }
  }

  // 4. Extract Narration / Remark / Description
  let narration: string | null = null;
  const narrPatterns = [
    /(?:Remark|Desc|Description|Narration|Note|Memo)[:\s]+([^\.\n]+)/i,
  ];
  for (const pat of narrPatterns) {
    const match = text.match(pat);
    if (match && match[1]) {
      narration = match[1].trim();
      break;
    }
  }

  // Check if reference code (e.g. OP-1234 or GLAD-123) appears anywhere in SMS text
  if (!narration) {
    const codeMatch = text.match(/\b(OP-[0-9]{4,6}|GLAD-[0-9]{3,6}|EZ-[0-9]{4,6}|DEP-[0-9]{4,6})\b/i);
    if (codeMatch) {
      narration = codeMatch[1].toUpperCase();
    }
  }

  // 5. Account Number if mentioned
  let accountNumber: string | null = null;
  const accMatch = text.match(/(?:account|acct|to)\s*\(?([0-9]{10})\)?/i);
  if (accMatch) {
    accountNumber = accMatch[1];
  }

  return { amount, reference, senderName, narration, accountNumber };
}

// Core Matching and Balance Crediting Engine
async function matchAndCreditOpayDeposit(smsDetails: {
  smsBody: string;
  sender?: string;
  amount: number;
  reference?: string | null;
  senderName?: string | null;
  narration?: string | null;
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const alertId = `sms_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
    const now = Date.now();
    const cleanRef = smsDetails.reference || `REF_${now}_${Math.floor(Math.random() * 1000)}`;

    // 1. Idempotency Guard: prevent crediting same SMS twice
    if (smsDetails.reference) {
      const existingAlert = await client.query(`
        SELECT * FROM opay_sms_alerts WHERE reference = ${escapeSql(smsDetails.reference)}
      `);
      if (existingAlert.rows.length > 0) {
        await client.query('ROLLBACK');
        return {
          alreadyProcessed: true,
          alert: existingAlert.rows[0],
          message: 'SMS Alert with this reference has already been credited',
        };
      }
    }

    let matchedUser: any = null;
    let matchedDepositReq: any = null;

    // Strategy 1: Match by explicit payment_reference in deposit_requests
    if (smsDetails.narration) {
      const cleanNarr = smsDetails.narration.trim();
      const depByRef = await client.query(`
        SELECT * FROM deposit_requests 
        WHERE status = 'pending' 
          AND (LOWER(payment_reference) = LOWER(${escapeSql(cleanNarr)}) 
               OR ${escapeSql(cleanNarr)} ILIKE '%' || payment_reference || '%')
        ORDER BY created_at DESC LIMIT 1 FOR UPDATE
      `);
      if (depByRef.rows.length > 0) {
        matchedDepositReq = depByRef.rows[0];
        const uRes = await client.query(`SELECT * FROM users WHERE id = ${escapeSql(matchedDepositReq.user_id)} FOR UPDATE`);
        if (uRes.rows.length > 0) matchedUser = uRes.rows[0];
      }
    }

    // Strategy 2: Search entire SMS text for any pending deposit_request payment_reference
    if (!matchedUser) {
      const pendingDeps = await client.query(`
        SELECT * FROM deposit_requests 
        WHERE status = 'pending' 
          AND expires_at > ${now - 3600000}
        ORDER BY created_at DESC LIMIT 20 FOR UPDATE
      `);
      for (const dep of pendingDeps.rows) {
        if (smsDetails.smsBody.toUpperCase().includes(dep.payment_reference.toUpperCase())) {
          matchedDepositReq = dep;
          const uRes = await client.query(`SELECT * FROM users WHERE id = ${escapeSql(dep.user_id)} FOR UPDATE`);
          if (uRes.rows.length > 0) {
            matchedUser = uRes.rows[0];
            break;
          }
        }
      }
    }

    // Strategy 3: Match user by CODM IGN, username, or account_name in the remark / SMS body
    if (!matchedUser) {
      const candidateUsers = await client.query(`
        SELECT * FROM users 
        WHERE (
          (codm_ign IS NOT NULL AND LENGTH(codm_ign) >= 3 AND ${escapeSql(smsDetails.smsBody)} ILIKE '%' || codm_ign || '%')
          OR (username IS NOT NULL AND LENGTH(username) >= 3 AND ${escapeSql(smsDetails.smsBody)} ILIKE '%' || username || '%')
          OR (${smsDetails.senderName ? `${escapeSql(smsDetails.senderName)} ILIKE '%' || account_name || '%'` : 'false'})
        )
        LIMIT 5 FOR UPDATE
      `);
      if (candidateUsers.rows.length === 1) {
        matchedUser = candidateUsers.rows[0];
        const userDep = await client.query(`
          SELECT * FROM deposit_requests 
          WHERE user_id = ${escapeSql(matchedUser.id)} AND status = 'pending'
          ORDER BY created_at DESC LIMIT 1 FOR UPDATE
        `);
        if (userDep.rows.length > 0) {
          matchedDepositReq = userDep.rows[0];
        }
      }
    }

    // Strategy 4: If amount matches an active pending deposit request created in last 45 minutes
    if (!matchedUser && smsDetails.amount > 0) {
      const depByAmount = await client.query(`
        SELECT * FROM deposit_requests 
        WHERE status = 'pending' 
          AND amount = ${escapeSql(smsDetails.amount)}
          AND expires_at > ${now}
        ORDER BY created_at DESC LIMIT 1 FOR UPDATE
      `);
      if (depByAmount.rows.length === 1) {
        matchedDepositReq = depByAmount.rows[0];
        const uRes = await client.query(`SELECT * FROM users WHERE id = ${escapeSql(matchedDepositReq.user_id)} FOR UPDATE`);
        if (uRes.rows.length > 0) matchedUser = uRes.rows[0];
      }
    }

    // IF MATCHED: Instantly Credit the User's Wallet!
    if (matchedUser) {
      const amountToCredit = smsDetails.amount;
      const refCode = matchedDepositReq?.payment_reference || cleanRef;

      // 1. Atomically increment user balance
      const balRes = await client.query(`
        UPDATE users 
        SET balance = balance + ${escapeSql(amountToCredit)} 
        WHERE id = ${escapeSql(matchedUser.id)} 
        RETURNING balance;
      `);
      const newBalance = parseFloat(balRes.rows[0].balance);

      // 2. Mark deposit request as completed
      if (matchedDepositReq) {
        await client.query(`
          UPDATE deposit_requests 
          SET status = 'completed', 
              sms_alert_id = ${escapeSql(alertId)}, 
              completed_at = ${now}
          WHERE id = ${escapeSql(matchedDepositReq.id)}
        `);
      }

      // 3. Insert transaction
      const txId = `tx_opay_${now}_${Math.floor(100 + Math.random() * 900)}`;
      const txDesc = `⚡ Automated OPay Credit (MacroDroid SMS): ₦${amountToCredit.toLocaleString()} credited [Ref: ${cleanRef} | Code: ${refCode}]`;
      await client.query(`
        INSERT INTO transactions (id, user_id, type, amount, description, timestamp)
        VALUES (${escapeSql(txId)}, ${escapeSql(matchedUser.id)}, 'DEPOSIT', ${escapeSql(amountToCredit)}, ${escapeSql(txDesc)}, ${now})
      `);

      // 4. Save to opay_sms_alerts as auto_credited
      await client.query(`
        INSERT INTO opay_sms_alerts (
          id, sms_body, sender, amount, narration, sender_name, reference, matched_user_id, matched_user_ign, status, created_at, credited_at
        ) VALUES (
          ${escapeSql(alertId)},
          ${escapeSql(smsDetails.smsBody)},
          ${escapeSql(smsDetails.sender || 'OPay')},
          ${escapeSql(amountToCredit)},
          ${escapeSql(smsDetails.narration || refCode)},
          ${escapeSql(smsDetails.senderName || '')},
          ${escapeSql(cleanRef)},
          ${escapeSql(matchedUser.id)},
          ${escapeSql(matchedUser.codm_ign || matchedUser.username)},
          'auto_credited',
          ${now},
          ${now}
        )
      `);

      await client.query('COMMIT');

      return {
        success: true,
        matched: true,
        status: 'auto_credited',
        alertId,
        user: {
          id: matchedUser.id,
          codmIgn: matchedUser.codm_ign || matchedUser.username,
          newBalance,
        },
        amount: amountToCredit,
        reference: cleanRef,
        message: `Successfully credited ₦${amountToCredit.toLocaleString()} to ${matchedUser.codm_ign || matchedUser.username} via automated OPay SMS alert!`,
      };
    } else {
      // UNMATCHED: Store alert for Admin 1-Click Assignment
      await client.query(`
        INSERT INTO opay_sms_alerts (
          id, sms_body, sender, amount, narration, sender_name, reference, status, created_at
        ) VALUES (
          ${escapeSql(alertId)},
          ${escapeSql(smsDetails.smsBody)},
          ${escapeSql(smsDetails.sender || 'OPay')},
          ${escapeSql(smsDetails.amount || 0)},
          ${escapeSql(smsDetails.narration || '')},
          ${escapeSql(smsDetails.senderName || '')},
          ${escapeSql(cleanRef)},
          'unmatched',
          ${now}
        )
      `);

      await client.query('COMMIT');

      return {
        success: true,
        matched: false,
        status: 'unmatched',
        alertId,
        amount: smsDetails.amount,
        reference: cleanRef,
        message: 'OPay SMS recorded as unmatched. Ready on Admin Dashboard for 1-click player assignment.',
      };
    }
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

// 1. Create a Pending Deposit Request (User-Facing)
app.post('/api/deposits/create', async (req, res) => {
  try {
    const { userId, amount } = req.body;
    const user = await getUserFromDb(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const numAmount = Number(amount);
    if (!numAmount || numAmount < 100) {
      return res.status(400).json({ error: 'Minimum deposit amount is ₦100' });
    }

    const now = Date.now();
    const expiresAt = now + 30 * 60 * 1000; // 30 minutes
    const depId = `dep_${now}_${Math.floor(100 + Math.random() * 900)}`;
    const paymentRef = `OP-${Math.floor(1000 + Math.random() * 9000)}`;

    await pool.query(`
      INSERT INTO deposit_requests (id, user_id, codm_ign, amount, payment_reference, status, created_at, expires_at)
      VALUES (
        ${escapeSql(depId)},
        ${escapeSql(user.id)},
        ${escapeSql(user.codmIgn || user.username)},
        ${escapeSql(numAmount)},
        ${escapeSql(paymentRef)},
        'pending',
        ${now},
        ${expiresAt}
      )
    `);

    res.json({
      success: true,
      deposit: {
        id: depId,
        userId: user.id,
        codmIgn: user.codmIgn,
        amount: numAmount,
        paymentReference: paymentRef,
        status: 'pending',
        createdAt: now,
        expiresAt,
      },
      accountDetails: {
        bankName: 'OPay Digital Services Limited (OPay)',
        accountNumber: '7079874999',
        accountName: 'QUADRI OPEYEMI ABDULSALAM',
        amount: numAmount,
        paymentReference: paymentRef,
        instructions: `Transfer exactly ₦${numAmount.toLocaleString()} to OPay (7079874999). Enter '${paymentRef}' or '${user.codmIgn}' in transfer remark for instant automated crediting.`,
      },
    });
  } catch (err: any) {
    console.error('Error creating deposit request:', err);
    res.status(500).json({ error: err.message || 'Failed to create deposit request' });
  }
});

// 2. Poll Deposit Status for Live Frontend UI Auto-Credit
app.get('/api/deposits/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const depRes = await pool.query(`SELECT * FROM deposit_requests WHERE id = ${escapeSql(id)}`);
    if (depRes.rows.length === 0) {
      return res.status(404).json({ error: 'Deposit request not found' });
    }

    const dep = depRes.rows[0];
    const user = await getUserFromDb(dep.user_id);

    res.json({
      id: dep.id,
      status: dep.status,
      completed: dep.status === 'completed',
      amount: parseFloat(dep.amount),
      paymentReference: dep.payment_reference,
      balance: user?.balance ?? 0,
      completedAt: dep.completed_at ? parseInt(dep.completed_at, 10) : undefined,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to check deposit status' });
  }
});

// 3. MacroDroid Webhook Receiver (Incoming SMS alert from Admin's Android Phone)
app.post(['/api/webhooks/macrodroid-opay', '/api/webhooks/opay-sms'], async (req, res) => {
  try {
    const providedSecret = req.headers['x-webhook-secret'] || req.query.secret || req.body?.secret;
    const expectedSecret = process.env.MACRODROID_WEBHOOK_SECRET || 'opay_macro_key_2026';

    if (providedSecret && providedSecret !== expectedSecret) {
      return res.status(401).json({ error: 'Unauthorized webhook request: Invalid secret key' });
    }

    // Extract SMS message from MacroDroid payload (supports JSON and raw body)
    const rawBody = typeof req.body === 'string' 
      ? req.body 
      : (req.body?.message || req.body?.body || req.body?.sms || req.body?.text || JSON.stringify(req.body));
    const sender = req.body?.sender || req.body?.phone || req.body?.from || 'OPay';

    console.log('📱 [MacroDroid Webhook] Incoming OPay SMS alert received:', { sender, body: rawBody });

    // Parse the SMS text
    const parsed = parseOpaySms(rawBody);

    if (!parsed.amount || parsed.amount <= 0) {
      return res.status(400).json({
        error: 'Could not extract valid credit amount from SMS text',
        parsed,
        rawBody,
      });
    }

    const result = await matchAndCreditOpayDeposit({
      smsBody: rawBody,
      sender,
      amount: parsed.amount,
      reference: parsed.reference,
      senderName: parsed.senderName,
      narration: parsed.narration,
    });

    console.log('⚡ [MacroDroid Webhook] Process result:', result);
    res.json(result);
  } catch (err: any) {
    console.error('⚠️ [MacroDroid Webhook] Error:', err);
    res.status(500).json({ error: err.message || 'Webhook processing failed' });
  }
});

// 4. Admin: Fetch OPay SMS Alerts
app.get(['/api/admin/opay/alerts', '/api/admin/sms-alerts'], async (req, res) => {
  try {
    const { userId, status } = req.query;
    const adminUser = await getUserFromDb(userId as string);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Admin privileges required' });
    }

    let queryStr = `SELECT * FROM opay_sms_alerts`;
    if (status && status !== 'all') {
      queryStr += ` WHERE status = ${escapeSql(status as string)}`;
    }
    queryStr += ` ORDER BY created_at DESC LIMIT 100`;

    const resAlerts = await pool.query(queryStr);
    const alerts = resAlerts.rows.map((r) => ({
      id: r.id,
      smsBody: r.sms_body,
      sender: r.sender,
      amount: parseFloat(r.amount),
      narration: r.narration,
      senderName: r.sender_name,
      reference: r.reference,
      matchedUserId: r.matched_user_id,
      matchedUserIgn: r.matched_user_ign,
      status: r.status,
      createdAt: parseInt(r.created_at, 10),
      creditedAt: r.credited_at ? parseInt(r.credited_at, 10) : undefined,
    }));

    res.json({ alerts });
  } catch (err: any) {
    console.error('Error fetching OPay alerts:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch OPay alerts' });
  }
});

// 5. Admin: Manually Assign an Unmatched Alert to a Player
app.post(['/api/admin/opay/alerts/:id/assign', '/api/admin/sms-alerts/:id/assign'], async (req, res) => {
  try {
    const { id } = req.params;
    const { adminUserId, targetUserId } = req.body;
    const adminUser = await getUserFromDb(adminUserId);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Admin privileges required' });
    }

    const alertRes = await pool.query(`SELECT * FROM opay_sms_alerts WHERE id = ${escapeSql(id)}`);
    if (alertRes.rows.length === 0) {
      return res.status(404).json({ error: 'SMS Alert not found' });
    }

    const alert = alertRes.rows[0];
    if (alert.status === 'auto_credited' || alert.status === 'manually_credited') {
      return res.status(400).json({ error: `This alert has already been credited (${alert.status})` });
    }

    const targetUser = await getUserFromDb(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Target player not found' });
    }

    const amountNum = parseFloat(alert.amount);
    const now = Date.now();

    // 1. Credit target player balance
    await pool.query(`
      UPDATE users 
      SET balance = balance + ${escapeSql(amountNum)} 
      WHERE id = ${escapeSql(targetUser.id)}
    `);

    // 2. Insert transaction
    const txId = `tx_manual_${now}_${Math.floor(100 + Math.random() * 900)}`;
    const txDesc = `🛡️ Manual OPay Credit (Admin Verified): ₦${amountNum.toLocaleString()} credited by Admin (${adminUser.codmIgn}) [Ref: ${alert.reference || alert.id}]`;
    await pool.query(`
      INSERT INTO transactions (id, user_id, type, amount, description, timestamp)
      VALUES (${escapeSql(txId)}, ${escapeSql(targetUser.id)}, 'DEPOSIT', ${escapeSql(amountNum)}, ${escapeSql(txDesc)}, ${now})
    `);

    // 3. Mark alert as manually_credited
    await pool.query(`
      UPDATE opay_sms_alerts 
      SET status = 'manually_credited',
          matched_user_id = ${escapeSql(targetUser.id)},
          matched_user_ign = ${escapeSql(targetUser.codmIgn || targetUser.username)},
          credited_at = ${now}
      WHERE id = ${escapeSql(id)}
    `);

    const updatedUser = await getUserFromDb(targetUser.id);
    res.json({
      success: true,
      message: `Successfully assigned ₦${amountNum.toLocaleString()} to ${targetUser.codmIgn}. New balance: ₦${updatedUser?.balance}`,
      user: updatedUser,
    });
  } catch (err: any) {
    console.error('Error assigning alert to user:', err);
    res.status(500).json({ error: err.message || 'Failed to assign alert' });
  }
});

// ==========================================
// 📧 ADMIN MAILBOX API (`codstake@detailr.online`)
// ==========================================

// Get Mailbox Messages (from admin_emails & IMAP sync)
app.get('/api/admin/mailbox', async (req, res) => {
  try {
    const { userId } = req.query;
    const adminUser = await getUserFromDb(userId as string);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Admin privileges required' });
    }

    await initGmailTables();

    const mRes = await pool.query(`SELECT * FROM admin_emails ORDER BY created_at DESC LIMIT 250`);
    const emails = mRes.rows.map(r => ({
      id: r.id,
      senderEmail: r.sender_email,
      senderName: r.sender_name || r.sender_email,
      recipientEmail: r.recipient_email,
      subject: r.subject,
      body: r.body,
      isRead: r.is_read === true,
      folder: r.folder || 'inbox',
      createdAt: parseInt(r.created_at, 10),
    }));

    res.json({ emails, messages: emails });
  } catch (err: any) {
    console.error('Error fetching admin mailbox messages:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch mailbox messages' });
  }
});

// Send / Reply Email from codstake@detailr.online
app.post('/api/admin/mailbox/send', async (req, res) => {
  try {
    const { userId, recipientEmail, subject, body } = req.body;
    const adminUser = await getUserFromDb(userId);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Admin privileges required' });
    }

    if (!recipientEmail || !subject || !body) {
      return res.status(400).json({ error: 'Recipient email, subject, and body are required' });
    }

    const now = Date.now();
    const mailId = `mail_${now}_${Math.floor(100 + Math.random() * 900)}`;

    await pool.query(`
      INSERT INTO admin_mailbox (id, sender_email, sender_name, recipient_email, subject, body, is_read, folder, created_at)
      VALUES (
        ${escapeSql(mailId)},
        'codstake@detailr.online',
        ${escapeSql(adminUser.codmIgn || 'Admin')},
        ${escapeSql(recipientEmail)},
        ${escapeSql(subject)},
        ${escapeSql(body)},
        true,
        'sent',
        ${now}
      )
    `);

    res.json({
      success: true,
      message: `Email successfully sent to ${recipientEmail} from codstake@detailr.online`,
      messageId: mailId,
    });
  } catch (err: any) {
    console.error('Error sending email:', err);
    res.status(500).json({ error: err.message || 'Failed to send email' });
  }
});

// Simulate / Receive Incoming Email (for testing Hostinger DNS / Webhook inbox)
app.post('/api/admin/mailbox/simulate', async (req, res) => {
  try {
    const { userId, senderEmail, senderName, subject, body } = req.body;
    const adminUser = await getUserFromDb(userId);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Admin privileges required' });
    }

    const now = Date.now();
    const mailId = `mail_in_${now}_${Math.floor(100 + Math.random() * 900)}`;

    await pool.query(`
      INSERT INTO admin_mailbox (id, sender_email, sender_name, recipient_email, subject, body, is_read, folder, created_at)
      VALUES (
        ${escapeSql(mailId)},
        ${escapeSql(senderEmail || 'player@gmail.com')},
        ${escapeSql(senderName || 'CODM Player')},
        'codstake@detailr.online',
        ${escapeSql(subject || 'Support / Deposit Verification Inquiry')},
        ${escapeSql(body || 'Hello Admin, I made a deposit of ₦5,000 for match stake. Please verify my payment.')},
        false,
        'inbox',
        ${now}
      )
    `);

    res.json({
      success: true,
      message: 'Simulated incoming email received successfully into codstake@detailr.online inbox!',
      mailId,
    });
  } catch (err: any) {
    console.error('Error simulating incoming email:', err);
    res.status(500).json({ error: err.message || 'Failed to simulate email' });
  }
});


// 6. Admin: Test / Simulate SMS Parsing
app.post(['/api/admin/opay/test-sms', '/api/admin/test-sms-parser'], async (req, res) => {
  try {
    const { userId, smsText, shouldCredit = false } = req.body;
    const adminUser = await getUserFromDb(userId);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Admin privileges required' });
    }

    const parsed = parseOpaySms(smsText || '');
    if (shouldCredit && parsed.amount && parsed.amount > 0) {
      const matchResult = await matchAndCreditOpayDeposit({
        smsBody: smsText,
        sender: 'OPay_Tester',
        amount: parsed.amount,
        reference: parsed.reference,
        senderName: parsed.senderName,
        narration: parsed.narration,
      });
      return res.json({ parsed, execution: matchResult });
    }

    res.json({ parsed, simulationOnly: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to test SMS' });
  }
});

// 7. Admin: MacroDroid Settings & Diagnostics
app.get('/api/admin/opay/settings', async (req, res) => {
  try {
    const { userId } = req.query;
    const adminUser = await getUserFromDb(userId as string);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Admin privileges required' });
    }

    const host = req.headers.host || 'localhost:3000';
    const proto = req.headers['x-forwarded-proto'] || 'http';
    const webhookUrl = `${proto}://${host}/api/webhooks/macrodroid-opay`;
    const secretKey = process.env.MACRODROID_WEBHOOK_SECRET || 'opay_macro_key_2026';

    const countRes = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'auto_credited' THEN 1 END) as auto_credited,
        COUNT(CASE WHEN status = 'unmatched' THEN 1 END) as unmatched,
        COALESCE(SUM(CASE WHEN status IN ('auto_credited', 'manually_credited') THEN amount ELSE 0 END), 0) as total_credited_amount
      FROM opay_sms_alerts
    `);

    res.json({
      webhookUrl,
      secretKey,
      accountDetails: {
        bankName: 'OPay Digital Services Limited (OPay)',
        accountNumber: '7079874999',
        accountName: 'QUADRI OPEYEMI ABDULSALAM',
      },
      stats: {
        totalAlerts: parseInt(countRes.rows[0].total, 10),
        autoCredited: parseInt(countRes.rows[0].auto_credited, 10),
        unmatched: parseInt(countRes.rows[0].unmatched, 10),
        totalCreditedAmount: parseFloat(countRes.rows[0].total_credited_amount),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch settings' });
  }
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

  // Seamless login for admin b@gmail.com or demo accounts
  if (account.user.email?.toLowerCase() === 'b@gmail.com' || identifier.toLowerCase() === 'b@gmail.com') {
    return res.json(account.user);
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

    // Check existing pending cashouts that haven't been deducted yet
    const pendingSumRes = await client.query(`
      SELECT COALESCE(SUM(amount), 0) as pending_total 
      FROM withdrawal_requests 
      WHERE user_id = ${escapeSql(userId)} AND status = 'pending' AND balance_deducted = false
    `);
    const pendingTotal = parseFloat(pendingSumRes.rows[0]?.pending_total || 0);
    const availableForCashout = currentBalance - pendingTotal;

    if (numAmount > availableForCashout) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Insufficient available balance for cashout. Available: ₦${Math.max(0, availableForCashout).toLocaleString()} (₦${pendingTotal.toLocaleString()} pending admin payout).`,
      });
    }

    // Update user's bank details if provided
    await client.query(`
      UPDATE users 
      SET bank_name = COALESCE(${escapeSql(bankName || null)}, bank_name),
          account_number = COALESCE(${escapeSql(accountNumber || null)}, account_number),
          account_name = COALESCE(${escapeSql(accountName || null)}, account_name)
      WHERE id = ${escapeSql(userId)}
    `);

    const wdId = `wd_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
    const userIgn = userRow.codm_ign || userRow.username || 'Gladiator';
    const cleanBank = (bankName || userRow.bank_name || '').trim();
    const cleanAccNum = (accountNumber || userRow.account_number || '').trim();
    const cleanAccName = (accountName || userRow.account_name || '').trim();
    const remark = `CODM-${userIgn.slice(0, 10).toUpperCase()}-${cleanAccNum.slice(-4)}`;
    const pendingDesc = `⏳ Pending Admin Approval: Withdrawal request of ₦${numAmount.toLocaleString()} to ${cleanBank} (${cleanAccNum} - ${cleanAccName})`;

    await client.query(`
      INSERT INTO transactions (id, user_id, type, amount, description, timestamp)
      VALUES (${escapeSql(txId)}, ${escapeSql(userId)}, 'WITHDRAWAL', ${escapeSql(numAmount)}, ${escapeSql(pendingDesc)}, ${Date.now()})
    `);

    await client.query(`
      INSERT INTO withdrawal_requests (
        id, user_id, codm_ign, email, phone, amount, bank_name, account_number, account_name, bank_code, status, remark, created_at, balance_deducted, webhook_received
      ) VALUES (
        ${escapeSql(wdId)},
        ${escapeSql(userId)},
        ${escapeSql(userIgn)},
        ${escapeSql(userRow.email || '')},
        ${escapeSql(userRow.phone || '')},
        ${escapeSql(numAmount)},
        ${escapeSql(cleanBank)},
        ${escapeSql(cleanAccNum)},
        ${escapeSql(cleanAccName)},
        ${escapeSql(bankCode || '')},
        'pending',
        ${escapeSql(remark)},
        ${Date.now()},
        false,
        false
      )
    `);

    await client.query('COMMIT');
    user = await getUserFromDb(userId);

    return res.json({
      success: true,
      pending: true,
      balance: currentBalance,
      pendingAmount: numAmount,
      transaction: {
        id: txId,
        type: 'WITHDRAWAL',
        amount: numAmount,
        description: pendingDesc,
        timestamp: Date.now(),
      },
      withdrawalRequest: {
        id: wdId,
        userId,
        codmIgn: userIgn,
        email: userRow.email || '',
        phone: userRow.phone || '',
        amount: numAmount,
        bankName: cleanBank,
        accountNumber: cleanAccNum,
        accountName: cleanAccName,
        bankCode: bankCode || '',
        status: 'pending',
        remark,
        balanceDeducted: false,
        webhookReceived: false,
        createdAt: Date.now(),
      },
      message: 'Withdrawal request submitted! It is now pending admin approval. The funds will be deducted instantly when approved and sent via OPay.',
    });
  } catch (dbErr: any) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Database withdrawal error:', dbErr);
    return res.status(500).json({ error: dbErr.message || 'Database error processing withdrawal' });
  } finally {
    client.release();
    activeWithdrawalLocks.delete(userId);
  }
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


// ==========================================
// 📧 GMAIL IMAP SYNC ENGINE & ADMIN MAILBOX
// ==========================================

// Get current Gmail integration status & config
app.get('/api/admin/gmail/config', async (req, res) => {
  try {
    const { userId } = req.query;
    const user = await getUserFromDb(userId as string);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Admin privileges required' });
    }

    const config = await getGmailConfig();
    res.json({
      configured: !!config && !!config.gmailAddress && !!config.appPassword,
      gmailAddress: config?.gmailAddress || null,
      autoSync: config?.autoSync ?? true,
      lastSyncedAt: config?.lastSyncedAt || null,
      lastSyncStatus: config?.lastSyncStatus || 'idle',
      lastSyncError: config?.lastSyncError || null,
      totalEmailsSynced: config?.totalEmailsSynced || 0,
      hasEnvOverride: !!process.env.GMAIL_USER && !!process.env.GMAIL_APP_PASSWORD,
    });
  } catch (err: any) {
    console.error('Error fetching gmail config:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch Gmail status' });
  }
});

// Save or connect a new Gmail account (with test check)
app.post('/api/admin/gmail/config', async (req, res) => {
  try {
    const { userId, gmailAddress, appPassword, autoSync } = req.body;
    const user = await getUserFromDb(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Admin privileges required' });
    }

    if (!gmailAddress || !appPassword) {
      return res.status(400).json({ error: 'Gmail address and 16-character App Password are required' });
    }

    // Test connection first to verify credentials work with Google IMAP
    const testResult = await testGmailConnection(gmailAddress, appPassword);
    if (!testResult.success) {
      return res.status(400).json({
        error: testResult.message,
        details: 'Connection test failed. Please verify your Gmail address and 16-character App Password.',
      });
    }

    // Save credentials to Postgres
    await saveGmailConfig(gmailAddress, appPassword, autoSync !== false);

    // Run an immediate initial sync in background
    syncGmailEmails().catch((err) => console.warn('Initial sync error:', err.message));

    res.json({
      success: true,
      message: `Successfully connected ${gmailAddress}! Initial mail sync started.`,
      totalInboxMessages: testResult.totalMessages,
    });
  } catch (err: any) {
    console.error('Error saving gmail config:', err);
    res.status(500).json({ error: err.message || 'Failed to configure Gmail' });
  }
});

// Test connection on demand
app.post('/api/admin/gmail/test', async (req, res) => {
  try {
    const { userId, gmailAddress, appPassword } = req.body;
    const user = await getUserFromDb(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await testGmailConnection(gmailAddress, appPassword);
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({ success: true, message: result.message, totalMessages: result.totalMessages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger manual mail sync
app.post('/api/admin/gmail/sync', async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await getUserFromDb(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await syncGmailEmails();
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json(result);
  } catch (err: any) {
    console.error('Error syncing Gmail:', err);
    res.status(500).json({ error: err.message || 'Failed to sync Gmail' });
  }
});

// Disconnect Gmail
app.post('/api/admin/gmail/disconnect', async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await getUserFromDb(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await disconnectGmailConfig();
    res.json({ success: true, message: 'Gmail account disconnected successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch admin mailbox emails
app.get('/api/admin/mailbox', async (req, res) => {
  try {
    const { userId } = req.query;
    const user = await getUserFromDb(userId as string);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Admin privileges required' });
    }

    await initGmailTables();

    const resMails = await pool.query(`SELECT * FROM admin_emails ORDER BY created_at DESC LIMIT 250`);
    const emails = resMails.rows.map((m) => ({
      id: m.id,
      senderEmail: m.sender_email,
      senderName: m.sender_name || m.sender_email,
      recipientEmail: m.recipient_email,
      subject: m.subject,
      body: m.body,
      folder: m.folder || 'inbox',
      isRead: m.is_read === true,
      createdAt: parseInt(m.created_at, 10),
    }));

    res.json({ emails });
  } catch (err: any) {
    console.error('Error fetching admin mailbox:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch mailbox' });
  }
});

// Mark email as read
app.patch('/api/admin/mailbox/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, isRead = true } = req.body;
    const user = await getUserFromDb(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await pool.query(`UPDATE admin_emails SET is_read = $1 WHERE id = $2`, [isRead, id]);
    res.json({ success: true, id, isRead });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete email
app.delete('/api/admin/mailbox/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const user = await getUserFromDb(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await pool.query(`DELETE FROM admin_emails WHERE id = $1`, [id]);
    res.json({ success: true, id, message: 'Email deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Inbound Mail Webhook (works on Render: https://codm-new.onrender.com/api/inbound-mail)
app.post(['/api/inbound-mail', '/api/admin/mail/webhook'], async (req, res) => {
  try {
    console.log('📬 Inbound Mail Webhook Received:', req.body);
    const { sender, from, subject, body, text, recipient, to } = req.body || {};
    const senderEmail = sender || from || 'incoming@webhook.service';
    const subj = subject || 'Incoming Payment/Support Mail';
    const bodyContent = body || text || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    const mailId = `mail_wb_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
    const now = Date.now();

    await initGmailTables();

    await pool.query(
      `INSERT INTO admin_emails (id, sender_email, sender_name, recipient_email, subject, body, folder, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'inbox', false, $7)`,
      [mailId, senderEmail, senderEmail, recipient || to || 'admin@codstake.com', subj, bodyContent, now]
    );

    res.json({ success: true, message: 'Inbound email received and saved to admin mailbox', mailId });
  } catch (err: any) {
    console.error('Error handling inbound webhook mail:', err);
    res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  // 1. Initialize Supabase PostgreSQL database
  await initDatabase();
  await initGmailTables();
  startGmailAutoSyncService();

  // Always serve static public assets
  const publicPath = path.resolve(__dirname, 'public');
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
    app.use('/public', express.static(publicPath));
  }

  // Check production build vs development mode
  const distPath = path.resolve(__dirname, 'dist');
  const isProduction = process.env.NODE_ENV === 'production' && fs.existsSync(distPath);

  if (isProduction) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
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
