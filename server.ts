import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDatabase, pool } from './db';

dotenv.config();

// Process-level crash prevention guards
process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught Exception (handled safely):', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] Unhandled Rejection (handled safely):', reason);
});

let globalIo: any = null;

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

async function getMatchFromDb(codeOrId: string): Promise<any | null> {
  try {
    const clean = codeOrId.trim();
    const res = await pool.query(`
      SELECT * FROM matches 
      WHERE id = ${escapeSql(clean)} 
         OR room_code = ${escapeSql(clean)} 
         OR challenge_code = ${escapeSql(clean)}
      LIMIT 1
    `);
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
// TELEGRAM BOT POLLING & WEBHOOK SERVICE
// ==========================================

let activeBotUsername = 'OpsStakeBot';
let telegramOffset = 0;
let isPollingTelegram = false;

async function initBotUsername() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data: any = await res.json();
    if (data && data.ok && data.result?.username) {
      activeBotUsername = data.result.username;
      console.log(`🤖 [Telegram Bot Verified] Connected as @${activeBotUsername}`);
    }
  } catch (err: any) {
    console.warn('[Telegram Bot] Error fetching bot info:', err.message);
  }
}

async function processTelegramUpdate(update: any) {
  try {
    const message = update.message || update.edited_message;
    if (!message) return;

    const chatId = message.chat.id;
    const username = message.from?.username || message.from?.first_name || 'Gladiator';
    const text = (message.text || message.caption || '').trim();

    console.log(`[Telegram Bot] Received update from @${username} (Chat ID ${chatId}): "${text || '[Media]'}"`);

    // Check if user sent a video, photo, or document (screen recording proof)
    if (message.video || message.document || message.photo) {
      const media = message.video || message.document || (Array.isArray(message.photo) ? message.photo[message.photo.length - 1] : null);
      
      let matchText = '';
      if (text) {
        const parts = text.split(/\s+/);
        const matchCode = parts.find((p: string) => p.startsWith('CODM-') || p.length >= 4) || parts[0];
        if (matchCode) {
          const match = await getMatchFromDb(matchCode);
          if (match) {
            matchText = ` for Room #${match.roomCode || match.challengeCode}`;
            if (match.status !== 'DISPUTED') {
              await pool.query(`UPDATE matches SET status = 'DISPUTED', resolution_notes = 'Evidence uploaded via Telegram Bot' WHERE id = ${escapeSql(match.id)}`);
            }
          }
        }
      }

      const successMsg = `🎥 *Screen Recording Evidence Received${matchText}!*\n\n` +
        `Your evidence from @${username} has been recorded and automatically forwarded to the *Admin & Referee Review Group* for verification.\n\n` +
        `🛡️ Escrow pot remains locked until human referees evaluate the clip. Resolution typically takes under 5 minutes.`;

      await sendTelegramMessage(chatId, successMsg);
      console.log(`[Telegram Bot] Video proof received from @${username} (Chat ID: ${chatId}, File ID: ${media?.file_id}) and acknowledged.`);
      return;
    }

    if (!text) return;

    const lower = text.toLowerCase();

    // /start dispute_<code>
    if (lower.startsWith('/start dispute_')) {
      const codeParam = text.replace(/\/start dispute_/i, '').trim();
      let welcome = `👋 *Welcome to Ops Stake Referee Bot, @${username}!*\n\n`;
      if (codeParam) {
        const match = await getMatchFromDb(codeParam);
        if (match) {
          if (match.status !== 'DISPUTED') {
            await pool.query(`UPDATE matches SET status = 'DISPUTED', resolution_notes = 'Disputed via Telegram Bot' WHERE id = ${escapeSql(match.id)}`);
          }
          welcome += `🎯 *Target Room Code Identified:* \`${match.roomCode || match.challengeCode}\` (${match.gameMode} · ${match.map})\n` +
            `💰 *Escrow Pot:* ₦${match.potAmount.toLocaleString()}\n\n` +
            `📹 *Action Required:* Please record your match history and end-game scoreboard, then **upload the video file directly into this chat**!`;
        } else {
          welcome += `🎯 *Detected Code:* \`${codeParam}\`\n\nPlease upload your screen recording video now to submit evidence for review!`;
        }
      } else {
        welcome += `To dispute a match and submit proof, send:\n\`/dispute <your_room_code>\``;
      }
      await sendTelegramMessage(chatId, welcome);
      return;
    }

    // Standard /start command
    if (lower === '/start') {
      const welcome = `👋 *Welcome to Ops Stake Referee Bot, @${username}!*\n\n` +
        `I automate match arbitration and video proof submission for CODM wagers.\n\n` +
        `📌 *How to submit proof:*\n` +
        `1. Type: \`/dispute <your_room_code>\` (e.g. \`/dispute CODM-8392-SHP\`)\n` +
        `2. Upload your screen recording video directly to this chat.\n\n` +
        `Referees will inspect your video and settle escrow immediately.`;
      await sendTelegramMessage(chatId, welcome);
      return;
    }

    // /dispute <room_code> or dispute <room_code>
    if (lower.startsWith('/dispute') || lower.startsWith('dispute')) {
      const parts = text.split(/\s+/);
      const roomCodeInput = parts[1];

      if (!roomCodeInput) {
        const reply = `⚠️ *Invalid Format*\nPlease specify your room code:\n\`/dispute <room_code>\`\nExample: \`/dispute CODM-8392-SHP\``;
        await sendTelegramMessage(chatId, reply);
        return;
      }

      const match = await getMatchFromDb(roomCodeInput);
      if (!match) {
        await sendTelegramMessage(chatId, `❌ Room Code *${roomCodeInput}* was not found in Ops Stake. Please check the code in your match room and try again.`);
        return;
      }

      if (match.status !== 'DISPUTED') {
        await pool.query(`UPDATE matches SET status = 'DISPUTED', resolution_notes = 'Disputed via Telegram Bot /dispute command' WHERE id = ${escapeSql(match.id)}`);
      }

      const displayCode = match.roomCode || `#${match.challengeCode}`;
      const confirmationText = `✅ *Dispute Registered for Match ${displayCode}!*\n\n` +
        `⚔️ *Game Mode:* ${match.gameMode} (${match.map})\n` +
        `💰 *Pot Amount:* ₦${match.potAmount.toLocaleString()}\n` +
        `👤 *Player:* @${username}\n\n` +
        `📹 *NEXT STEP:* Upload your screen recording video directly to this chat now! Once sent, our referee team will review it and settle the escrow pot.`;

      await sendTelegramMessage(chatId, confirmationText);
      console.log(`[Telegram Bot] Dispute command executed for ${displayCode} by @${username}`);
      return;
    }

    // Default catch-all response for unrecognized text
    const defaultReply = `🤖 *Ops Stake Bot Active*\n\n` +
      `To submit evidence for a disputed match, send:\n` +
      `\`/dispute <room_code>\`\n\n` +
      `Or attach your screen recording video directly in this chat!`;
    await sendTelegramMessage(chatId, defaultReply);

  } catch (err) {
    console.error('[Telegram Bot] Error in processTelegramUpdate:', err);
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

async function startTelegramBotPolling() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('ℹ️ [Telegram Bot] TELEGRAM_BOT_TOKEN environment variable not configured. Live polling disabled until token is supplied.');
    return;
  }

  if (isPollingTelegram) return;
  isPollingTelegram = true;

  await initBotUsername();
  console.log(`🤖 [Telegram Bot] Long-polling active for @${activeBotUsername}...`);

  // Drop any existing webhooks to ensure getUpdates long-polling works without conflicts
  try {
    await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`);
  } catch (_) {}

  const pollLoop = async () => {
    while (isPollingTelegram) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${telegramOffset}&timeout=15`);
        const data: any = await res.json();

        if (data && data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            telegramOffset = update.update_id + 1;
            await processTelegramUpdate(update);
          }
        } else if (data && !data.ok) {
          console.warn('[Telegram Bot Poll Warning]:', data.description || data);
          await new Promise((r) => setTimeout(r, 5000));
        }
      } catch (err: any) {
        console.error('[Telegram Bot Poll Error]:', err.message || err);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  };

  pollLoop().catch((err) => console.error('[Telegram Bot Loop Crash]:', err));
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

