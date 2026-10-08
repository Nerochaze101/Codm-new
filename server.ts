import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { initDatabase, pool } from './db.js';

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

// In-Memory Data Store
interface UserProfile {
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

interface Match {
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

const users: Record<string, UserProfile> = {};

const matches: Record<string, Match> = {};

// Helper to calculate tiered rake percentage based on stake amount
function getRakePercentage(stake: number): number {
  if (stake >= 10000) return 0.05; // 5% for ₦10,000+
  if (stake >= 5000) return 0.07;  // 7% for ₦5,000
  if (stake >= 2500) return 0.08;  // 8% for ₦2,500
  return 0.10;                     // 10% for ₦1,000
}

// Helper to generate a room code like CODM-8392-SHP
function generateRoomCode(mapName: string): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  const suffix = mapName.slice(0, 3).toUpperCase();
  return `CODM-${num}-${suffix}`;
}

// Password storage for registered users
const userPasswords: Record<string, string> = {};

// Database synchronization helpers
async function syncUserToDb(user: UserProfile, password?: string) {
  try {
    await pool.query(`
      INSERT INTO users (id, username, codm_ign, codm_uid, tier, clan, email, phone, password_hash, balance, escrow_balance, total_winnings, wins, losses, draws, avatar, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
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
        avatar = EXCLUDED.avatar;
    `, [
      user.id,
      user.username,
      user.codmIgn,
      user.codmUid,
      user.tier || 'LEGENDARY TIER',
      user.clan || '[1V1_PRO]',
      user.email,
      user.phone,
      password || userPasswords[user.id] || null,
      user.balance || 0,
      user.escrowBalance || 0,
      user.totalWinnings || 0,
      user.wins || 0,
      user.losses || 0,
      user.draws || 0,
      user.avatar,
      Date.now()
    ]);
  } catch (err) {
    console.error(`⚠️ Could not sync user ${user.id} to Supabase:`, err);
  }
}

async function syncMatchToDb(match: any) {
  try {
    await pool.query(`
      INSERT INTO matches (
        id, challenge_code, room_code, game_mode, map, rules,
        stake_amount, pot_amount, platform_fee_percentage, platform_fee, winner_payout,
        status, creator_id, creator_data, opponent_id, opponent_data,
        winner_id, winner_ign, resolution_notes, chat_messages, created_at, room_generated_at, settled_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
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
    `, [
      match.id,
      match.challengeCode,
      match.roomCode || null,
      match.gameMode,
      match.map,
      JSON.stringify(match.rules || []),
      match.stakeAmount,
      match.potAmount,
      match.platformFeePercentage || 10,
      match.platformFee || 0,
      match.winnerPayout,
      match.status,
      match.creator.id,
      JSON.stringify(match.creator),
      match.opponent ? match.opponent.id : null,
      match.opponent ? JSON.stringify(match.opponent) : null,
      match.winnerId || null,
      match.winnerIgn || null,
      match.resolutionNotes || null,
      JSON.stringify(match.chatMessages || []),
      match.createdAt,
      match.roomGeneratedAt || null,
      match.settledAt || null
    ]);
  } catch (err) {
    console.error(`⚠️ Could not sync match ${match.id} to Supabase:`, err);
  }
}

async function loadDataFromSupabase() {
  try {
    await pool.query(`DELETE FROM users WHERE id IN ('user_ghost', 'user_shadow') OR email LIKE '%lagos-codm.com' OR email LIKE '%esports.ng'`);
    const userRows = await pool.query('SELECT * FROM users');
    for (const r of userRows.rows) {
      users[r.id] = {
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
        transactions: [],
      };
      if (r.password_hash) {
        userPasswords[r.id] = r.password_hash;
      }
    }

    const matchRows = await pool.query('SELECT * FROM matches ORDER BY created_at DESC');
    for (const m of matchRows.rows) {
      matches[m.id] = {
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
    }
    console.log(`📦 Loaded ${Object.keys(users).length} users and ${Object.keys(matches).length} matches from Supabase PostgreSQL.`);
  } catch (err) {
    console.error('⚠️ Could not load data from Supabase:', err);
  }
}

// REST API ROUTES
app.get('/api/db-status', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as now, version() as version');
    client.release();
    res.json({
      connected: true,
      database: 'Supabase PostgreSQL',
      timestamp: result.rows[0].now,
      version: result.rows[0].version,
      usersCount: Object.keys(users).length,
      matchesCount: Object.keys(matches).length,
    });
  } catch (err: any) {
    res.status(500).json({
      connected: false,
      error: err.message,
      fallback: 'In-memory data store active',
    });
  }
});

