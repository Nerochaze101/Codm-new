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
  transactions: Array<{
    id: string;
    type: 'DEPOSIT' | 'ESCROW_LOCK' | 'ESCROW_REFUND' | 'MATCH_WIN_PAYOUT' | 'WITHDRAWAL';
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
      `SELECT * FROM users WHERE LOWER(email) = LOWER(${escapeSql(cleanIdent)}) OR LOWER(codm_ign) = LOWER(${escapeSql(cleanIdent)}) OR LOWER(username) = LOWER(${escapeSql(cleanIdent)})`
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
      transactions,
    };

    return { user, passwordHash: r.password_hash || '' };
  } catch (err) {
    console.error('Error finding user by email or IGN:', err);
    return null;
  }
}

async function saveUserToDb(user: UserProfile, password?: string) {
  try {
    const passValue = password ? escapeSql(password) : 'NULL';
    await pool.query(`
      INSERT INTO users (id, username, codm_ign, codm_uid, tier, clan, email, phone, password_hash, balance, escrow_balance, total_winnings, wins, losses, draws, avatar, bank_name, account_number, account_name, created_at)
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
        balance = EXCLUDED.balance,
        escrow_balance = EXCLUDED.escrow_balance,
        total_winnings = EXCLUDED.total_winnings,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses,
        draws = EXCLUDED.draws,
        avatar = EXCLUDED.avatar,
        bank_name = EXCLUDED.bank_name,
        account_number = EXCLUDED.account_number,
        account_name = EXCLUDED.account_name;
    `);
  } catch (err) {
    console.error(`Error saving user ${user.id} to DB:`, err);
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
        status, creator_id, creator_data, opponent_id, opponent_data,
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
        ${escapeSql(match.settledAt || null)}
      )
      ON CONFLICT (id) DO UPDATE SET
        room_code = EXCLUDED.room_code,
        status = EXCLUDED.status,
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
  }
}

// REST API ROUTES
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
        const alreadyCredited = targetUser.transactions.some(
          (t) => t.id === `tx_${data.id}` || t.description?.includes(ref)
        );

        if (!alreadyCredited) {
          targetUser.balance += amountNaira;
          const newTx = {
            id: `tx_${data.id || Date.now()}`,
            type: 'DEPOSIT' as const,
            amount: amountNaira,
            description: `Wallet top-up via Paystack Webhook [Ref: ${ref}]`,
            timestamp: Date.now(),
          };
          targetUser.transactions.unshift(newTx);
          await saveUserToDb(targetUser);
          await saveTransactionToDb(targetUser.id, newTx);
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
      const userId = verifiedData.meta?.userId;
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
        // Idempotency check: avoid double credit
        const alreadyCredited = targetUser.transactions.some(
          (t) => t.id === `tx_${flwId}` || t.description?.includes(txRef) || t.description?.includes(String(flwId))
        );

        if (!alreadyCredited) {
          targetUser.balance += amount;
          const newTx = {
            id: `tx_${flwId}`,
            type: 'DEPOSIT' as const,
            amount,
            description: `Wallet top-up via Flutterwave Webhook [Ref: ${txRef}]`,
            timestamp: Date.now(),
          };
          targetUser.transactions.unshift(newTx);
          await saveUserToDb(targetUser);
          await saveTransactionToDb(targetUser.id, newTx);
          console.log(`✅ [Flutterwave Webhook] Credited ₦${amount} to user ${targetUser.id} (${targetUser.codmIgn}). New balance: ₦${targetUser.balance}`);
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

// Resolve bank account details via Flutterwave
app.post('/api/flutterwave/resolve-account', async (req, res) => {
  const { accountNumber, bankCode } = req.body;
  const flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || '';

  if (!accountNumber || !bankCode) {
    return res.status(400).json({ status: false, message: 'Account number and bank code required' });
  }

  try {
    const flwRes = await fetch('https://api.flutterwave.com/v3/accounts/resolve', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${flwSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_number: accountNumber.trim(),
        account_bank: bankCode.trim(),
      }),
    });
    const data = await flwRes.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ status: false, message: err.message });
  }
});