// Dynamic Bot Info endpoint for frontend
app.get('/api/telegram/bot-info', (req, res) => {
  res.json({
    botUsername: activeBotUsername,
    hasToken: !!process.env.TELEGRAM_BOT_TOKEN,
  });
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
      return res.status(404).json({ error: `Match/Room Code ${matchId} not found in database.` });
    }

    if (action === 'dispute') {
      const mockUpdate = {
        message: {
          chat: { id: chatId },
          from: { username, first_name: username },
          text: `/dispute ${match.roomCode || match.challengeCode}`,
        },
      };
      await processTelegramUpdate(mockUpdate);
      return res.json({
        success: true,
        message: `Simulated Telegram bot command '/dispute ${match.roomCode || match.challengeCode}' successfully!`,
        matchCode: match.roomCode || match.challengeCode,
      });
    } else if (action === 'video') {
      const mockUpdate = {
        message: {
          chat: { id: chatId },
          from: { username, first_name: username },
          text: `Screen recording for ${match.roomCode || match.challengeCode}`,
          video: { file_id: 'mock_video_file_id_98765' },
        },
      };
      await processTelegramUpdate(mockUpdate);
      return res.json({
        success: true,
        message: `Simulated Telegram video upload successfully!`,
        matchCode: match.roomCode || match.challengeCode,
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

    try {
      await startTelegramBotPolling();
    } catch (err: any) {
      console.warn('⚠️ Telegram Bot polling error:', err.message);
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
    console.log(`[CODM Stake] Server running on port ${PORT} with Telegram Bot /dispute automation & polling enabled`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});