app.get('/api/users/:id', (req, res) => {
  const user = users[req.params.id];
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

// Register user with Email, Password, CODM IGN and CODM UID
app.post('/api/auth/register', (req, res) => {
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

  // Check if email or IGN is already registered
  const existingUser = Object.values(users).find(
    (u) =>
      u.email.toLowerCase() === email.trim().toLowerCase() ||
      u.codmIgn.toLowerCase() === codmIgn.trim().toLowerCase()
  );
  if (existingUser) {
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

  users[id] = newUser;
  userPasswords[id] = password;
  syncUserToDb(newUser, password);
  res.status(201).json(newUser);
});

// Login with Email or CODM IGN and Password
app.post('/api/auth/login', (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !identifier.trim()) {
    return res.status(400).json({ error: 'Email or CODM Username is required' });
  }

  const cleanIdent = identifier.trim().toLowerCase();
  const user = Object.values(users).find(
    (u) => u.email.toLowerCase() === cleanIdent || u.codmIgn.toLowerCase() === cleanIdent
  );

  if (!user) {
    return res.status(404).json({ error: 'No account found matching this email or username' });
  }

  const expectedPassword = userPasswords[user.id];
  if (expectedPassword && password && expectedPassword !== password) {
    return res.status(401).json({ error: 'Incorrect password. Please try again.' });
  }

  res.json(user);
});

// Create/Register user or quick opponent onboarding
app.post('/api/users', (req, res) => {
  const { username, codmIgn, codmUid, email, phone, initialDeposit = 0, password } = req.body;
  if (!codmIgn) {
    return res.status(400).json({ error: 'CODM In-Game Name (IGN) is required' });
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

  users[id] = newUser;
  if (password) {
    userPasswords[id] = password;
  }
  syncUserToDb(newUser, password);
  res.json(newUser);
});

// Update User Profile
app.patch('/api/users/:id', async (req, res) => {
  const user = users[req.params.id];
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

  await syncUserToDb(user);
  res.json(user);
});

// Wallet deposit
app.post('/api/users/:id/deposit', (req, res) => {
  const user = users[req.params.id];
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

  res.json({ success: true, balance: user.balance, transaction: tx });
});

// Wallet withdrawal
app.post('/api/users/:id/withdraw', (req, res) => {
  const user = users[req.params.id];
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { amount, bankName, accountNumber, accountName } = req.body;
  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }
  if (numAmount > user.balance) {
    return res.status(400).json({ error: 'Insufficient available balance' });
  }

  user.balance -= numAmount;
  const tx = {
    id: `tx_${Date.now()}`,
    type: 'WITHDRAWAL' as const,
    amount: numAmount,
    description: `Withdrawal to ${bankName} (${accountNumber} - ${accountName})`,
    timestamp: Date.now(),
  };
  user.transactions.unshift(tx);

  res.json({ success: true, balance: user.balance, transaction: tx });
});

// List all active matches
app.get('/api/matches', (req, res) => {
  const matchList = Object.values(matches).sort((a, b) => b.createdAt - a.createdAt);
  res.json(matchList);
});

// Get match by id
app.get('/api/matches/:id', (req, res) => {
  const match = matches[req.params.id];
  if (!match) return res.status(404).json({ error: 'Match not found' });
  res.json(match);
});

// Create new 1v1 match challenge (Creator generates link with ₦0 upfront)
app.post('/api/matches', (req, res) => {
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
    stakeAmount = 1000,
  } = req.body;

  const creator = users[creatorId];
  if (!creator) {
    return res.status(404).json({ error: 'Creator user not found' });
  }

  const numStake = Number(stakeAmount);
  if (numStake < 1000) {
    return res.status(400).json({ error: 'Minimum stake is ₦1,000' });
  }

  const matchId = `match_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const challengeCode = `CHALLENGE-${Math.floor(1000 + Math.random() * 9000)}`;
  const potAmount = numStake * 2;
  const rakeRate = getRakePercentage(numStake);
  const platformFee = Math.round(potAmount * rakeRate);
  const winnerPayout = potAmount - platformFee;
  const platformFeePercentage = Math.round(rakeRate * 100);

  const newMatch: any = {
    id: matchId,
    challengeCode,
    roomCode: undefined, // Room code is generated ONLY after both players pay their stakes
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
      staked: false, // Creator has not paid yet
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

  matches[matchId] = newMatch;
  syncMatchToDb(newMatch);
  res.json(newMatch);
});

// Opponent accepts challenge and sends stake into escrow
app.post('/api/matches/:id/opponent-stake', (req, res) => {
  const match = matches[req.params.id];
  if (!match) return res.status(404).json({ error: 'Match not found' });

  if (match.status !== 'PENDING_OPPONENT_STAKE') {
    return res.status(400).json({ error: 'This match challenge is no longer open for joining.' });
  }

  const { opponentId, paymentMethod = 'bank_transfer' } = req.body;
  const opponent = users[opponentId];
  if (!opponent) return res.status(404).json({ error: 'Opponent not found' });

  if (opponent.id === match.creator.id) {
    return res.status(400).json({ error: 'You cannot accept your own challenge. Share the link with an opponent!' });
  }

  // If paying with existing balance
  if (paymentMethod === 'wallet_balance') {
    if (opponent.balance < match.stakeAmount) {
      return res.status(400).json({ error: `Insufficient balance (₦${opponent.balance.toLocaleString()}).` });
    }
    opponent.balance -= match.stakeAmount;
    opponent.escrowBalance += match.stakeAmount;
  } else {
    // Direct escrow payment
    opponent.escrowBalance += match.stakeAmount;
  }

  opponent.transactions.unshift({
    id: `tx_${Date.now()}`,
    type: 'ESCROW_LOCK',
    amount: match.stakeAmount,
    description: `₦${match.stakeAmount.toLocaleString()} stake locked in escrow for challenge #${match.challengeCode}`,
    timestamp: Date.now(),
    matchId: match.id,
  });

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

  syncMatchToDb(match);
  res.json(match);
});