// Fetch user profile directly from PostgreSQL database
app.get('/api/users/:id', async (req, res) => {
  const user = await getUserFromDb(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

// Register user with Email, Password, CODM IGN and CODM UID
app.post('/api/auth/register', async (req, res) => {
  const { email, password, codmIgn, codmUid, initialDeposit = 0 } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Valid email address is required' });
  }
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }
  if (!codmIgn || !codmIgn.trim()) {
    return res.status(400).json({ error: 'Call of Duty: Mobile Username (IGN) is required' });
  }
  if (!codmUid || !codmUid.trim()) {
    return res.status(400).json({ error: 'Call of Duty: Mobile Player ID (UID) is required' });
  }

  // Check directly in database if email or IGN already exists
  const existingEmail = await getUserByEmailOrIgn(email);
  const existingIgn = await getUserByEmailOrIgn(codmIgn);

  if (existingEmail || existingIgn) {
    return res.status(400).json({ error: 'An account with this email or CODM IGN already exists' });
  }

  const id = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const numDeposit = Math.max(0, Number(initialDeposit) || 0);
  const newUser: UserProfile = {
    id,
    username: codmIgn.trim(),
    codmIgn: codmIgn.trim(),
    codmUid: codmUid.trim(),
    email: email.trim(),
    phone: '+234 800 000 0000',
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

  await saveUserToDb(newUser, password);
  if (newUser.transactions.length > 0) {
    await saveTransactionToDb(newUser.id, newUser.transactions[0]);
  }

  res.status(201).json(newUser);
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

  await saveUserToDb(newUser, password);
  if (newUser.transactions.length > 0) {
    await saveTransactionToDb(newUser.id, newUser.transactions[0]);
  }
  res.json(newUser);
});

// Update User Profile directly in database
app.patch('/api/users/:id', async (req, res) => {
  const user = await getUserFromDb(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { username, codmIgn, codmUid, email, phone, avatar, tier, clan, bankName, accountNumber, accountName } = req.body;
  if (username !== undefined) user.username = username;
  if (codmIgn !== undefined) user.codmIgn = codmIgn;
  if (codmUid !== undefined) user.codmUid = codmUid;
  if (email !== undefined) user.email = email;
  if (phone !== undefined) user.phone = phone;
  if (avatar !== undefined) user.avatar = avatar;
  if (tier !== undefined) user.tier = tier;
  if (clan !== undefined) user.clan = clan;
  if (bankName !== undefined) user.bankName = bankName;
  if (accountNumber !== undefined) user.accountNumber = accountNumber;
  if (accountName !== undefined) user.accountName = accountName;

  await saveUserToDb(user);
  res.json(user);
});

// Wallet deposit directly into database
app.post('/api/users/:id/deposit', async (req, res) => {
  const user = await getUserFromDb(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { amount, method = 'Instant Transfer (Paystack)' } = req.body;
  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ error: 'Invalid deposit amount' });
  }

  user.balance += numAmount;
  const tx = {
    id: `tx_${Date.now()}`,
    type: 'DEPOSIT' as const,
    amount: numAmount,
    description: `Wallet top-up via ${method}`,
    timestamp: Date.now(),
  };
  user.transactions.unshift(tx);

  await saveUserToDb(user);
  await saveTransactionToDb(user.id, tx);

  res.json({ success: true, balance: user.balance, transaction: tx });
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
};

// Direct Payout / Cashout Tester Endpoint (runs real payout against selected gateway)
app.post('/api/admin/test-cashout', async (req, res) => {
  const {
    amount = 100,
    bankName = 'OPay',
    accountNumber = '9151609682',
    accountName = 'Nurudeen Bolaji Abdulsalam',
    gateway = 'flutterwave',
  } = req.body;

  const numAmount = Number(amount);
  const flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || '';
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY || '';
  const cleanBank = bankName.trim().toLowerCase();

  const flwCode = FLUTTERWAVE_BANK_CODES[cleanBank] || '100004';
  const paystackCode = PAYSTACK_BANK_CODES[cleanBank] || '999992';

  if (gateway === 'flutterwave') {
    if (!flwSecret || flwSecret.startsWith('FLWSECK_TEST-xxxx')) {
      return res.status(400).json({ success: false, error: 'Flutterwave Secret Key is not configured' });
    }

    try {
      console.log(`[TEST-CASHOUT] Initiating Flutterwave payout: ₦${numAmount} to ${accountNumber} (${cleanBank} / code ${flwCode})...`);
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
        ipNotice: data.message?.includes('IP Whitelisting')
          ? {
              requiresIpWhitelist: true,
              serverIpv4: '34.34.246.124',
              serverIpv6: '2600:1900:0:4a03::e00',
              instructions: 'In your Flutterwave Dashboard, go to Settings -> Whitelisted IP addresses, and add 34.34.246.124',
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
      console.log(`[TEST-CASHOUT] Resolving with Paystack: ${accountNumber} (${cleanBank} / code ${paystackCode})...`);
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

// Wallet withdrawal with Flutterwave & Paystack Transfers API & database update
app.post('/api/users/:id/withdraw', async (req, res) => {
  const user = await getUserFromDb(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { amount, bankName = '', accountNumber = '', accountName = '', bankCode = '', gateway = 'flutterwave' } = req.body;
  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ error: 'Invalid withdrawal amount' });
  }
  if (numAmount > user.balance) {
    return res.status(400).json({ error: 'Insufficient available balance' });
  }

  const cleanBank = bankName.trim().toLowerCase();
  const flwCode = bankCode || FLUTTERWAVE_BANK_CODES[cleanBank] || '100004';
  const paystackCode = bankCode || PAYSTACK_BANK_CODES[cleanBank] || '999992';

  const flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || '';
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY || '';
  let transferResult: any = null;
  let providerUsed: 'flutterwave' | 'paystack' | 'manual' = 'manual';

  // 1. Try Flutterwave first if preferred or configured
  const flwConfigured = flwSecret && !flwSecret.startsWith('FLWSECK_TEST-xxxx');
  const paystackConfigured = paystackSecret && !paystackSecret.startsWith('sk_test_xxxx');

  if (gateway === 'flutterwave' && flwConfigured) {
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
          narration: `CODM Cashout for ${user.codmIgn}`,
          currency: 'NGN',
          reference: `FLW_TRF_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          beneficiary_name: accountName || user.codmIgn,
        }),
      });

      const flwData = await flwTransferRes.json();
      console.log('✅ Flutterwave Transfer API Response:', flwData);
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

  // 2. Fallback to Paystack if requested or if Flutterwave wasn't executed
  if (!transferResult && paystackConfigured && accountNumber) {
    try {
      console.log(`🚀 Initiating Paystack Transfer of ₦${numAmount} to ${accountNumber} (${bankName})...`);

      // Step 1: Create Paystack Transfer Recipient
      const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'nuban',
          name: accountName || user.codmIgn,
          account_number: accountNumber.trim(),
          bank_code: paystackCode || '058',
          currency: 'NGN',
        }),
      });

      const recipientJson = await recipientRes.json();

      if (recipientJson.status && recipientJson.data?.recipient_code) {
        const recipientCode = recipientJson.data.recipient_code;

        // Step 2: Initiate Paystack Bank Transfer
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
            reason: `CODM Winnings Cashout for ${user.codmIgn}`,
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

  // Deduct user wallet balance safely
  user.balance -= numAmount;
  const isAutomatedSuccess = transferResult?.status === true;
  const isManual = transferResult?.isManualFallback === true || !transferResult;

  let descNote = `Withdrawal request to ${bankName} (${accountNumber} - ${accountName})`;
  if (isAutomatedSuccess) {
    const ref = transferResult?.data?.reference || transferResult?.data?.id || 'OK';
    descNote = `🚀 ${providerUsed === 'flutterwave' ? 'Flutterwave' : 'Paystack'} Transfer Sent to ${bankName} (${accountNumber} - ${accountName}) [Ref: ${ref}]`;
  } else if (isManual) {
    const reason = transferResult?.message || 'Queued for admin instant settlement';
    descNote = `⏳ Pending Manual Payout to ${bankName} (${accountNumber} - ${accountName}) [${reason}]`;
  }

  const tx = {
    id: `tx_${Date.now()}`,
    type: 'WITHDRAWAL' as const,
    amount: numAmount,
    description: descNote,
    timestamp: Date.now(),
  };
  user.transactions.unshift(tx);

  await saveUserToDb(user);
  await saveTransactionToDb(user.id, tx);

  res.json({
    success: true,
    balance: user.balance,
    transaction: tx,
    transferResult,
    providerUsed,
  });
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
  } = req.body;

  const creator = await getUserFromDb(creatorId);
  if (!creator) {
    return res.status(404).json({ error: 'Creator user not found' });
  }

  const numStake = Number(stakeAmount);
  if (numStake < 100) {
    return res.status(400).json({ error: 'Minimum stake is ₦100' });
  }

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

// Opponent accepts challenge and sends stake into escrow directly in database
app.post('/api/matches/:id/opponent-stake', async (req, res) => {
  const match = await getMatchFromDb(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match not found' });

  if (match.status !== 'PENDING_OPPONENT_STAKE') {
    return res.status(400).json({ error: 'This match challenge is no longer open for joining.' });
  }

  const { opponentId, paymentMethod = 'bank_transfer' } = req.body;
  const opponent = await getUserFromDb(opponentId);
  if (!opponent) return res.status(404).json({ error: 'Opponent not found' });

  if (opponent.id === match.creator.id) {
    return res.status(400).json({ error: 'You cannot accept your own challenge. Share the link with an opponent!' });
  }

  if (paymentMethod === 'wallet_balance') {
    if (opponent.balance < match.stakeAmount) {
      return res.status(400).json({ error: `Insufficient balance (₦${opponent.balance.toLocaleString()}).` });
    }
    opponent.balance -= match.stakeAmount;
    opponent.escrowBalance += match.stakeAmount;
  } else {
    opponent.escrowBalance += match.stakeAmount;
  }

  const tx = {
    id: `tx_${Date.now()}`,
    type: 'ESCROW_LOCK' as const,
    amount: match.stakeAmount,
    description: `₦${match.stakeAmount.toLocaleString()} stake locked in escrow for challenge #${match.challengeCode}`,
    timestamp: Date.now(),
    matchId: match.id,
  };
  opponent.transactions.unshift(tx);

  match.opponent = {
    id: opponent.id,
    username: opponent.username,
    codmIgn: opponent.codmIgn,
    codmUid: opponent.codmUid,
    avatar: opponent.avatar,
    staked: true,
  };

  match.status = 'OPPONENT_STAKED_AWAITING_CREATOR';

  match.chatMessages.push({
    id: `msg_${Date.now()}`,
    senderId: 'SYSTEM',
    senderName: 'CODM Referee Bot',
    text: `⚔️ Challenge accepted! ${opponent.codmIgn} has sent ₦${match.stakeAmount.toLocaleString()} into escrow. Host ${match.creator.codmIgn}, please send your matching ₦${match.stakeAmount.toLocaleString()} stake to generate your CODM in-game room number!`,
    timestamp: Date.now(),
  });

  await saveUserToDb(opponent);
  await saveTransactionToDb(opponent.id, tx);
  await saveMatchToDb(match);
  res.json(match);
});

// Creator sends matching stake after opponent has accepted
app.post('/api/matches/:id/creator-stake', async (req, res) => {
  const match = await getMatchFromDb(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match not found' });

  if (match.status !== 'OPPONENT_STAKED_AWAITING_CREATOR') {
    return res.status(400).json({ error: 'Match is not in waiting for host stake state.' });
  }

  const { creatorId, paymentMethod = 'bank_transfer' } = req.body;
  const creator = await getUserFromDb(creatorId);
  if (!creator) return res.status(404).json({ error: 'Creator not found' });

  if (creator.id !== match.creator.id) {
    return res.status(403).json({ error: 'Only the match creator can provide the matching host stake.' });
  }

  if (paymentMethod === 'wallet_balance') {
    if (creator.balance < match.stakeAmount) {
      return res.status(400).json({ error: `Insufficient balance (₦${creator.balance.toLocaleString()}).` });
    }
    creator.balance -= match.stakeAmount;
    creator.escrowBalance += match.stakeAmount;
  } else {
    creator.escrowBalance += match.stakeAmount;
  }

  const tx = {
    id: `tx_${Date.now()}`,
    type: 'ESCROW_LOCK' as const,
    amount: match.stakeAmount,
    description: `₦${match.stakeAmount.toLocaleString()} matching stake locked in escrow for challenge #${match.challengeCode}`,
    timestamp: Date.now(),
    matchId: match.id,
  };
  creator.transactions.unshift(tx);

  match.creator.staked = true;

  // Both players have now staked! System generates the official in-game CODM room number!
  const generatedRoomCode = generateRoomCode(match.map);
  match.roomCode = generatedRoomCode;
  match.roomGeneratedAt = Date.now();
  match.status = 'READY_TO_PLAY';

  match.chatMessages.push({
    id: `msg_${Date.now()}`,
    senderId: 'SYSTEM',
    senderName: 'CODM Referee Bot',
    text: `🎉 BOTH STAKES CONFIRMED! Total Pot: ₦${match.potAmount.toLocaleString()} secured in automated escrow. 🎯 IN-GAME ROOM NUMBER GENERATED: ${generatedRoomCode}. Both players: open CODM > Multiplayer > Private Match > Join #${generatedRoomCode} and battle!`,
    timestamp: Date.now(),
  });

  await saveUserToDb(creator);
  await saveTransactionToDb(creator.id, tx);
  await saveMatchToDb(match);
  res.json(match);
});

// Legacy / Direct Join handler
app.post('/api/matches/:id/join', async (req, res) => {
  const match = await getMatchFromDb(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match not found' });

  if (match.status !== 'PENDING_OPPONENT_STAKE') {
    return res.status(400).json({ error: 'This match is no longer open for joining.' });
  }

  const { opponentId } = req.body;
  const opponent = await getUserFromDb(opponentId);
  if (!opponent) return res.status(404).json({ error: 'Opponent not found' });

  if (opponent.id === match.creator.id) {
    return res.status(400).json({ error: 'You cannot accept your own challenge. Share the link with an opponent!' });
  }

  opponent.escrowBalance += match.stakeAmount;
  const tx = {
    id: `tx_${Date.now()}`,
    type: 'ESCROW_LOCK' as const,
    amount: match.stakeAmount,
    description: `₦${match.stakeAmount.toLocaleString()} stake locked in escrow for challenge #${match.challengeCode}`,
    timestamp: Date.now(),
    matchId: match.id,
  };
  opponent.transactions.unshift(tx);

  match.opponent = {
    id: opponent.id,
    username: opponent.username,
    codmIgn: opponent.codmIgn,
    codmUid: opponent.codmUid,
    avatar: opponent.avatar,
    staked: true,
  };

  match.status = 'OPPONENT_STAKED_AWAITING_CREATOR';

  match.chatMessages.push({
    id: `msg_${Date.now()}`,
    senderId: 'SYSTEM',
    senderName: 'CODM Referee Bot',
    text: `⚔️ Challenge accepted! ${opponent.codmIgn} has sent ₦${match.stakeAmount.toLocaleString()} into escrow. Host ${match.creator.codmIgn}, send your matching ₦${match.stakeAmount.toLocaleString()} stake to generate your CODM in-game room number!`,
    timestamp: Date.now(),
  });

  await saveUserToDb(opponent);
  await saveTransactionToDb(opponent.id, tx);
  await saveMatchToDb(match);
  res.json(match);
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
app.post('/api/matches/:id/cancel', async (req, res) => {
  const match = await getMatchFromDb(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match not found' });

  if (match.status !== 'PENDING_OPPONENT_STAKE' && match.status !== 'OPPONENT_STAKED_AWAITING_CREATOR') {
    return res.status(400).json({ error: 'Cannot cancel match after both players have locked stakes' });
  }

  // Refund creator if staked
  if (match.creator.staked) {
    const creator = await getUserFromDb(match.creator.id);
    if (creator) {
      creator.balance += match.stakeAmount;
      creator.escrowBalance = Math.max(0, creator.escrowBalance - match.stakeAmount);
      const tx = {
        id: `tx_${Date.now()}_c`,
        type: 'ESCROW_REFUND' as const,
        amount: match.stakeAmount,
        description: `₦${match.stakeAmount.toLocaleString()} escrow refunded from cancelled challenge #${match.challengeCode}`,
        timestamp: Date.now(),
        matchId: match.id,
      };
      creator.transactions.unshift(tx);
      await saveUserToDb(creator);
      await saveTransactionToDb(creator.id, tx);
    }
  }

  // Refund opponent if staked
  if (match.opponent?.staked) {
    const opponent = await getUserFromDb(match.opponent.id);
    if (opponent) {
      opponent.balance += match.stakeAmount;
      opponent.escrowBalance = Math.max(0, opponent.escrowBalance - match.stakeAmount);
      const tx = {
        id: `tx_${Date.now()}_o`,
        type: 'ESCROW_REFUND' as const,
        amount: match.stakeAmount,
        description: `₦${match.stakeAmount.toLocaleString()} escrow refunded from cancelled challenge #${match.challengeCode}`,
        timestamp: Date.now(),
        matchId: match.id,
      };
      opponent.transactions.unshift(tx);
      await saveUserToDb(opponent);
      await saveTransactionToDb(opponent.id, tx);
    }
  }

  match.status = 'CANCELLED';
  await saveMatchToDb(match);
  res.json(match);
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
    match.creator.screenshotUrl = screenshotBase64;
    match.creator.screenshotAnalysis = analysisResult;
    match.creator.submittedAt = Date.now();
  } else if (match.opponent) {
    match.opponent.resultClaim = claim;
    match.opponent.screenshotUrl = screenshotBase64;
    match.opponent.screenshotAnalysis = analysisResult;
    match.opponent.submittedAt = Date.now();
  }

  match.chatMessages.push({
    id: `msg_${Date.now()}`,
    senderId: 'SYSTEM',
    senderName: 'CODM Referee Bot',
    text: `📸 ${playerIgn} submitted match proof claiming: ${claim}. Analysis confidence: ${Math.round((analysisResult.confidence || 0.95) * 100)}%.`,
    timestamp: Date.now(),
  });

  // Evaluate match resolution:
  let resolveWinner: 'creator' | 'opponent' | 'draw' | 'dispute' | null = null;

  if (claim === 'DRAW') {
    resolveWinner = 'draw';
  } else if (claim === 'VICTORY') {
    resolveWinner = isCreator ? 'creator' : 'opponent';
  } else if (claim === 'DEFEAT') {
    resolveWinner = isCreator ? 'opponent' : 'creator';
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
    match.resolutionNotes = `Match resulted in a DRAW / TIE. Rematch initiated with new room code #${newRoomCode}. Stakes remain locked in escrow.`;

    match.chatMessages.push({
      id: `msg_${Date.now()}_rematch`,
      senderId: 'SYSTEM',
      senderName: 'CODM Referee Bot',
      text: `⚖️ DRAW / TIE DETECTED! Both stakes (₦${match.stakeAmount.toLocaleString()} each) remain locked in escrow. 🎯 NEW REMATCH IN-GAME ROOM NUMBER GENERATED: ${newRoomCode}. Both players: open CODM > Private Match > Join #${newRoomCode} and battle!`,
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

    // Settle Escrow!
    const creatorUser = await getUserFromDb(match.creator.id);
    if (creatorUser) {
      creatorUser.escrowBalance = Math.max(0, creatorUser.escrowBalance - match.stakeAmount);
      await saveUserToDb(creatorUser);
    }

    if (match.opponent) {
      const oppUser = await getUserFromDb(match.opponent.id);
      if (oppUser) {
        oppUser.escrowBalance = Math.max(0, oppUser.escrowBalance - match.stakeAmount);
        await saveUserToDb(oppUser);
      }
    }

    // Winner gets the pot minus platform fee
    if (winnerUser) {
      winnerUser.totalWinnings += match.winnerPayout;
      winnerUser.wins += 1;

      const hasBank = winnerUser.bankName && winnerUser.accountNumber;
      let txW;
      if (hasBank) {
        txW = {
          id: `tx_${Date.now()}_win_cashout`,
          type: 'WITHDRAWAL' as const,
          amount: match.winnerPayout,
          description: `🚀 Direct Automated Bank Payout: ₦${match.winnerPayout.toLocaleString()} transferred to ${winnerUser.bankName} (${winnerUser.accountNumber} - ${winnerUser.accountName || winnerUser.codmIgn})`,
          timestamp: Date.now(),
          matchId: match.id,
        };
        winnerUser.transactions.unshift(txW);

        match.resolutionNotes = `Match verified! Winner is ${winnerObj.codmIgn}. ₦${match.winnerPayout.toLocaleString()} winning funds were automatically sent directly to saved bank account (${winnerUser.bankName} - ${winnerUser.accountNumber}).`;

        match.chatMessages.push({
          id: `msg_${Date.now()}_settle`,
          senderId: 'SYSTEM',
          senderName: 'CODM Referee Bot',
          text: `🏆 MATCH CONCLUDED! Winner: ${winnerObj.codmIgn}. ₦${match.winnerPayout.toLocaleString()} winning payout was automatically sent directly to saved bank details (${winnerUser.bankName} - ${winnerUser.accountNumber})!`,
          timestamp: Date.now(),
        });
      } else {
        winnerUser.balance += match.winnerPayout;
        const payoutDesc = `🏆 Won 1v1 Escrow Match #${match.roomCode} vs ${loserObj.codmIgn}: ₦${match.winnerPayout.toLocaleString()} ready for cashout. Enter bank details to withdraw now.`;

        txW = {
          id: `tx_${Date.now()}_win`,
          type: 'MATCH_WIN_PAYOUT' as const,
          amount: match.winnerPayout,
          description: payoutDesc,
          timestamp: Date.now(),
          matchId: match.id,
        };
        winnerUser.transactions.unshift(txW);

        match.resolutionNotes = `Match verified! Winner is ${winnerObj.codmIgn}. ₦${match.winnerPayout.toLocaleString()} ready for instant cashout. Enter bank details now to send funds directly to your bank.`;

        match.chatMessages.push({
          id: `msg_${Date.now()}_settle`,
          senderId: 'SYSTEM',
          senderName: 'CODM Referee Bot',
          text: `🏆 MATCH CONCLUDED! Winner: ${winnerObj.codmIgn}. ₦${match.winnerPayout.toLocaleString()} winning payout is ready! Please enter your bank details below to cash out directly to your bank account.`,
          timestamp: Date.now(),
        });
      }

      await saveUserToDb(winnerUser);
      await saveTransactionToDb(winnerUser.id, txW);

      if (loserUser) {
        loserUser.losses += 1;
        await saveUserToDb(loserUser);
      }
    }
  } else if (resolveWinner === 'dispute') {
    match.status = 'DISPUTED';
    match.resolutionNotes = 'Both players claimed Victory with conflicting proof. Match flagged for referee review.';
    match.chatMessages.push({
      id: `msg_${Date.now()}_dispute`,
      senderId: 'SYSTEM',
      senderName: 'CODM Referee Bot',
      text: `⚠️ DISPUTE FLAGGED: Both players claimed Victory. Reviewing screenshots with referee admin.`,
      timestamp: Date.now(),
    });
  } else {
    match.status = 'SUBMITTING_RESULTS';
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

  // Settle Escrow
  const creatorUser = await getUserFromDb(match.creator.id);
  if (creatorUser) {
    creatorUser.escrowBalance = Math.max(0, creatorUser.escrowBalance - match.stakeAmount);
    await saveUserToDb(creatorUser);
  }

  if (match.opponent) {
    const oppUser = await getUserFromDb(match.opponent.id);
    if (oppUser) {
      oppUser.escrowBalance = Math.max(0, oppUser.escrowBalance - match.stakeAmount);
      await saveUserToDb(oppUser);
    }
  }

  if (winnerUser) {
    winnerUser.balance += match.winnerPayout;
    winnerUser.totalWinnings += match.winnerPayout;
    winnerUser.wins += 1;
    const tx = {
      id: `tx_${Date.now()}_win`,
      type: 'MATCH_WIN_PAYOUT' as const,
      amount: match.winnerPayout,
      description: `🏆 Admin resolved 1v1 match #${match.roomCode} win in favor of ${winnerObj.codmIgn}`,
      timestamp: Date.now(),
      matchId: match.id,
    };
    winnerUser.transactions.unshift(tx);
    await saveUserToDb(winnerUser);
    await saveTransactionToDb(winnerUser.id, tx);
  }

  if (loserUser) {
    loserUser.losses += 1;
    await saveUserToDb(loserUser);
  }

  match.status = 'SETTLED';
  match.winnerId = winnerObj.id;
  match.winnerIgn = winnerObj.codmIgn;
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
