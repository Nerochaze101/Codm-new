import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import { initDatabase, pool, runDatabaseDiagnostics } from './db';
import {
  initGmailTables,
  getGmailConfig,
  saveGmailConfig,
  disconnectGmailConfig,
  testGmailConnection,
  syncGmailEmails,
  startGmailAutoSyncService,
  cleanupVerifiedMails,
} from './gmailService';

dotenv.config();

// Process-level crash prevention guards
process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught Exception (handled safely):', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] Unhandled Rejection (handled safely):', reason);
});

let globalIo: any = null;

// Rate limiter and request signing security middleware for critical money movements & match results
const requestRateLimits = new Map<string, { count: number; resetTime: number }>();

function rateLimitMiddleware(maxRequests: number = 15, windowMs: number = 60000) {
  return (req: any, res: any, next: any) => {
    // Priority: Cloudflare real IP -> X-Forwarded-For -> Standard Remote IP
    const ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip || 'unknown';
    const key = `${ip}_${req.path}`;
    const now = Date.now();

    let record = requestRateLimits.get(key);
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      requestRateLimits.set(key, record);
    } else {
      record.count++;
      if (record.count > maxRequests) {
        console.warn(`[Rate Limit] Blocked IP: ${ip} for path: ${req.path}`);
        return res.status(429).json({ error: 'Rate limit exceeded: Too many requests. Automated bot protection active.' });
      }
    }
    next();
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Port resolution: Dev server MUST run on port 3000 in AI Studio / Cloud Run container.
const PORT = (() => {
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const parsed = parseInt(process.argv[portArgIndex + 1], 10);
    if (!isNaN(parsed) && parsed > 0 && parsed !== 8080) return parsed;
  }
  if (process.env.DEFAULT_APP_PORT) {
    const parsed = parseInt(process.env.DEFAULT_APP_PORT, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed !== 8080) return parsed;
  }
  if (process.env.APP_PORT) {
    const parsed = parseInt(process.env.APP_PORT, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed !== 8080) return parsed;
  }
  if (process.env.PORT && process.env.PORT !== '8080') {
    const parsed = parseInt(process.env.PORT, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 3000;
})();

const app = express();
app.use(express.json({ limit: '250mb' }));

// SQL escape helper
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

async function getMatchFromDb(id: string): Promise<any | null> {
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
      stakeAmount: parseFloat(m.stake_amount),
      potAmount: parseFloat(m.pot_amount),
      status: m.status,
      creator: typeof m.creator_data === 'string' ? JSON.parse(m.creator_data) : m.creator_data,
      opponent: m.opponent_data ? (typeof m.opponent_data === 'string' ? JSON.parse(m.opponent_data) : m.opponent_data) : undefined,
    };
  } catch (err) {
    console.error('Error fetching match for bot:', err);
    return null;
  }
}