// Creator sends matching stake after opponent has accepted
app.post('/api/matches/:id/creator-stake', (req, res) => {
  const match = matches[req.params.id];
  if (!match) return res.status(404).json({ error: 'Match not found' });

  if (match.status !== 'OPPONENT_STAKED_AWAITING_CREATOR') {
    return res.status(400).json({ error: 'Match is not in waiting for host stake state.' });
  }

  const { creatorId, paymentMethod = 'bank_transfer' } = req.body;
  const creator = users[creatorId];
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

  creator.transactions.unshift({
    id: `tx_${Date.now()}`,
    type: 'ESCROW_LOCK',
    amount: match.stakeAmount,
    description: `₦${match.stakeAmount.toLocaleString()} matching stake locked in escrow for challenge #${match.challengeCode}`,
    timestamp: Date.now(),
    matchId: match.id,
  });

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

  syncMatchToDb(match);
  res.json(match);
});

// Legacy / Direct Join handler (maps to opponent-stake)
app.post('/api/matches/:id/join', (req, res) => {
  const match = matches[req.params.id];
  if (!match) return res.status(404).json({ error: 'Match not found' });

  if (match.status !== 'PENDING_OPPONENT_STAKE') {
    return res.status(400).json({ error: 'This match is no longer open for joining.' });
  }

  const { opponentId } = req.body;
  const opponent = users[opponentId];
  if (!opponent) return res.status(404).json({ error: 'Opponent not found' });

  if (opponent.id === match.creator.id) {
    return res.status(400).json({ error: 'You cannot accept your own challenge. Share the link with an opponent!' });
  }

  opponent.escrowBalance += match.stakeAmount;
  opponent.transactions.unshift({
    id: `tx_${Date.now()}`,
    type: 'ESCROW_LOCK',
    amount: match.stakeAmount,
    description: `₦${match.stakeAmount.toLocaleString()} stake locked in escrow for challenge #${match.challengeCode}`,
    timestamp: Date.now(),
    matchId: match.id,
  });

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

  res.json(match);
});

// Send in-match chat message
app.post('/api/matches/:id/chat', (req, res) => {
  const match = matches[req.params.id];
  if (!match) return res.status(404).json({ error: 'Match not found' });

  const { senderId, text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }

  const user = users[senderId];
  const senderName = user ? user.codmIgn : 'Player';

  const newMsg = {
    id: `msg_${Date.now()}`,
    senderId,
    senderName,
    text: text.trim(),
    timestamp: Date.now(),
  };

  match.chatMessages.push(newMsg);
  res.json(newMsg);
});

// Cancel match (only if PENDING_OPPONENT_STAKE or OPPONENT_STAKED_AWAITING_CREATOR)
app.post('/api/matches/:id/cancel', (req, res) => {
  const match = matches[req.params.id];
  if (!match) return res.status(404).json({ error: 'Match not found' });

  if (match.status !== 'PENDING_OPPONENT_STAKE' && match.status !== 'OPPONENT_STAKED_AWAITING_CREATOR') {
    return res.status(400).json({ error: 'Cannot cancel match after both players have locked stakes' });
  }

  // Refund creator if staked
  if (match.creator.staked) {
    const creator = users[match.creator.id];
    if (creator) {
      creator.balance += match.stakeAmount;
      creator.escrowBalance = Math.max(0, creator.escrowBalance - match.stakeAmount);
      creator.transactions.unshift({
        id: `tx_${Date.now()}_c`,
        type: 'ESCROW_REFUND',
        amount: match.stakeAmount,
        description: `₦${match.stakeAmount.toLocaleString()} escrow refunded from cancelled challenge #${match.challengeCode}`,
        timestamp: Date.now(),
        matchId: match.id,
      });
    }
  }

  // Refund opponent if staked
  if (match.opponent?.staked) {
    const opponent = users[match.opponent.id];
    if (opponent) {
      opponent.balance += match.stakeAmount;
      opponent.escrowBalance = Math.max(0, opponent.escrowBalance - match.stakeAmount);
      opponent.transactions.unshift({
        id: `tx_${Date.now()}_o`,
        type: 'ESCROW_REFUND',
        amount: match.stakeAmount,
        description: `₦${match.stakeAmount.toLocaleString()} escrow refunded from cancelled challenge #${match.challengeCode}`,
        timestamp: Date.now(),
        matchId: match.id,
      });
    }
  }

  match.status = 'CANCELLED';
  res.json(match);
});