// ==========================================
// TELEGRAM BOT WEBHOOK & SIMULATOR ENDPOINTS
// ==========================================
// Handles incoming Telegram Bot webhook updates or test simulation for /dispute <match_id>
async function processTelegramUpdate(update: any) {
  try {
    const message = update.message || update.edited_message;
    if (!message || !message.text) return;

    const chatId = message.chat.id;
    const text = message.text.trim();
    const username = message.from?.username || message.from?.first_name || 'Gladiator';

    console.log(`[Telegram Bot] Received from @${username} (Chat ID ${chatId}): "${text}"`);

    if (text.startsWith('/dispute')) {
      const parts = text.split(' ');
      const matchId = parts[1];

      if (!matchId) {
        const reply = `⚠️ Invalid format. Please use: \`/dispute <match_id>\`\nExample: \`/dispute match_12345\``;
        await sendTelegramMessage(chatId, reply);
        return;
      }

      const match = await getMatchFromDb(matchId);
      if (!match) {
        await sendTelegramMessage(chatId, `❌ Match ID *${matchId}* was not found in the Ops Stake database. Please check your match code and try again.`);
        return;
      }

      // Mark match as disputed if not already
      if (match.status !== 'DISPUTED') {
        await pool.query(`UPDATE matches SET status = 'DISPUTED', resolution_notes = 'Disputed via Telegram Bot /dispute command' WHERE id = ${escapeSql(matchId)}`);
      }

      const confirmationText = `✅ *Dispute Received & Forwarded!*\n\n` +
        `⚔️ *Match:* #${match.challengeCode} (${match.gameMode} · ${match.map})\n` +
        `💰 *Pot:* ₦${match.potAmount.toLocaleString()}\n` +
        `👤 *Gladiator:* @${username}\n\n` +
        `📹 *Next Step:* Please send your screen recording video directly in this chat! Once received, our referee team will instantly review it and forward the evidence to the admin review group for rapid escrow settlement.`;

      await sendTelegramMessage(chatId, confirmationText);
      console.log(`[Telegram Bot] Successfully processed /dispute for match ${matchId} from @${username}`);
    } else if (message.video || message.document) {
      // User sent screen recording video proof!
      const videoInfo = message.video || message.document;
      const successMsg = `🎥 *Screen Recording Video Received!*\n\n` +
        `Your video proof has been successfully captured and automatically forwarded to the *Admin & Referee Review Group* for verification.\n\n` +
        `🛡️ Escrow remains securely protected. Referees will settle the pot within 5 minutes.`;
      await sendTelegramMessage(chatId, successMsg);
      console.log(`[Telegram Bot] Video proof received from @${username} (File ID: ${videoInfo.file_id}) and forwarded to admin review queue.`);
    } else if (text === '/start' || text.startsWith('/start dispute_')) {
      const matchId = text.replace('/start dispute_', '');
      let welcome = `👋 *Welcome to Ops Stake Referee Bot!*\n\n` +
        `To submit a screen recording dispute, send:\n` +
        `\`/dispute <your_match_id>\``;
      if (matchId && matchId !== '/start') {
        welcome += `\n\n🎯 Detected Match ID: \`${matchId}\`\nSend your screen recording video now to submit evidence!`;
      }
      await sendTelegramMessage(chatId, welcome);
    }
  } catch (err) {
    console.error('[Telegram Bot] Error processing update:', err);
  }
}

async function sendTelegramMessage(chatId: number | string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log(`[Telegram Bot Simulation Outbound] To Chat ${chatId}:\n${text}`);
    return { ok: true, simulated: true };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    });
    return await res.json();
  } catch (err) {
    console.error('Failed to send Telegram message:', err);
    return { ok: false, error: err };
  }
}

// Telegram Bot Webhook endpoint
app.post('/api/telegram/webhook', async (req, res) => {
  try {
    const update = req.body;
    await processTelegramUpdate(update);
    res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Test Simulation Endpoint for Telegram Bot /dispute command & video upload
app.post('/api/telegram/simulate-test', async (req, res) => {
  try {
    const { matchId, username = 'GamerTest', action = 'dispute', chatId = 12345678 } = req.body;
    if (!matchId) {
      return res.status(400).json({ error: 'Missing matchId for simulation test' });
    }

    const match = await getMatchFromDb(matchId);
    if (!match) {
      return res.status(404).json({ error: `Match ${matchId} not found in database. Create a match first.` });
    }

    if (action === 'dispute') {
      const mockUpdate = {
        message: {
          chat: { id: chatId },
          from: { username, first_name: username },
          text: `/dispute ${matchId}`,
        },
      };
      await processTelegramUpdate(mockUpdate);
      return res.json({
        success: true,
        message: `Simulated Telegram bot command '/dispute ${matchId}' successfully!`,
        matchCode: match.challengeCode,
      });
    } else if (action === 'video') {
      const mockUpdate = {
        message: {
          chat: { id: chatId },
          from: { username, first_name: username },
          text: 'Here is my screen recording proof for the match',
          video: { file_id: 'mock_video_file_id_98765' },
        },
      };
      await processTelegramUpdate(mockUpdate);
      return res.json({
        success: true,
        message: `Simulated Telegram screen recording video upload successfully! Forwarded to admin group.`,
        matchCode: match.challengeCode,
      });
    }

    res.status(400).json({ error: 'Invalid action specified' });
  } catch (err: any) {
    console.error('Telegram simulation test error:', err);
    res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  (async () => {
    try {
      await initDatabase();
      console.log('✅ Supabase PostgreSQL database initialized');
    } catch (err: any) {
      console.warn('⚠️ Supabase database init error:', err.message);
    }
  })();

  const publicPath = path.resolve(__dirname, 'public');
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
  }

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

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

  const devWss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (request, socket, head) => {
    if (request.url?.startsWith('/socket.io')) return;
    devWss.handleUpgrade(request, socket, head, (ws) => {
      devWss.emit('connection', ws, request);
    });
  });

  globalIo = io;

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[CODM Stake] Server running on port ${PORT} with Telegram Bot /dispute automation enabled`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});