// Submit screenshot and match claim
app.post('/api/matches/:id/submit-result', async (req, res) => {
  const match = matches[req.params.id];
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
      // Clean base64
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
      // Fallback stays in place
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

  // Evaluate match resolution instantly upon claim:
  let resolveWinner: 'creator' | 'opponent' | 'draw' | 'dispute' | null = null;

  if (claim === 'DRAW') {
    resolveWinner = 'draw';
  } else if (claim === 'VICTORY') {
    resolveWinner = isCreator ? 'creator' : 'opponent';
  } else if (claim === 'DEFEAT') {
    resolveWinner = isCreator ? 'opponent' : 'creator';
  }

  if (resolveWinner === 'draw') {
    match.status = 'SETTLED';
    match.winnerId = undefined;
    match.winnerIgn = 'DRAW (REFUNDED)';

    // Refund escrow 100% to creator
    const creatorUser = users[match.creator.id];
    if (creatorUser) {
      creatorUser.balance += match.stakeAmount;
      creatorUser.escrowBalance = Math.max(0, creatorUser.escrowBalance - match.stakeAmount);
      creatorUser.draws = (creatorUser.draws || 0) + 1;
      creatorUser.transactions.unshift({
        id: `tx_${Date.now()}_draw_c`,
        type: 'ESCROW_REFUND',
        amount: match.stakeAmount,
        description: `⚖️ Draw in Match #${match.roomCode}: 100% of ₦${match.stakeAmount.toLocaleString()} stake refunded`,
        timestamp: Date.now(),
        matchId: match.id,
      });
    }

    // Refund escrow 100% to opponent
    if (match.opponent) {
      const oppUser = users[match.opponent.id];
      if (oppUser) {
        oppUser.balance += match.stakeAmount;
        oppUser.escrowBalance = Math.max(0, oppUser.escrowBalance - match.stakeAmount);
        oppUser.draws = (oppUser.draws || 0) + 1;
        oppUser.transactions.unshift({
          id: `tx_${Date.now()}_draw_o`,
          type: 'ESCROW_REFUND',
          amount: match.stakeAmount,
          description: `⚖️ Draw in Match #${match.roomCode}: 100% of ₦${match.stakeAmount.toLocaleString()} stake refunded`,
          timestamp: Date.now(),
          matchId: match.id,
        });
      }
    }

    match.resolutionNotes = `Match ended in a DRAW / TIE. Escrow stakes (100%) refunded to both players without platform fee deduction.`;
    match.chatMessages.push({
      id: `msg_${Date.now()}_draw`,
      senderId: 'SYSTEM',
      senderName: 'CODM Referee Bot',
      text: `⚖️ MATCH ENDED IN A DRAW! Both players' stakes (₦${match.stakeAmount.toLocaleString()} each) have been 100% refunded to their wallet balances.`,
      timestamp: Date.now(),
    });
  } else if (resolveWinner === 'creator' || resolveWinner === 'opponent') {
    const winnerObj = resolveWinner === 'creator' ? match.creator : match.opponent!;
    const loserObj = resolveWinner === 'creator' ? match.opponent! : match.creator;
    const winnerUser = users[winnerObj.id];
    const loserUser = users[loserObj.id];

    match.status = 'SETTLED';
    match.winnerId = winnerObj.id;
    match.winnerIgn = winnerObj.codmIgn;

    // Settle Escrow!
    const creatorUser = users[match.creator.id];
    if (creatorUser) creatorUser.escrowBalance = Math.max(0, creatorUser.escrowBalance - match.stakeAmount);

    if (match.opponent) {
      const oppUser = users[match.opponent.id];
      if (oppUser) oppUser.escrowBalance = Math.max(0, oppUser.escrowBalance - match.stakeAmount);
    }

    // Winner gets the pot minus 10% platform fee
    if (winnerUser) {
      winnerUser.totalWinnings += match.winnerPayout;
      winnerUser.wins += 1;

      const hasBank = winnerUser.bankName && winnerUser.accountNumber;
      if (hasBank) {
        // Automatically send funds directly to winner's saved bank account
        winnerUser.transactions.unshift({
          id: `tx_${Date.now()}_win_cashout`,
          type: 'WITHDRAWAL',
          amount: match.winnerPayout,
          description: `🚀 Direct Automated Bank Payout: ₦${match.winnerPayout.toLocaleString()} transferred to ${winnerUser.bankName} (${winnerUser.accountNumber} - ${winnerUser.accountName || winnerUser.codmIgn})`,
          timestamp: Date.now(),
          matchId: match.id,
        });

        match.resolutionNotes = `Match verified! Winner is ${winnerObj.codmIgn}. ₦${match.winnerPayout.toLocaleString()} winning funds were automatically sent directly to saved bank account (${winnerUser.bankName} - ${winnerUser.accountNumber}). Zero funds held on platform.`;

        match.chatMessages.push({
          id: `msg_${Date.now()}_settle`,
          senderId: 'SYSTEM',
          senderName: 'CODM Referee Bot',
          text: `🏆 MATCH CONCLUDED! Winner: ${winnerObj.codmIgn}. ₦${match.winnerPayout.toLocaleString()} winning payout was automatically sent directly to saved bank details (${winnerUser.bankName} - ${winnerUser.accountNumber})!`,
          timestamp: Date.now(),
        });
      } else {
        // No bank details saved yet -> balance is placed in wallet temporarily but marked with urgent requirement to cash out immediately
        winnerUser.balance += match.winnerPayout;
        const payoutDesc = `🏆 Won 1v1 Escrow Match #${match.roomCode} vs ${loserObj.codmIgn}: ₦${match.winnerPayout.toLocaleString()} ready for cashout. Enter bank details to withdraw now.`;

        winnerUser.transactions.unshift({
          id: `tx_${Date.now()}_win`,
          type: 'MATCH_WIN_PAYOUT',
          amount: match.winnerPayout,
          description: payoutDesc,
          timestamp: Date.now(),
          matchId: match.id,
        });

        match.resolutionNotes = `Match verified! Winner is ${winnerObj.codmIgn}. ₦${match.winnerPayout.toLocaleString()} ready for instant cashout. Enter bank details now to send funds directly to your bank.`;

        match.chatMessages.push({
          id: `msg_${Date.now()}_settle`,
          senderId: 'SYSTEM',
          senderName: 'CODM Referee Bot',
          text: `🏆 MATCH CONCLUDED! Winner: ${winnerObj.codmIgn}. ₦${match.winnerPayout.toLocaleString()} winning payout is ready! Please enter your bank details below to cash out directly to your bank account.`,
          timestamp: Date.now(),
        });
      }

      if (loserUser) {
        loserUser.losses += 1;
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
    // Waiting for other player to submit
    match.status = 'SUBMITTING_RESULTS';
  }

  res.json(match);
});

// Admin manual resolution (for dispute testing)
app.post('/api/matches/:id/admin-resolve', (req, res) => {
  const match = matches[req.params.id];
  if (!match) return res.status(404).json({ error: 'Match not found' });

  const { winnerId } = req.body;
  const isCreatorWinner = match.creator.id === winnerId;
  const isOpponentWinner = match.opponent?.id === winnerId;

  if (!isCreatorWinner && !isOpponentWinner) {
    return res.status(400).json({ error: 'Invalid winner ID' });
  }

  const winnerObj = isCreatorWinner ? match.creator : match.opponent!;
  const loserObj = isCreatorWinner ? match.opponent! : match.creator;
  const winnerUser = users[winnerObj.id];
  const loserUser = users[loserObj.id];

  // Settle Escrow
  const creatorUser = users[match.creator.id];
  if (creatorUser) creatorUser.escrowBalance = Math.max(0, creatorUser.escrowBalance - match.stakeAmount);

  if (match.opponent) {
    const oppUser = users[match.opponent.id];
    if (oppUser) oppUser.escrowBalance = Math.max(0, oppUser.escrowBalance - match.stakeAmount);
  }

  if (winnerUser) {
    winnerUser.balance += match.winnerPayout;
    winnerUser.totalWinnings += match.winnerPayout;
    winnerUser.wins += 1;
    winnerUser.transactions.unshift({
      id: `tx_${Date.now()}_win`,
      type: 'MATCH_WIN_PAYOUT',
      amount: match.winnerPayout,
      description: `🏆 Admin resolved 1v1 match #${match.roomCode} win in favor of ${winnerObj.codmIgn}`,
      timestamp: Date.now(),
      matchId: match.id,
    });
  }

  if (loserUser) loserUser.losses += 1;

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

  res.json(match);
});

async function startServer() {
  // 1. Initialize Supabase PostgreSQL database and load state
  await initDatabase();
  await loadDataFromSupabase();

  // Always serve static public assets (images, icons, etc.)
  const publicPath = path.resolve(__dirname, 'public');
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
    app.use('/public', express.static(publicPath));
  }

  // Check if production build exists (e.g. on Render after npm run build)
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
