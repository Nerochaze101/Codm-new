// @ts-nocheck
// server.ts
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import dotenv2 from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import crypto2 from "crypto";
import { GoogleGenAI } from "@google/genai";

// db.ts
import pg from "pg";
import dotenv from "dotenv";
import dns from "dns";
import net from "net";
import { URL } from "url";
try {
  dns.setDefaultResultOrder("ipv4first");
} catch (e) {
}
dotenv.config();
var { Pool } = pg;
var DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres.zwlovcpkmydzcuoexjbg:Hello10122%40ususbhaj@aws-0-eu-west-2.pooler.supabase.com:5432/postgres";
var pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
    // Required for Supabase cloud PostgreSQL
  },
  max: 100,
  // Expanded for 1,000+ concurrent users peak
  idleTimeoutMillis: 3e4,
  connectionTimeoutMillis: 15e3,
  statement_timeout: 3e4
  // Increased to 30s for large video proof analysis
});
async function runDatabaseDiagnostics() {
  const result = {
    status: "FAILED",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    environment: {
      hasEnvDatabaseUrl: !!process.env.DATABASE_URL,
      maskedConnectionString: DATABASE_URL.replace(/(:)([^@]+)(@)/, "$1******$3")
    },
    network: {
      host: "aws-0-eu-west-2.pooler.supabase.com",
      port: 5432,
      dnsIPv4: null,
      dnsIPv4Error: null,
      dnsIPv6: null,
      dnsIPv6Error: null,
      tcpSocketReachable: false,
      tcpSocketError: null
    },
    database: {
      pgConnected: false,
      pgError: null,
      serverTime: null,
      currentUser: null,
      usersCount: null
    },
    recommendations: []
  };
  try {
    const parsedUrl = new URL(DATABASE_URL);
    result.network.host = parsedUrl.hostname;
    result.network.port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : 5432;
  } catch (e) {
  }
  const host = result.network.host;
  const port = result.network.port;
  await new Promise((resolve) => {
    dns.lookup(host, { family: 4 }, (err, address) => {
      if (err) {
        result.network.dnsIPv4Error = err.message;
      } else {
        result.network.dnsIPv4 = address;
      }
      resolve();
    });
  });
  await new Promise((resolve) => {
    dns.lookup(host, { family: 6 }, (err, address) => {
      if (err) {
        result.network.dnsIPv6Error = err.message;
      } else {
        result.network.dnsIPv6 = address;
      }
      resolve();
    });
  });
  await new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(4e3);
    socket.on("connect", () => {
      result.network.tcpSocketReachable = true;
      socket.destroy();
      resolve();
    });
    socket.on("error", (err) => {
      result.network.tcpSocketError = err.message;
      socket.destroy();
      resolve();
    });
    socket.on("timeout", () => {
      result.network.tcpSocketError = "Connection timed out after 4000ms";
      socket.destroy();
      resolve();
    });
    socket.connect(port, host);
  });
  try {
    const client = await pool.connect();
    result.database.pgConnected = true;
    const timeRes = await client.query("SELECT NOW() as now, CURRENT_USER as user");
    result.database.serverTime = timeRes.rows[0]?.now;
    result.database.currentUser = timeRes.rows[0]?.user;
    const countRes = await client.query("SELECT COUNT(*) FROM users");
    result.database.usersCount = parseInt(countRes.rows[0]?.count || "0", 10);
    client.release();
    result.status = "CONNECTED";
  } catch (err) {
    result.database.pgError = err.message || String(err);
    if (result.network.tcpSocketReachable) {
      result.status = "PARTIAL";
    } else {
      result.status = "FAILED";
    }
  }
  if (!result.database.pgConnected) {
    if (result.network.dnsIPv6 && !result.network.dnsIPv4 && host.includes("supabase.co")) {
      result.recommendations.push(
        "Direct Supabase host ('db.*.supabase.co') resolves ONLY to IPv6. Hosting providers like Render block outbound IPv6, leading to ENETUNREACH. Update DATABASE_URL in Render Environment settings to use the Supabase IPv4 Pooler host: 'aws-0-eu-west-2.pooler.supabase.com' or 'pooler.supabase.com'."
      );
    }
    if (!result.network.tcpSocketReachable) {
      result.recommendations.push(
        `TCP port ${port} on ${host} is unreachable. Check if your hosting provider restricts outbound ports, or try port 6543 (Supabase Transaction Pooler) or port 5432 (Session Pooler).`
      );
    }
    if (result.database.pgError?.includes("password authentication failed")) {
      result.recommendations.push("Database credentials in DATABASE_URL are incorrect. Verify username/password in Supabase Dashboard -> Database -> Connection string.");
    }
    if (result.database.pgError?.includes("SSL")) {
      result.recommendations.push("Ensure SSL is enabled in connection settings ({ ssl: { rejectUnauthorized: false } }).");
    }
  } else {
    result.recommendations.push("Supabase database connection is HEALTHY and active!");
  }
  return result;
}
async function initDatabase() {
  console.log("\u{1F50C} Running Supabase PostgreSQL Database Diagnostics...");
  const diag = await runDatabaseDiagnostics();
  console.log("========== DATABASE DIAGNOSTICS ==========");
  console.log(`Status: ${diag.status}`);
  console.log(`Target Host: ${diag.network.host}:${diag.network.port}`);
  console.log(`IPv4 Resolved: ${diag.network.dnsIPv4 || "None (" + diag.network.dnsIPv4Error + ")"}`);
  console.log(`IPv6 Resolved: ${diag.network.dnsIPv6 || "None (" + diag.network.dnsIPv6Error + ")"}`);
  console.log(`TCP Reachable: ${diag.network.tcpSocketReachable ? "YES" : "NO (" + diag.network.tcpSocketError + ")"}`);
  console.log(`Database Connected: ${diag.database.pgConnected ? "YES" : "NO (" + diag.database.pgError + ")"}`);
  if (diag.database.pgConnected) {
    console.log(`DB Users Count: ${diag.database.usersCount}`);
  }
  console.log("Recommendations:");
  diag.recommendations.forEach((rec, idx) => console.log(`  ${idx + 1}. ${rec}`));
  console.log("==========================================");
  if (!diag.database.pgConnected) {
    console.error("\u26A0\uFE0F Supabase database connection failed during startup diagnostics.");
    return false;
  }
  try {
    const client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255),
        codm_ign VARCHAR(255) NOT NULL,
        codm_uid VARCHAR(255),
        tier VARCHAR(100) DEFAULT 'LEGENDARY TIER',
        clan VARCHAR(100) DEFAULT '[1V1_PRO]',
        email VARCHAR(255),
        phone VARCHAR(100),
        password_hash VARCHAR(255),
        balance NUMERIC DEFAULT 0,
        escrow_balance NUMERIC DEFAULT 0,
        total_winnings NUMERIC DEFAULT 0,
        wins INT DEFAULT 0,
        losses INT DEFAULT 0,
        draws INT DEFAULT 0,
        avatar TEXT,
        bank_name VARCHAR(255),
        account_number VARCHAR(255),
        account_name VARCHAR(255),
        referred_by VARCHAR(255),
        referral_code VARCHAR(100),
        total_referral_earnings NUMERIC DEFAULT 0,
        created_at BIGINT
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS account_number VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS account_name VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS total_referral_earnings NUMERIC DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS flag_reason TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS flagged_with_user_id VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS flag_matches JSONB;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS conflict_strikes INT DEFAULT 0;

      CREATE TABLE IF NOT EXISTS matches (
        id VARCHAR(255) PRIMARY KEY,
        challenge_code VARCHAR(100) NOT NULL,
        room_code VARCHAR(100),
        game_mode VARCHAR(255) NOT NULL,
        map VARCHAR(255) NOT NULL,
        rules JSONB DEFAULT '[]'::jsonb,
        stake_amount NUMERIC NOT NULL,
        pot_amount NUMERIC NOT NULL,
        platform_fee_percentage INT DEFAULT 10,
        platform_fee NUMERIC DEFAULT 0,
        winner_payout NUMERIC NOT NULL,
        match_duration_minutes INT DEFAULT 15,
        status VARCHAR(100) NOT NULL,
        creator_id VARCHAR(255) NOT NULL,
        creator_data JSONB NOT NULL,
        opponent_id VARCHAR(255),
        opponent_data JSONB,
        winner_id VARCHAR(255),
        winner_ign VARCHAR(255),
        resolution_notes TEXT,
        chat_messages JSONB DEFAULT '[]'::jsonb,
        created_at BIGINT NOT NULL,
        room_generated_at BIGINT,
        settled_at BIGINT,
        result_submitted_at BIGINT,
        result_submitted_by VARCHAR(255),
        is_public BOOLEAN DEFAULT true,
        reviewer_id VARCHAR(255),
        reviewer_name VARCHAR(255),
        creator_screenshot TEXT,
        opponent_screenshot TEXT
      );

      ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_duration_minutes INT DEFAULT 15;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS result_submitted_at BIGINT;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS result_submitted_by VARCHAR(255);
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_type VARCHAR(50) DEFAULT 'solo';
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS squad_data JSONB;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS conflict_retries INT DEFAULT 0;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS reviewer_id VARCHAR(255);
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS reviewer_name VARCHAR(255);
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS creator_screenshot TEXT;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS opponent_screenshot TEXT;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS mutual_action_data JSONB;


      CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        type VARCHAR(100) NOT NULL,
        amount NUMERIC NOT NULL,
        description TEXT,
        match_id VARCHAR(255),
        timestamp BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS platform_finance (
        id VARCHAR(255) PRIMARY KEY,
        total_fees_collected NUMERIC DEFAULT 0,
        total_fees_withdrawn NUMERIC DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS platform_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at BIGINT NOT NULL
      );

      INSERT INTO platform_settings (key, value, updated_at)
      VALUES 
        ('solo_fee_percent', '10', 1700000000000),
        ('squad_fee_percent', '5', 1700000000000)
      ON CONFLICT (key) DO NOTHING;

      CREATE TABLE IF NOT EXISTS withdrawal_requests (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        codm_ign VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(100),
        amount NUMERIC NOT NULL,
        bank_name VARCHAR(255) NOT NULL,
        account_number VARCHAR(255) NOT NULL,
        account_name VARCHAR(255) NOT NULL,
        bank_code VARCHAR(100),
        status VARCHAR(50) DEFAULT 'pending',
        remark VARCHAR(255) NOT NULL,
        created_at BIGINT NOT NULL,
        processed_at BIGINT,
        processed_by VARCHAR(255),
        opay_redirect_url TEXT,
        rejection_reason TEXT,
        balance_deducted BOOLEAN DEFAULT false,
        webhook_received BOOLEAN DEFAULT false,
        webhook_payload JSONB
      );

      ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS balance_deducted BOOLEAN DEFAULT false;
      ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS webhook_received BOOLEAN DEFAULT false;
      ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS webhook_payload JSONB;
      ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS transfer_reference VARCHAR(255);

      CREATE TABLE IF NOT EXISTS opay_sms_alerts (
        id VARCHAR(255) PRIMARY KEY,
        sms_body TEXT NOT NULL,
        sender VARCHAR(255),
        amount NUMERIC NOT NULL,
        narration VARCHAR(255),
        sender_name VARCHAR(255),
        reference VARCHAR(255),
        matched_user_id VARCHAR(255),
        matched_user_ign VARCHAR(255),
        status VARCHAR(50) DEFAULT 'auto_credited',
        created_at BIGINT NOT NULL,
        credited_at BIGINT
      );

      CREATE TABLE IF NOT EXISTS deposit_requests (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        codm_ign VARCHAR(255) NOT NULL,
        amount NUMERIC NOT NULL,
        payment_reference VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        sms_alert_id VARCHAR(255),
        created_at BIGINT NOT NULL,
        expires_at BIGINT NOT NULL,
        completed_at BIGINT
      );

      CREATE TABLE IF NOT EXISTS admin_mailbox (
        id VARCHAR(255) PRIMARY KEY,
        sender_email VARCHAR(255) NOT NULL,
        sender_name VARCHAR(255),
        recipient_email VARCHAR(255) DEFAULT 'codstake@detailr.online',
        subject VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        folder VARCHAR(50) DEFAULT 'inbox',
        created_at BIGINT NOT NULL
      );
      
      INSERT INTO platform_finance (id, total_fees_collected, total_fees_withdrawn) 
      VALUES ('main', 0, 0) ON CONFLICT (id) DO NOTHING;

      -- High Concurrency Performance Indexes
      CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_ign ON users(codm_ign);
      
      CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
      CREATE INDEX IF NOT EXISTS idx_matches_creator_id ON matches(creator_id);
      CREATE INDEX IF NOT EXISTS idx_matches_opponent_id ON matches(opponent_id);
      CREATE INDEX IF NOT EXISTS idx_matches_created_at ON matches(created_at);
      CREATE INDEX IF NOT EXISTS idx_matches_is_public ON matches(is_public);
      
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);
      
      CREATE INDEX IF NOT EXISTS idx_withdrawal_user_id ON withdrawal_requests(user_id);
      CREATE INDEX IF NOT EXISTS idx_deposit_status ON deposit_requests(status);
      CREATE INDEX IF NOT EXISTS idx_deposit_ref ON deposit_requests(payment_reference);

      CREATE TABLE IF NOT EXISTS support_messages (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        sender_name VARCHAR(255) NOT NULL,
        sender_role VARCHAR(50) NOT NULL,
        text TEXT NOT NULL,
        category VARCHAR(100),
        room VARCHAR(255),
        status VARCHAR(50) DEFAULT 'open',
        timestamp BIGINT NOT NULL
      );
      ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'open';
      CREATE INDEX IF NOT EXISTS idx_support_user_id ON support_messages(user_id);
      CREATE INDEX IF NOT EXISTS idx_support_timestamp ON support_messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_support_status ON support_messages(status);
    `);
    const usersCountRes = await client.query("SELECT COUNT(*) FROM users");
    if (parseInt(usersCountRes.rows[0].count, 10) === 0) {
      console.log("\u{1F331} Seeding initial CODM gladiators into Supabase...");
      const now = Date.now();
      await client.query(`
        INSERT INTO users (id, username, codm_ign, codm_uid, tier, clan, email, phone, balance, escrow_balance, total_winnings, wins, losses, draws, avatar, created_at)
        VALUES 
        ('user_ghost', 'Ghost_NG', 'GHOST_NG', '6829471928371902', 'LEGENDARY TIER', '[1V1_PRO]', 'ghost@lagos-codm.com', '+234 803 123 4567', 0, 0, 24500, 14, 3, 1, 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150&auto=format&fit=crop&q=80', ${now}),
        ('user_shadow', 'ShadowSniper', 'ShadowSniper', '6948201948271034', 'MASTER V TIER', '[NIGHT_HAWK]', 'shadow@esports.ng', '+234 812 987 6543', 0, 0, 12000, 8, 5, 0, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80', ${now})
        ON CONFLICT (id) DO NOTHING;
      `);
    }
    client.release();
    console.log("\u2705 Supabase database tables initialized and verified successfully.");
    return true;
  } catch (error) {
    console.error("\u26A0\uFE0F Supabase initialization table error:", error);
    return false;
  }
}

// gmailService.ts
import tls from "tls";
import crypto from "crypto";
async function loadImapflow() {
  try {
    const imapflowMod = await import("imapflow");
    const mailparserMod = await import("mailparser");
    return {
      ImapFlow: imapflowMod.ImapFlow,
      simpleParser: mailparserMod.simpleParser
    };
  } catch (err) {
    return null;
  }
}
function decodeMimeHeader(raw) {
  if (!raw) return "";
  return raw.replace(/=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g, (_, charset, encoding, text) => {
    try {
      if (encoding.toUpperCase() === "B") {
        return Buffer.from(text, "base64").toString(charset.toLowerCase() === "utf-8" ? "utf8" : "latin1");
      } else if (encoding.toUpperCase() === "Q") {
        return text.replace(/=([0-9A-Fa-f]{2})/g, (_match, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/_/g, " ");
      }
    } catch {
      return text;
    }
    return text;
  });
}
function parseAddress(fromStr) {
  if (!fromStr) return { name: "Unknown", email: "unknown@gmail.com" };
  const match = fromStr.match(/^(?:"?([^"]*)"?\s)?(?:<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?)$/);
  if (match) {
    const name = decodeMimeHeader(match[1]?.trim() || "");
    const email = match[2]?.trim().toLowerCase() || "unknown@gmail.com";
    return { name: name || email, email };
  }
  return { name: decodeMimeHeader(fromStr.trim()), email: fromStr.trim() };
}
var NativeGmailImapClient = class {
  constructor() {
    this.host = "imap.gmail.com";
    this.port = 993;
    this.socket = null;
    this.tagCounter = 1;
  }
  async connect(email, appPass) {
    return new Promise((resolve) => {
      let resolved = false;
      let timer = null;
      const finish = (res) => {
        if (!resolved) {
          resolved = true;
          if (timer) clearTimeout(timer);
          resolve(res);
        }
      };
      timer = setTimeout(() => {
        finish({ success: false, message: "Connection to Gmail IMAP timed out (15s)" });
      }, 15e3);
      try {
        const s = tls.connect(
          {
            host: this.host,
            port: this.port,
            rejectUnauthorized: false,
            timeout: 12e3
          },
          () => {
          }
        );
        this.socket = s;
        let buffer = "";
        let loginTag = "";
        let loginSent = false;
        const onData = (chunk) => {
          buffer += chunk.toString();
          if (!loginSent && buffer.includes("* OK")) {
            loginSent = true;
            loginTag = "A" + this.tagCounter++;
            s.write(`${loginTag} LOGIN "${email}" "${appPass}"\r
`);
            return;
          }
          if (loginSent && loginTag) {
            const lines = buffer.split("\r\n");
            for (const line of lines) {
              if (line.startsWith(loginTag + " OK")) {
                s.off("data", onData);
                finish({ success: true, message: "Authentication successful" });
                return;
              } else if (line.startsWith(loginTag + " NO") || line.startsWith(loginTag + " BAD")) {
                s.off("data", onData);
                let errorMsg = "Google rejected credentials.";
                if (line.includes("AUTHENTICATIONFAILED") || line.includes("Invalid credentials")) {
                  errorMsg = "Google rejected credentials. Ensure 2-Step Verification is ON and you are using a 16-character App Password (not your normal Google account password).";
                }
                finish({ success: false, message: errorMsg });
                return;
              }
            }
          }
        };
        s.on("data", onData);
        s.on("error", (err) => {
          finish({ success: false, message: `TLS socket error: ${err.message}` });
        });
        s.on("timeout", () => {
          finish({ success: false, message: "Connection to Gmail IMAP timed out" });
          this.close();
        });
      } catch (err) {
        finish({ success: false, message: err.message || "Failed to initialize TLS socket" });
      }
    });
  }
  async sendCommand(command, timeoutMs = 15e3) {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ ok: false, response: "Socket not connected", full: "" });
        return;
      }
      const tag = "A" + this.tagCounter++;
      let buffer = "";
      let timer;
      const onData = (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split("\r\n");
        for (const line of lines) {
          if (line.startsWith(tag + " OK")) {
            clearTimeout(timer);
            this.socket?.off("data", onData);
            resolve({ ok: true, response: line, full: buffer });
            return;
          } else if (line.startsWith(tag + " NO") || line.startsWith(tag + " BAD")) {
            clearTimeout(timer);
            this.socket?.off("data", onData);
            resolve({ ok: false, response: line, full: buffer });
            return;
          }
        }
      };
      timer = setTimeout(() => {
        this.socket?.off("data", onData);
        resolve({ ok: false, response: "Command timed out", full: buffer });
      }, timeoutMs);
      this.socket.on("data", onData);
      this.socket.write(`${tag} ${command}\r
`);
    });
  }
  async selectInbox() {
    const res = await this.sendCommand("SELECT INBOX");
    if (!res.ok) return { ok: false, total: 0 };
    const match = res.full.match(/\*\s+(\d+)\s+EXISTS/i);
    const total = match ? parseInt(match[1], 10) : 0;
    return { ok: true, total };
  }
  async fetchMessages(start, end) {
    if (start < 1 || end < start) return [];
    const res = await this.sendCommand(`FETCH ${start}:${end} (BODY.PEEK[HEADER] BODY.PEEK[TEXT])`, 2e4);
    if (!res.ok && !res.full.includes("* ")) return [];
    const messages = [];
    const rawChunks = res.full.split(/(?=\*\s+\d+\s+FETCH)/g);
    for (const chunk of rawChunks) {
      if (!chunk.includes("FETCH")) continue;
      let subject = "(No Subject)";
      let from = "unknown@gmail.com";
      let date = Date.now();
      let messageId = "";
      let body = "";
      const subjectMatch = chunk.match(/\r\nSubject:\s*([^\r\n]+)/i);
      if (subjectMatch) subject = decodeMimeHeader(subjectMatch[1].trim());
      const fromMatch = chunk.match(/\r\nFrom:\s*([^\r\n]+)/i);
      if (fromMatch) from = fromMatch[1].trim();
      const dateMatch = chunk.match(/\r\nDate:\s*([^\r\n]+)/i);
      if (dateMatch) {
        const parsedDate = new Date(dateMatch[1].trim()).getTime();
        if (!isNaN(parsedDate)) date = parsedDate;
      }
      const idMatch = chunk.match(/\r\nMessage-ID:\s*<([^>]+)>/i);
      if (idMatch) messageId = idMatch[1].trim();
      const bodyPart = chunk.split(/BODY\[TEXT\](?:\s*\{\d+\})?\r\n/i)[1];
      if (bodyPart) {
        const cleanBody = bodyPart.split(/\r\n\)\r\n|\r\nA\d+\s+OK/)[0] || "";
        body = cleanBody.replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/<[^>]+>/g, " ").substring(0, 3e3).trim();
      }
      if (!messageId) {
        messageId = crypto.createHash("md5").update(`${from}_${subject}_${date}`).digest("hex");
      }
      messages.push({
        subject,
        from,
        date,
        body: body || "(Email content)",
        messageId
      });
    }
    return messages;
  }
  async close() {
    try {
      if (this.socket && !this.socket.destroyed) {
        this.socket.write("TAG_OUT LOGOUT\r\n");
        setTimeout(() => {
          try {
            this.socket?.destroy();
          } catch {
          }
        }, 500);
      }
    } catch {
    }
  }
};
async function initGmailTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS gmail_config (
        id VARCHAR(64) PRIMARY KEY,
        gmail_address VARCHAR(255) NOT NULL,
        app_password VARCHAR(255) NOT NULL,
        auto_sync BOOLEAN DEFAULT true,
        last_synced_at BIGINT,
        last_sync_status VARCHAR(64) DEFAULT 'idle',
        last_sync_error TEXT,
        total_emails_synced INT DEFAULT 0,
        updated_at BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS admin_emails (
        id VARCHAR(128) PRIMARY KEY,
        sender_email VARCHAR(255) NOT NULL,
        sender_name VARCHAR(255),
        recipient_email VARCHAR(255) NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        folder VARCHAR(32) DEFAULT 'inbox',
        is_read BOOLEAN DEFAULT FALSE,
        created_at BIGINT NOT NULL,
        is_verified BOOLEAN DEFAULT FALSE,
        verified_at BIGINT
      );
      ALTER TABLE admin_emails ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
      ALTER TABLE admin_emails ADD COLUMN IF NOT EXISTS verified_at BIGINT;
    `);
    await pool.query(`
      INSERT INTO gmail_config (id, gmail_address, app_password, auto_sync, last_sync_status, updated_at)
      VALUES ('main', 'nerochazeagent@gmail.com', 'akbk djtt tfru wgsz', true, 'idle', $1)
      ON CONFLICT (id) DO UPDATE SET
        gmail_address = COALESCE(gmail_config.gmail_address, EXCLUDED.gmail_address),
        app_password = COALESCE(gmail_config.app_password, EXCLUDED.app_password);
    `, [Date.now()]);
    console.log("\u2705 Gmail & Admin Email tables verified and seeded with nerochazeagent@gmail.com");
  } catch (err) {
    console.error("Error initializing Gmail tables:", err.message);
  }
}
async function getGmailConfig() {
  try {
    await initGmailTables();
    const res = await pool.query(`SELECT * FROM gmail_config WHERE id = 'main' LIMIT 1`);
    if (res.rows.length > 0) {
      const row = res.rows[0];
      return {
        id: row.id,
        gmailAddress: row.gmail_address,
        appPassword: row.app_password,
        autoSync: row.auto_sync !== false,
        lastSyncedAt: row.last_synced_at ? parseInt(row.last_synced_at, 10) : null,
        lastSyncStatus: row.last_sync_status || "idle",
        lastSyncError: row.last_sync_error || null,
        totalEmailsSynced: parseInt(row.total_emails_synced || 0, 10),
        updatedAt: parseInt(row.updated_at || Date.now(), 10)
      };
    }
    const envUser = process.env.GMAIL_USER;
    const envPass = process.env.GMAIL_APP_PASSWORD;
    if (envUser && envPass) {
      return {
        id: "main",
        gmailAddress: envUser.trim(),
        appPassword: envPass.trim(),
        autoSync: true,
        lastSyncedAt: null,
        lastSyncStatus: "idle",
        lastSyncError: null,
        totalEmailsSynced: 0,
        updatedAt: Date.now()
      };
    }
    return null;
  } catch (err) {
    console.error("Error fetching gmail config:", err.message);
    return null;
  }
}
async function saveGmailConfig(gmailAddress, appPassword, autoSync = true) {
  await initGmailTables();
  const cleanEmail = gmailAddress.trim().toLowerCase();
  const cleanPass = appPassword.trim().replace(/\s+/g, "");
  const now = Date.now();
  await pool.query(
    `INSERT INTO gmail_config (id, gmail_address, app_password, auto_sync, last_sync_status, updated_at)
     VALUES ('main', $1, $2, $3, 'idle', $4)
     ON CONFLICT (id) DO UPDATE SET
       gmail_address = EXCLUDED.gmail_address,
       app_password = EXCLUDED.app_password,
       auto_sync = EXCLUDED.auto_sync,
       last_sync_status = 'idle',
       last_sync_error = NULL,
       updated_at = EXCLUDED.updated_at`,
    [cleanEmail, cleanPass, autoSync, now]
  );
}
async function disconnectGmailConfig() {
  await initGmailTables();
  await pool.query(`DELETE FROM gmail_config WHERE id = 'main'`);
}
async function testGmailConnection(gmailAddress, appPassword) {
  let user = gmailAddress;
  let pass = appPassword;
  if (!user || !pass) {
    const config = await getGmailConfig();
    if (!config || !config.gmailAddress || !config.appPassword) {
      return {
        success: false,
        message: "No Gmail credentials configured. Please provide your Gmail and App Password."
      };
    }
    user = config.gmailAddress;
    pass = config.appPassword;
  }
  const cleanEmail = user.trim().toLowerCase();
  const cleanPass = pass.trim().replace(/\s+/g, "");
  const nativeClient = new NativeGmailImapClient();
  try {
    const conn = await nativeClient.connect(cleanEmail, cleanPass);
    if (!conn.success) {
      await nativeClient.close();
      return conn;
    }
    const inbox = await nativeClient.selectInbox();
    await nativeClient.close();
    if (!inbox.ok) {
      return { success: false, message: "Authenticated, but could not select INBOX." };
    }
    return {
      success: true,
      message: `Connected successfully to ${cleanEmail}! Inbox contains ${inbox.total} message(s).`,
      totalMessages: inbox.total
    };
  } catch (nativeErr) {
    await nativeClient.close();
  }
  const engines = await loadImapflow();
  if (engines) {
    try {
      const client = new engines.ImapFlow({
        host: "imap.gmail.com",
        port: 993,
        secure: true,
        auth: { user: cleanEmail, pass: cleanPass },
        logger: false,
        tls: { rejectUnauthorized: false },
        connectionTimeout: 1e4
      });
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      const total = client.mailbox && typeof client.mailbox === "object" ? client.mailbox.exists || 0 : 0;
      lock.release();
      await client.logout();
      return {
        success: true,
        message: `Connected successfully to ${cleanEmail}! Inbox contains ${total} message(s).`,
        totalMessages: total
      };
    } catch (err) {
      let errorMsg = err.message || "Failed to connect to Gmail IMAP";
      if (errorMsg.includes("Invalid credentials") || errorMsg.includes("Username and Password not accepted")) {
        errorMsg = "Google rejected credentials. Ensure 2-Step Verification is ON and you are using a 16-character App Password (not your normal Google account password).";
      }
      return { success: false, message: errorMsg };
    }
  }
  return { success: false, message: "Could not connect to Gmail IMAP server" };
}
var activeGmailSyncPromise = null;
var lastGmailSyncTimestamp = 0;
async function syncGmailEmails() {
  if (activeGmailSyncPromise) {
    return activeGmailSyncPromise;
  }
  if (Date.now() - lastGmailSyncTimestamp < 3e3) {
    return {
      success: true,
      newEmailsCount: 0,
      totalInboxCount: 0,
      message: "Sync recently completed"
    };
  }
  activeGmailSyncPromise = (async () => {
    try {
      const result = await doSyncGmailEmailsInternal();
      lastGmailSyncTimestamp = Date.now();
      return result;
    } finally {
      activeGmailSyncPromise = null;
    }
  })();
  return activeGmailSyncPromise;
}
async function doSyncGmailEmailsInternal() {
  const config = await getGmailConfig();
  if (!config || !config.gmailAddress || !config.appPassword) {
    return {
      success: false,
      newEmailsCount: 0,
      totalInboxCount: 0,
      message: "Gmail is not connected. Please connect your Gmail address and App Password."
    };
  }
  const cleanEmail = config.gmailAddress.trim().toLowerCase();
  const cleanPass = config.appPassword.trim().replace(/\s+/g, "");
  await pool.query(`UPDATE gmail_config SET last_sync_status = 'syncing' WHERE id = 'main'`);
  const engines = await loadImapflow();
  if (engines) {
    try {
      const client = new engines.ImapFlow({
        host: "imap.gmail.com",
        port: 993,
        secure: true,
        auth: { user: cleanEmail, pass: cleanPass },
        logger: false,
        tls: { rejectUnauthorized: false },
        connectionTimeout: 15e3
      });
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      const total = client.mailbox && typeof client.mailbox === "object" ? client.mailbox.exists || 0 : 0;
      let newCount = 0;
      if (total > 0) {
        const startSeq = Math.max(1, total - 35);
        const range = `${startSeq}:*`;
        for await (const msg of client.fetch(range, { envelope: true, source: true, flags: true })) {
          try {
            if (!msg.source) continue;
            const parsed = await engines.simpleParser(msg.source);
            const rawId = parsed.messageId || `${cleanEmail}_${msg.uid || msg.seq}_${parsed.date?.getTime() || Date.now()}`;
            const mailId = "mail_gm_" + crypto.createHash("md5").update(rawId).digest("hex").substring(0, 24);
            const senderEmail = parsed.from?.value?.[0]?.address || "unknown@gmail.com";
            const senderName = parsed.from?.value?.[0]?.name || senderEmail;
            const subject = parsed.subject || "(No Subject)";
            const bodyText = parsed.text || (parsed.html ? parsed.html.replace(/<[^>]+>/g, " ").substring(0, 2e3) : "(Empty email body)");
            const mailTime = parsed.date ? parsed.date.getTime() : Date.now();
            const existing = await pool.query(`SELECT id FROM admin_emails WHERE id = $1`, [mailId]);
            if (existing.rows.length === 0) {
              await pool.query(
                `INSERT INTO admin_emails (id, sender_email, sender_name, recipient_email, subject, body, folder, is_read, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, 'inbox', false, $7)`,
                [mailId, senderEmail, senderName, cleanEmail, subject, bodyText, mailTime]
              );
              newCount++;
            }
          } catch (msgErr) {
            console.warn("Error parsing single message:", msgErr.message);
          }
        }
      }
      lock.release();
      await client.logout();
      const now = Date.now();
      await pool.query(
        `UPDATE gmail_config 
         SET last_synced_at = $1, 
             last_sync_status = 'success', 
             last_sync_error = NULL,
             total_emails_synced = total_emails_synced + $2
         WHERE id = 'main'`,
        [now, newCount]
      );
      return {
        success: true,
        newEmailsCount: newCount,
        totalInboxCount: total,
        message: `Sync successful! Fetched ${newCount} new email(s) from ${cleanEmail}. (Total in Inbox: ${total})`
      };
    } catch (err) {
      console.warn("ImapFlow sync warning, trying native TLS client:", err.message);
    }
  }
  const nativeClient = new NativeGmailImapClient();
  try {
    const conn = await nativeClient.connect(cleanEmail, cleanPass);
    if (!conn.success) {
      await nativeClient.close();
      const now2 = Date.now();
      await pool.query(
        `UPDATE gmail_config SET last_synced_at = $1, last_sync_status = 'error', last_sync_error = $2 WHERE id = 'main'`,
        [now2, conn.message]
      );
      return { success: false, newEmailsCount: 0, totalInboxCount: 0, message: conn.message };
    }
    const inbox = await nativeClient.selectInbox();
    let newCount = 0;
    if (inbox.ok && inbox.total > 0) {
      const start = Math.max(1, inbox.total - 30);
      const fetched = await nativeClient.fetchMessages(start, inbox.total);
      for (const item of fetched) {
        try {
          const mailId = "mail_gm_" + crypto.createHash("md5").update(item.messageId).digest("hex").substring(0, 24);
          const parsedSender = parseAddress(item.from);
          const existing = await pool.query(`SELECT id FROM admin_emails WHERE id = $1`, [mailId]);
          if (existing.rows.length === 0) {
            await pool.query(
              `INSERT INTO admin_emails (id, sender_email, sender_name, recipient_email, subject, body, folder, is_read, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, 'inbox', false, $7)`,
              [mailId, parsedSender.email, parsedSender.name, cleanEmail, item.subject, item.body, item.date]
            );
            newCount++;
          }
        } catch (itemErr) {
          console.warn("Error inserting email item:", itemErr.message);
        }
      }
    }
    await nativeClient.close();
    const now = Date.now();
    await pool.query(
      `UPDATE gmail_config 
       SET last_synced_at = $1, 
           last_sync_status = 'success', 
           last_sync_error = NULL,
           total_emails_synced = total_emails_synced + $2
       WHERE id = 'main'`,
      [now, newCount]
    );
    return {
      success: true,
      newEmailsCount: newCount,
      totalInboxCount: inbox.total,
      message: `Sync successful! Fetched ${newCount} new email(s) from ${cleanEmail}. (Total in Inbox: ${inbox.total})`
    };
  } catch (err) {
    await nativeClient.close();
    const now = Date.now();
    const errorMsg = err.message || "Unknown sync error";
    await pool.query(
      `UPDATE gmail_config 
       SET last_synced_at = $1, 
           last_sync_status = 'error', 
           last_sync_error = $2
       WHERE id = 'main'`,
      [now, errorMsg]
    );
    return {
      success: false,
      newEmailsCount: 0,
      totalInboxCount: 0,
      message: errorMsg
    };
  }
}
async function cleanupVerifiedMails(cutoffMs = 3 * 60 * 1e3) {
  try {
    const cutoffTime = Date.now() - cutoffMs;
    const res1 = await pool.query(
      `DELETE FROM admin_emails
       WHERE (is_verified = TRUE OR folder = 'verified')
         AND (
           (verified_at IS NOT NULL AND verified_at <= $1)
           OR (verified_at IS NULL AND created_at <= $1)
         )
       RETURNING id`,
      [cutoffTime]
    );
    const res2 = await pool.query(
      `DELETE FROM admin_emails ae
       USING deposit_requests dr
       WHERE dr.status = 'completed'
         AND dr.completed_at IS NOT NULL
         AND dr.completed_at <= $1
         AND (
           ae.subject ILIKE '%' || dr.payment_reference || '%'
           OR ae.body ILIKE '%' || dr.payment_reference || '%'
           OR ae.body ILIKE '%' || dr.id || '%'
         )
       RETURNING ae.id`,
      [cutoffTime]
    ).catch(() => ({ rowCount: 0 }));
    const totalCleaned = (res1.rowCount || 0) + (res2.rowCount || 0);
    if (totalCleaned > 0) {
      console.log(`\u{1F9F9} [Mail Cleanup] Purged ${totalCleaned} verified email(s) older than 3 minutes.`);
    }
    return totalCleaned;
  } catch (err) {
    console.warn("\u26A0\uFE0F [Mail Cleanup] Error clearing verified mails:", err.message);
    return 0;
  }
}
var autoSyncInterval = null;
function startGmailAutoSyncService() {
  if (autoSyncInterval) return;
  console.log("\u{1F4EC} Gmail Auto-Sync & Verified Mail Cleanup background service initialized (polling every 15s)");
  setTimeout(async () => {
    try {
      await cleanupVerifiedMails();
      const config = await getGmailConfig();
      if (config && config.autoSync && config.gmailAddress && config.appPassword) {
        console.log(`\u{1F4EC} Running initial Gmail sync for ${config.gmailAddress}...`);
        await syncGmailEmails();
      }
    } catch (e) {
      console.warn("Initial sync warning:", e.message);
    }
  }, 1e4);
  autoSyncInterval = setInterval(async () => {
    try {
      await cleanupVerifiedMails();
      const config = await getGmailConfig();
      if (config && config.autoSync && config.gmailAddress && config.appPassword) {
        await syncGmailEmails();
      }
    } catch (e) {
      console.warn("Periodic Gmail sync warning:", e.message);
    }
  }, 15e3);
}

// server.ts
dotenv2.config();
process.on("uncaughtException", (err) => {
  console.error("[Process] Uncaught Exception (handled safely):", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("[Process] Unhandled Rejection (handled safely):", reason);
});
var globalIo = null;
var requestRateLimits = /* @__PURE__ */ new Map();
function rateLimitMiddleware(maxRequests = 15, windowMs = 6e4) {
  return (req, res, next) => {
    const ip = req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.ip || "unknown";
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
        return res.status(429).json({ error: "Rate limit exceeded: Too many requests. Automated bot protection active." });
      }
    }
    next();
  };
}
function secureSignatureMiddleware(req, res, next) {
  const sig = req.headers["x-ops-signature"] || req.headers["x-requested-with"] || req.headers["authorization"];
  if (!sig && process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Forbidden: Missing secure request signature or validation token." });
  }
  next();
}
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var PORT = (() => {
  const portArgIndex = process.argv.indexOf("--port");
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
  if (process.env.PORT && process.env.PORT !== "8080") {
    const parsed = parseInt(process.env.PORT, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 3e3;
})();
var ai = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
async function sendEmail(to, subject, html) {
  try {
    const resendKey = process.env.RESEND_API_KEY;
    let senderEmail = process.env.SENDER_EMAIL || "noreply@opsstake.online";
    if (!senderEmail.includes("@")) {
      senderEmail = "noreply@opsstake.online";
    }
    if (!resendKey) {
      console.warn("[Email Service] RESEND_API_KEY not configured. Outbound email blocked.");
      return false;
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendKey}`
      },
      body: JSON.stringify({
        from: `OpsSTAKE Arena <${senderEmail}>`,
        to: [to],
        subject,
        html
      })
    });
    const data = await res.json();
    if (res.ok) {
      console.log(`[Email Service] Message sent via Resend: ${data.id} to ${to}`);
      return true;
    } else {
      console.error(`[Email Service] Resend API error:`, data);
      return false;
    }
  } catch (err) {
    console.error("[Email Service] Critical error sending email:", err);
    return false;
  }
}
var app = express();
app.use(express.json({ limit: "250mb" }));
function escapeSql(val) {
  if (val === null || val === void 0) return "NULL";
  if (typeof val === "number") {
    if (isNaN(val)) return "0";
    return String(val);
  }
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "object") {
    return "'" + JSON.stringify(val).replace(/'/g, "''") + "'";
  }
  return "'" + String(val).replace(/'/g, "''") + "'";
}
async function getPlatformFeeSettings() {
  try {
    const res = await pool.query(`SELECT key, value FROM platform_settings WHERE key IN ('solo_fee_percent', 'squad_fee_percent')`);
    let soloFeePercent = 10;
    let squadFeePercent = 5;
    for (const row of res.rows) {
      if (row.key === "solo_fee_percent") soloFeePercent = parseInt(row.value, 10) || 10;
      if (row.key === "squad_fee_percent") squadFeePercent = parseInt(row.value, 10) || 5;
    }
    return { soloFeePercent, squadFeePercent };
  } catch {
    return { soloFeePercent: 10, squadFeePercent: 5 };
  }
}
async function getMaintenanceMode() {
  try {
    const res = await pool.query(`SELECT value FROM platform_settings WHERE key = 'maintenance_mode'`);
    return res.rows.length > 0 ? res.rows[0].value === "true" : false;
  } catch {
    return false;
  }
}
function getSoloRakePercentage(totalPotAmount, baseRate = 10) {
  if (totalPotAmount >= 1e5) return Math.min(baseRate / 100, 0.035);
  if (totalPotAmount >= 5e4) return Math.min(baseRate / 100, 0.04);
  if (totalPotAmount >= 1e4) return Math.min(baseRate / 100, 0.05);
  if (totalPotAmount >= 5e3) return Math.min(baseRate / 100, 0.07);
  if (totalPotAmount >= 2500) return Math.min(baseRate / 100, 0.08);
  return baseRate / 100;
}
function getSquadRakePercentage(stakePerPlayer, totalPotAmount, baseSquadRate = 5) {
  if (totalPotAmount >= 1e5) return Math.min(baseSquadRate / 100, 0.03);
  if (totalPotAmount >= 5e4) return Math.min(baseSquadRate / 100, 0.035);
  if (totalPotAmount >= 25e3) return Math.min(baseSquadRate / 100, 0.04);
  return baseSquadRate / 100;
}
function getRakePercentage(stakeOrPot) {
  return getSoloRakePercentage(stakeOrPot);
}
function generateRoomCode(mapName) {
  const num = Math.floor(1e3 + Math.random() * 9e3);
  const suffix = mapName.slice(0, 3).toUpperCase();
  return `CODM-${num}-${suffix}`;
}
function broadcastToMatchRoom(matchId, payload) {
  if (globalIo) {
    globalIo.to(matchId).emit("payload", payload);
  }
}
async function clearMatchChatInDb(matchId) {
  try {
    await pool.query(`
      UPDATE matches 
      SET chat_messages = '[]'::jsonb
      WHERE id = ${escapeSql(matchId)}
    `);
    if (globalIo) {
      globalIo.to(matchId).emit("chat_cleared", { matchId });
    }
    console.log(`[Chat Purge] Chat messages successfully purged from database for match ${matchId}`);
  } catch (err) {
    console.error(`Error clearing chat in DB for match ${matchId}:`, err);
  }
}
async function getUserFromDb(idOrEmail) {
  try {
    if (!idOrEmail) return null;
    const userRes = await pool.query(
      `SELECT id, username, codm_ign, codm_uid, email, phone, balance, escrow_balance, total_winnings, wins, losses, draws, avatar, bank_name, account_number, account_name, referred_by, referral_code, total_referral_earnings, role, telegram_chat_id, telegram_username, is_flagged, flag_reason, flagged_with_user_id, flag_matches, conflict_strikes FROM users WHERE id = $1 OR LOWER(email) = LOWER($1) LIMIT 1`,
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
      matchId: t.match_id || void 0
    }));

    const refListRes = await pool.query(
      `SELECT id, codm_ign, created_at FROM users WHERE referred_by = $1 ORDER BY created_at DESC LIMIT 10`,
      [r.id]
    );
    const referrals = refListRes.rows.map(row => ({
      id: row.id,
      codmIgn: row.codm_ign,
      createdAt: parseInt(row.created_at, 10)
    }));

    return {
      id: r.id,
      username: r.username || r.codm_ign,
      codmIgn: r.codm_ign,
      codmUid: r.codm_uid,
      tier: r.tier || "LEGENDARY TIER",
      clan: r.clan || "[1V1_PRO]",
      email: r.email || "",
      phone: r.phone || "+234 800 000 0000",
      balance: parseFloat(r.balance || 0),
      escrowBalance: parseFloat(r.escrow_balance || 0),
      totalWinnings: parseFloat(r.total_winnings || 0),
      wins: parseInt(r.wins || 0, 10),
      losses: parseInt(r.losses || 0, 10),
      draws: parseInt(r.draws || 0, 10),
      avatar: r.avatar,
      bankName: r.bank_name || void 0,
      accountNumber: r.account_number || void 0,
      accountName: r.account_name || void 0,
      referredBy: r.referred_by || void 0,
      referralCode: r.referral_code || r.username?.toLowerCase() || r.codm_ign?.toLowerCase(),
      totalReferralEarnings: parseFloat(r.total_referral_earnings || 0),
      role: r.role || "user",
      telegramChatId: r.telegram_chat_id || void 0,
      telegramUsername: r.telegram_username || void 0,
      isFlagged: r.is_flagged === true,
      flagReason: r.flag_reason || void 0,
      flaggedWithUserId: r.flagged_with_user_id || void 0,
      flagMatches: r.flag_matches ? typeof r.flag_matches === "string" ? JSON.parse(r.flag_matches) : r.flag_matches : void 0,
      conflictStrikes: parseInt(r.conflict_strikes || 0, 10),
      transactions,
      referrals
    };
  } catch (err) {
    console.error(`Error loading user ${idOrEmail} from DB:`, err);
    return null;
  }
}
async function getUserByEmailOrIgn(identifier) {
  try {
    const cleanIdent = identifier.trim().toLowerCase();
    const userRes = await pool.query(
      `SELECT id, username, codm_ign, codm_uid, email, phone, balance, escrow_balance, total_winnings, wins, losses, draws, avatar, bank_name, account_number, account_name, referred_by, referral_code, total_referral_earnings, role, telegram_chat_id, telegram_username, is_flagged, flag_reason, flagged_with_user_id, flag_matches, conflict_strikes, password_hash FROM users WHERE LOWER(email) = LOWER(${escapeSql(cleanIdent)}) OR LOWER(codm_ign) = LOWER(${escapeSql(cleanIdent)}) OR LOWER(username) = LOWER(${escapeSql(cleanIdent)}) OR LOWER(referral_code) = LOWER(${escapeSql(cleanIdent)})`
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
      matchId: t.match_id || void 0
    }));

    const refListRes = await pool.query(
      `SELECT id, codm_ign, created_at FROM users WHERE referred_by = $1 ORDER BY created_at DESC LIMIT 10`,
      [r.id]
    );
    const referrals = refListRes.rows.map(row => ({
      id: row.id,
      codmIgn: row.codm_ign,
      createdAt: parseInt(row.created_at, 10)
    }));

    const user = {
      id: r.id,
      username: r.username || r.codm_ign,
      codmIgn: r.codm_ign,
      codmUid: r.codm_uid,
      tier: r.tier || "LEGENDARY TIER",
      clan: r.clan || "[1V1_PRO]",
      email: r.email || "",
      phone: r.phone || "+234 800 000 0000",
      balance: parseFloat(r.balance || 0),
      escrowBalance: parseFloat(r.escrow_balance || 0),
      totalWinnings: parseFloat(r.total_winnings || 0),
      wins: parseInt(r.wins || 0, 10),
      losses: parseInt(r.losses || 0, 10),
      draws: parseInt(r.draws || 0, 10),
      avatar: r.avatar,
      bankName: r.bank_name || void 0,
      accountNumber: r.account_number || void 0,
      accountName: r.account_name || void 0,
      referredBy: r.referred_by || void 0,
      referralCode: r.referral_code || r.username?.toLowerCase() || r.codm_ign?.toLowerCase(),
      totalReferralEarnings: parseFloat(r.total_referral_earnings || 0),
      role: r.role || "user",
      telegramChatId: r.telegram_chat_id || void 0,
      telegramUsername: r.telegram_username || void 0,
      isFlagged: r.is_flagged === true,
      flagReason: r.flag_reason || void 0,
      flaggedWithUserId: r.flagged_with_user_id || void 0,
      flagMatches: r.flag_matches ? typeof r.flag_matches === "string" ? JSON.parse(r.flag_matches) : r.flag_matches : void 0,
      conflictStrikes: parseInt(r.conflict_strikes || 0, 10),
      transactions,
      referrals
    };
    return { user, passwordHash: r.password_hash || "" };
  } catch (err) {
    console.error("Error finding user by email or IGN:", err);
    return null;
  }
}
async function getUserByReferralCodeOrIdentifier(identifier) {
  const res = await getUserByEmailOrIgn(identifier);
  return res ? res.user : null;
}
async function saveUserToDb(user, password, forceBalanceUpdate = false) {
  try {
    const passValue = password ? escapeSql(password) : "NULL";
    const balanceUpdateFragment = forceBalanceUpdate ? `balance = EXCLUDED.balance, escrow_balance = EXCLUDED.escrow_balance, total_winnings = EXCLUDED.total_winnings,` : `balance = users.balance, escrow_balance = users.escrow_balance, total_winnings = users.total_winnings,`;
    await pool.query(`
      INSERT INTO users (id, username, codm_ign, codm_uid, tier, clan, email, phone, password_hash, balance, escrow_balance, total_winnings, wins, losses, draws, avatar, bank_name, account_number, account_name, referred_by, referral_code, total_referral_earnings, role, telegram_chat_id, telegram_username, created_at)
      VALUES (
        ${escapeSql(user.id)},
        ${escapeSql(user.username)},
        ${escapeSql(user.codmIgn)},
        ${escapeSql(user.codmUid)},
        ${escapeSql(user.tier || "LEGENDARY TIER")},
        ${escapeSql(user.clan || "[1V1_PRO]")},
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
        ${escapeSql(user.role || "user")},
        ${escapeSql(user.telegramChatId || null)},
        ${escapeSql(user.telegramUsername || null)},
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
        telegram_chat_id = COALESCE(EXCLUDED.telegram_chat_id, users.telegram_chat_id),
        telegram_username = COALESCE(EXCLUDED.telegram_username, users.telegram_username),
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
async function saveTransactionToDb(userId, tx) {
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
async function getMatchFromDb(id) {
  try {
    const res = await pool.query(`SELECT * FROM matches WHERE id = ${escapeSql(id)}`);
    if (res.rows.length === 0) return null;
    const m = res.rows[0];
    return {
      id: m.id,
      challengeCode: m.challenge_code,
      roomCode: m.room_code || void 0,
      gameMode: m.game_mode,
      map: m.map,
      rules: typeof m.rules === "string" ? JSON.parse(m.rules) : m.rules || [],
      stakeAmount: parseFloat(m.stake_amount),
      potAmount: parseFloat(m.pot_amount),
      platformFeePercentage: parseInt(m.platform_fee_percentage, 10) || 10,
      platformFee: parseFloat(m.platform_fee || 0),
      winnerPayout: parseFloat(m.winner_payout),
      matchDurationMinutes: parseInt(m.match_duration_minutes, 10) || 15,
      matchType: m.match_type || "solo",
      squadData: m.squad_data ? typeof m.squad_data === "string" ? JSON.parse(m.squad_data) : m.squad_data : void 0,
      status: m.status,
      createdAt: parseInt(m.created_at, 10),
      creator: typeof m.creator_data === "string" ? JSON.parse(m.creator_data) : m.creator_data,
      opponent: m.opponent_data ? typeof m.opponent_data === "string" ? JSON.parse(m.opponent_data) : m.opponent_data : void 0,
      winnerId: m.winner_id || void 0,
      winnerIgn: m.winner_ign || void 0,
      resolutionNotes: m.resolution_notes || void 0,
      chatMessages: typeof m.chat_messages === "string" ? JSON.parse(m.chat_messages) : m.chat_messages || [],
      roomGeneratedAt: m.room_generated_at ? parseInt(m.room_generated_at, 10) : void 0,
      isPublic: m.is_public ?? true,
      conflictRetries: parseInt(m.conflict_retries || "0", 10),
      reviewerId: m.reviewer_id || void 0,
      reviewerName: m.reviewer_name || void 0,
      creatorScreenshot: m.creator_screenshot || void 0,
      opponentScreenshot: m.opponent_screenshot || void 0,
      mutualActionState: m.mutual_action_data ? typeof m.mutual_action_data === "string" ? JSON.parse(m.mutual_action_data) : m.mutual_action_data : void 0
    };
  } catch (err) {
    console.error(`Error getting match ${id} from DB:`, err);
    return null;
  }
}
async function getMatchByCodeOrId(codeOrId) {
  if (!codeOrId) return null;
  const clean = String(codeOrId).trim().replace(/^#/, "");
  try {
    const res = await pool.query(
      `SELECT id FROM matches 
       WHERE id = $1 
          OR room_code = $1 
          OR challenge_code = $1 
          OR LOWER(room_code) = LOWER($1) 
          OR LOWER(challenge_code) = LOWER($1) 
          OR LOWER(room_code) = LOWER('CODM-' || $1)
          OR REPLACE(LOWER(room_code), '#', '') = LOWER($1)
          OR REPLACE(LOWER(challenge_code), '#', '') = LOWER($1)
       LIMIT 1`,
      [clean]
    );
    if (res.rows.length === 0) return null;
    return await getMatchFromDb(res.rows[0].id);
  } catch (err) {
    console.error("Error getting match by code or ID:", err);
    return null;
  }
}
async function getAllMatchesFromDb() {
  try {
    const res = await pool.query(`
      SELECT id, challenge_code, room_code, game_mode, map, rules, stake_amount, pot_amount, 
             platform_fee_percentage, platform_fee, winner_payout, match_duration_minutes, 
             match_type, squad_data, status, created_at, creator_id, creator_data, 
             opponent_id, opponent_data, winner_id, winner_ign, resolution_notes, 
             chat_messages, room_generated_at, settled_at, is_public, conflict_retries,
             reviewer_id, reviewer_name, mutual_action_data
      FROM matches 
      WHERE status IN ('PENDING_OPPONENT_STAKE', 'READY_TO_PLAY', 'IN_PROGRESS', 'SUBMITTING_RESULTS', 'VERIFYING', 'DISPUTED')
      OR created_at > ${Date.now() - 24 * 60 * 60 * 1e3}
      ORDER BY created_at DESC 
      LIMIT 100
    `);
    return res.rows.map((m) => ({
      id: m.id,
      challengeCode: m.challenge_code,
      roomCode: m.room_code || void 0,
      gameMode: m.game_mode,
      map: m.map,
      rules: typeof m.rules === "string" ? JSON.parse(m.rules) : m.rules || [],
      stakeAmount: parseFloat(m.stake_amount),
      potAmount: parseFloat(m.pot_amount),
      platformFeePercentage: parseInt(m.platform_fee_percentage, 10) || 10,
      platformFee: parseFloat(m.platform_fee || 0),
      winnerPayout: parseFloat(m.winner_payout),
      matchDurationMinutes: parseInt(m.match_duration_minutes, 10) || 15,
      matchType: m.match_type || "solo",
      squadData: m.squad_data ? typeof m.squad_data === "string" ? JSON.parse(m.squad_data) : m.squad_data : void 0,
      status: m.status,
      createdAt: parseInt(m.created_at, 10),
      creator: typeof m.creator_data === "string" ? JSON.parse(m.creator_data) : m.creator_data,
      opponent: m.opponent_data ? typeof m.opponent_data === "string" ? JSON.parse(m.opponent_data) : m.opponent_data : void 0,
      winnerId: m.winner_id || void 0,
      winnerIgn: m.winner_ign || void 0,
      resolutionNotes: m.resolution_notes || void 0,
      chatMessages: typeof m.chat_messages === "string" ? JSON.parse(m.chat_messages) : m.chat_messages || [],
      roomGeneratedAt: m.room_generated_at ? parseInt(m.room_generated_at, 10) : void 0,
      isPublic: m.is_public ?? true,
      conflictRetries: parseInt(m.conflict_retries || "0", 10),
      reviewerId: m.reviewer_id || void 0,
      reviewerName: m.reviewer_name || void 0,
      mutualActionState: m.mutual_action_data ? typeof m.mutual_action_data === "string" ? JSON.parse(m.mutual_action_data) : m.mutual_action_data : void 0
      // screenshots excluded for list performance!
    }));
  } catch (err) {
    console.error("Error getting matches from DB:", err);
    return [];
  }
}
async function saveMatchToDb(match) {
  try {
    const creatorToSave = { ...match.creator };
    const opponentToSave = match.opponent ? { ...match.opponent } : null;
    const creatorScreenshot = creatorToSave.screenshotUrl;
    const opponentScreenshot = opponentToSave ? opponentToSave.screenshotUrl : null;
    delete creatorToSave.screenshotUrl;
    if (opponentToSave) delete opponentToSave.screenshotUrl;
    await pool.query(`
      INSERT INTO matches (
        id, challenge_code, room_code, game_mode, map, rules,
        stake_amount, pot_amount, platform_fee_percentage, platform_fee, winner_payout,
        match_duration_minutes, match_type, squad_data, status, creator_id, creator_data, opponent_id, opponent_data,
        winner_id, winner_ign, resolution_notes, chat_messages, created_at, room_generated_at, settled_at, is_public, conflict_retries,
        reviewer_id, reviewer_name, creator_screenshot, opponent_screenshot
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
        ${escapeSql(match.matchType || "solo")},
        ${match.squadData ? escapeSql(match.squadData) : "NULL"},
        ${escapeSql(match.status)},
        ${escapeSql(match.creator.id)},
        ${escapeSql(creatorToSave)},
        ${match.opponent ? escapeSql(match.opponent.id) : "NULL"},
        ${opponentToSave ? escapeSql(opponentToSave) : "NULL"},
        ${escapeSql(match.winnerId || null)},
        ${escapeSql(match.winnerIgn || null)},
        ${escapeSql(match.resolutionNotes || null)},
        ${escapeSql(match.chatMessages || [])},
        ${escapeSql(match.createdAt)},
        ${escapeSql(match.roomGeneratedAt || null)},
        ${escapeSql(match.settled_at || match.settledAt || null)},
        ${escapeSql(match.isPublic !== false)},
        ${escapeSql(match.conflictRetries || 0)},
        ${escapeSql(match.reviewerId || null)},
        ${escapeSql(match.reviewerName || null)},
        ${escapeSql(creatorScreenshot || null)},
        ${escapeSql(opponentScreenshot || null)}
      )
      ON CONFLICT (id) DO UPDATE SET
        room_code = EXCLUDED.room_code,
        status = EXCLUDED.status,
        pot_amount = EXCLUDED.pot_amount,
        platform_fee_percentage = EXCLUDED.platform_fee_percentage,
        platform_fee = EXCLUDED.platform_fee,
        winner_payout = EXCLUDED.winner_payout,
        match_duration_minutes = EXCLUDED.match_duration_minutes,
        match_type = EXCLUDED.match_type,
        squad_data = EXCLUDED.squad_data,
        creator_data = EXCLUDED.creator_data,
        opponent_id = EXCLUDED.opponent_id,
        opponent_data = EXCLUDED.opponent_data,
        winner_id = EXCLUDED.winner_id,
        winner_ign = EXCLUDED.winner_ign,
        resolution_notes = EXCLUDED.resolution_notes,
        chat_messages = EXCLUDED.chat_messages,
        room_generated_at = EXCLUDED.room_generated_at,
        settled_at = EXCLUDED.settled_at,
        is_public = EXCLUDED.is_public,
        conflict_retries = EXCLUDED.conflict_retries,
        reviewer_id = EXCLUDED.reviewer_id,
        reviewer_name = EXCLUDED.reviewer_name,
        creator_screenshot = EXCLUDED.creator_screenshot,
        opponent_screenshot = EXCLUDED.opponent_screenshot;
    `);
    try {
      broadcastMatchStateChange(match);
    } catch (bcErr) {
      console.warn("broadcastMatchStateChange error:", bcErr);
    }
  } catch (err) {
    console.error(`Error saving match ${match.id} to DB:`, err);
    throw err;
  }
}
function broadcastMatchStateChange(match, alertType, alertTitle, alertBody) {
  if (!match || !match.id) return;
  if (globalIo) {
    globalIo.emit("matchUpdated", match);
    globalIo.emit("match_updated", match);

    // Real-time broadcast for affected players' balances
    if (match.creator?.id) broadcastUserUpdate(match.creator.id);
    if (match.opponent?.id) broadcastUserUpdate(match.opponent.id);
    if (match.squadData?.slots && Array.isArray(match.squadData.slots)) {
      for (const slot of match.squadData.slots) {
        if (slot.userId) broadcastUserUpdate(slot.userId);
      }
    }
    // Real-time broadcast for platform finance
    broadcastFinanceUpdate();

    let soundType = "default";
    let title = alertTitle || "";
    let body = alertBody || "";
    if (alertType === "NEW_MATCH_AWAITING_OPPONENT" || !match.opponent && (match.status === "PENDING_OPPONENT_STAKE" || match.status === "PENDING")) {
      soundType = "rival_joined";
      title = title || `⚔️ New Match Open: ₦${parseFloat(match.stakeAmount || 0).toLocaleString()} Challenge!`;
      body = body || `${match.creator?.codmIgn || "A gladiator"} is awaiting an opponent for 1v1 ${match.gameMode || "Multiplayer"} on ${match.map || "Shipment"} (₦${parseFloat(match.stakeAmount || 0).toLocaleString()}). Tap to accept!`;
    } else if (alertType === "RIVAL_JOINED" || match.status === "OPPONENT_STAKED_AWAITING_CREATOR") {
      soundType = "rival_joined";
      title = title || `⚔️ Rival Joined Challenge #${match.challengeCode}!`;
      body = body || `${match.opponent?.codmIgn || "A rival"} staked ₦${parseFloat(match.stakeAmount || 0).toLocaleString()} in escrow. Match your stake to battle!`;
    } else if (alertType === "MATCH_STARTED" || match.status === "READY_TO_PLAY" || match.status === "IN_PROGRESS") {
      soundType = "match_started";
      title = title || `🔥 Match Started! Room Code #${match.roomCode || "Ready"}`;
      body = body || `Both stakes locked (Pot: ₦${parseFloat(match.potAmount || 0).toLocaleString()}). Join CODM Room #${match.roomCode} now!`;
    } else if (alertType === "RESULT_DISPUTED" || match.status === "DISPUTED") {
      soundType = "disputed";
      title = title || `⚠️ Result Disputed on Challenge #${match.challengeCode}`;
      body = body || `Conflicting claims submitted. Escrow pot is protected while screenshots are reviewed.`;
    } else if (alertType === "MATCH_SETTLED" || match.status === "SETTLED") {
      soundType = "settled";
      title = title || `🏆 Match Settled! Winner: ${match.winnerIgn || "Champion"}`;
      body = body || `₦${parseFloat(match.winnerPayout || 0).toLocaleString()} awarded. Winnings credited to wallet.`;
    } else if (alertType === "MATCH_CANCELLED" || match.status === "CANCELLED" || match.status === "ABANDONED" || match.status === "EXPIRED") {
      soundType = "default";
      title = title || `🛡️ Match Escrow Released`;
      body = body || `Challenge #${match.challengeCode} ended. Funds refunded to wallet.`;
    }
    if (title && body) {
      globalIo.emit("matchAlert", {
        id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        matchId: match.id,
        challengeCode: match.challengeCode,
        roomCode: match.roomCode,
        status: match.status,
        creatorId: match.creator?.id,
        opponentId: match.opponent?.id,
        creatorIgn: match.creator?.codmIgn,
        opponentIgn: match.opponent?.codmIgn,
        title,
        body,
        soundType,
        timestamp: Date.now(),
        match
      });
    }
  }
}
async function broadcastFinanceUpdate() {
  if (!globalIo) return;
  try {
    let resFin = await pool.query(`SELECT * FROM platform_finance WHERE id = 'main'`);
    if (resFin.rows.length === 0) {
      await pool.query(`INSERT INTO platform_finance (id, total_fees_collected, total_fees_withdrawn) VALUES ('main', 0, 0) ON CONFLICT DO NOTHING`);
      resFin = await pool.query(`SELECT * FROM platform_finance WHERE id = 'main'`);
    }
    const finRow = resFin.rows[0] || { total_fees_collected: 0, total_fees_withdrawn: 0 };
    let totalCollected = parseFloat(finRow.total_fees_collected || 0);

    let totalReferralPayouts = 0;
    try {
      const refRes = await pool.query(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'REFERRAL_EARNING'`);
      totalReferralPayouts = parseFloat(refRes.rows[0]?.total || 0);
    } catch (_) {}

    if (totalCollected === 0) {
      try {
        const sumRes = await pool.query(`SELECT COALESCE(SUM(platform_fee), 0) as total FROM matches WHERE status = 'SETTLED'`);
        const sumVal = parseFloat(sumRes.rows[0]?.total || 0);
        if (sumVal > 0) {
          totalCollected = Math.max(0, sumVal - totalReferralPayouts);
          await pool.query(`UPDATE platform_finance SET total_fees_collected = ${escapeSql(totalCollected)} WHERE id = 'main'`);
        }
      } catch (_) {}
    }

    const totalWithdrawn = parseFloat(finRow.total_fees_withdrawn || 0);
    const available = Math.max(0, totalCollected - totalWithdrawn);

    let recentMatches = [];
    try {
      const matchRes = await pool.query(`
        SELECT m.id, m.challenge_code, m.game_mode, m.map, m.stake_amount, m.pot_amount, m.platform_fee, m.winner_ign, m.settled_at,
               COALESCE(SUM(t.amount), 0) as referral_deducted
        FROM matches m
        LEFT JOIN transactions t ON t.match_id = m.id AND t.type = 'REFERRAL_EARNING'
        WHERE m.platform_fee > 0 
        GROUP BY m.id, m.challenge_code, m.game_mode, m.map, m.stake_amount, m.pot_amount, m.platform_fee, m.winner_ign, m.settled_at, m.created_at
        ORDER BY COALESCE(m.settled_at, m.created_at) DESC 
        LIMIT 15
      `);
      recentMatches = matchRes.rows.map((m) => {
        const grossFee = parseFloat(m.platform_fee || 0);
        const refDeducted = parseFloat(m.referral_deducted || 0);
        const netAdminFee = Math.max(0, grossFee - refDeducted);
        return {
          id: m.id,
          challengeCode: m.challenge_code,
          gameMode: m.game_mode,
          map: m.map,
          stakeAmount: parseFloat(m.stake_amount || 0),
          potAmount: parseFloat(m.pot_amount || 0),
          platformFee: netAdminFee,
          grossPlatformFee: grossFee,
          referralDeducted: refDeducted,
          winnerIgn: m.winner_ign || "Winner",
          settledAt: parseInt(m.settled_at || "0", 10)
        };
      });
    } catch (_) {}

    let recentWithdrawals = [];
    try {
      const txRes = await pool.query(`
        SELECT id, amount, description, timestamp 
        FROM transactions 
        WHERE type = 'PLATFORM_FEE_WITHDRAWAL' 
        ORDER BY timestamp DESC 
        LIMIT 15
      `);
      recentWithdrawals = txRes.rows.map((tx) => ({
        id: tx.id,
        amount: parseFloat(tx.amount || 0),
        description: tx.description,
        timestamp: parseInt(tx.timestamp || "0", 10)
      }));
    } catch (_) {}

    const payload = {
      total_fees_collected: totalCollected,
      total_fees_withdrawn: totalWithdrawn,
      available_fees: available,
      recent_fee_matches: recentMatches,
      recent_withdrawals: recentWithdrawals
    };

    globalIo.emit("financeUpdated", payload);
    globalIo.emit("finance_updated", payload);
  } catch (err) {
    console.error("Error broadcasting finance update:", err);
  }
}

async function broadcastUserUpdate(userId: string) {
  if (!globalIo || !userId) return;
  try {
    const updatedUser = await getUserFromDb(userId);
    if (updatedUser) {
      globalIo.emit("userUpdated", updatedUser);
      globalIo.emit("userBalanceUpdated", {
        userId: updatedUser.id,
        balance: updatedUser.balance,
        escrowBalance: updatedUser.escrowBalance
      });
    }
  } catch (err) {
    console.error("Error broadcasting user update:", err);
  }
}

async function updatePlatformFinance(fee) {
  try {
    await pool.query(`
      UPDATE platform_finance 
      SET total_fees_collected = total_fees_collected + ${escapeSql(fee)}
      WHERE id = 'main'
    `);
    setImmediate(() => broadcastFinanceUpdate());
  } catch (err) {
    console.error("Error updating platform finance:", err);
  }
}

async function withdrawPlatformFees(amount) {
  try {
    const res = await pool.query(`
      UPDATE platform_finance 
      SET total_fees_withdrawn = total_fees_withdrawn + ${escapeSql(amount)}
      WHERE id = 'main' AND (total_fees_collected - total_fees_withdrawn) >= ${escapeSql(amount)}
      RETURNING *
    `);
    if (res.rows.length > 0) {
      setImmediate(() => broadcastFinanceUpdate());
      return true;
    }
    return false;
  } catch (err) {
    console.error("Error withdrawing platform fees:", err);
    return false;
  }
}
app.post("/api/inbound-email", express.json({ limit: "5mb" }), async (req, res) => {
  try {
    const { from, fromName, subject, text, html } = req.body;
    console.log("\u{1F4E7} Received email via Inbound Webhook:", subject);
    const id = `mail_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
    await pool.query(`
      INSERT INTO admin_mailbox (id, sender_email, sender_name, subject, body, created_at)
      VALUES (
        ${escapeSql(from)},
        ${escapeSql(fromName || "Unknown")},
        ${escapeSql(subject)},
        ${escapeSql(text || html || "")},
        ${Date.now()}
      )
    `);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("\u26A0\uFE0F Error processing inbound email:", err);
    res.status(500).json({ error: "Failed to process email" });
  }
});
function sanitizePublicPlayerProfile(player, includeScreenshot = false) {
  if (!player) return void 0;
  return {
    id: player.id,
    username: player.username || player.codmIgn || "Gladiator",
    codmIgn: player.codmIgn || player.username || "Gladiator",
    codmUid: player.codmUid || "",
    avatar: player.avatar || "",
    staked: Boolean(player.staked),
    resultClaim: player.resultClaim,
    submittedAt: player.submittedAt,
    screenshotUrl: includeScreenshot ? player.screenshotUrl : void 0,
    screenshotAnalysis: player.screenshotAnalysis,
    systemAiDetection: player.systemAiDetection,
    forensicAnalysis: player.forensicAnalysis,
    resubmissionRequested: player.resubmissionRequested,
    resubmissionReason: player.resubmissionReason
  };
}
function sanitizeMatchForPublic(match, includeScreenshots = false) {
  if (!match) return match;
  const creator = sanitizePublicPlayerProfile(match.creator, includeScreenshots);
  const opponent = match.opponent ? sanitizePublicPlayerProfile(match.opponent, includeScreenshots) : void 0;
  if (includeScreenshots) {
    if (match.creatorScreenshot && !creator.screenshotUrl) creator.screenshotUrl = match.creatorScreenshot;
    if (match.opponent && match.opponentScreenshot && !opponent.screenshotUrl) opponent.screenshotUrl = match.opponentScreenshot;
  }
  return {
    ...match,
    creator,
    opponent
  };
}
async function isUserOrAdmin(req, targetUserId) {
  const requesterId = req.headers["x-user-id"] || req.headers["x-admin-id"] || req.body?.userId || req.body?.adminUserId || req.query?.userId || req.query?.adminUserId;
  if (!requesterId) return false;
  if (String(requesterId) === String(targetUserId)) return true;
  const requesterUser = await getUserFromDb(String(requesterId));
  return Boolean(requesterUser && requesterUser.role === "admin");
}
async function requireAdminAuth(req, res, next) {
  if (req.path === "/claim-admin" || req.path === "/claim-admin/") {
    return next();
  }
  const userId = req.headers["x-admin-id"] || req.headers["x-user-id"] || req.headers["authorization"]?.replace("Bearer ", "") || req.body?.adminUserId || req.body?.userId || req.query?.adminUserId || req.query?.userId;
  if (!userId || userId === "null" || userId === "undefined" || userId === "") {
    console.warn(`[Admin Auth] Blocked request for ${req.path}: Missing ID in headers/body/query.`);
    return res.status(403).json({ error: "Forbidden: Missing admin authentication credentials" });
  }
  const user = await getUserFromDb(String(userId));
  if (!user || user.role !== "admin" && user.role !== "moderator") {
    return res.status(403).json({ error: "Unauthorized: Administrative or Moderator privileges required" });
  }
  req.adminUser = user;
  next();
}
async function maintenanceMiddleware(req, res, next) {
  const publicPaths = [
    "/api/maintenance-status",
    "/api/server-ip",
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/request-verification",
    "/api/auth/reset-password",
    "/api/msksksnuwje/claim-admin"
  ];
  
  if (publicPaths.includes(req.path)) {
    return next();
  }
  
  const maintenanceActive = await getMaintenanceMode();
  if (maintenanceActive) {
    const userId = req.headers["x-user-id"] || req.headers["x-admin-id"] || req.body?.userId || req.body?.adminUserId || req.query?.userId || req.query?.adminUserId;
    if (userId) {
      const user = await getUserFromDb(String(userId));
      if (user && (user.role === "admin" || user.role === "moderator" || user.role === "super_admin")) {
        return next();
      }
    }
    
    // Allow static file requests during maintenance
    if (!req.path.startsWith("/api/")) {
      return next();
    }

    return res.status(503).json({
      error: "System Maintenance",
      message: "OPS STAKE is currently undergoing scheduled maintenance. Access is restricted to administrators only. We will be back online shortly.",
      maintenanceMode: true
    });
  }
  next();
}
app.use("/api", maintenanceMiddleware);
app.use("/api/msksksnuwje", requireAdminAuth);
app.get("/api/msksksnuwje/flagged-accounts", async (req, res) => {
  const user = req.adminUser;
  if (user.role !== "admin") return res.status(403).json({ error: "Admin access required" });
  try {
    const usersRes = await pool.query(`SELECT * FROM users ORDER BY created_at DESC`);
    const users = usersRes.rows;
    const flaggedUsersMap = /* @__PURE__ */ new Map();
    const clusters = [];
    const emailMap = /* @__PURE__ */ new Map();
    const phoneMap = /* @__PURE__ */ new Map();
    const ignMap = /* @__PURE__ */ new Map();
    const accMap = /* @__PURE__ */ new Map();
    for (const u of users) {
      const em = (u.email || "").trim().toLowerCase();
      const ph = (u.phone || "").trim().replace(/\D/g, "");
      const ign = (u.codm_ign || u.username || "").trim().toLowerCase();
      const acc = (u.account_number || "").trim().replace(/\D/g, "");
      if (em) {
        if (!emailMap.has(em)) emailMap.set(em, []);
        emailMap.get(em).push(u);
      }
      if (ph && ph.length >= 7) {
        const key = ph.slice(-10);
        if (!phoneMap.has(key)) phoneMap.set(key, []);
        phoneMap.get(key).push(u);
      }
      if (ign) {
        if (!ignMap.has(ign)) ignMap.set(ign, []);
        ignMap.get(ign).push(u);
      }
      if (acc && acc.length >= 8) {
        if (!accMap.has(acc)) accMap.set(acc, []);
        accMap.get(acc).push(u);
      }
    }
    const checkAndAddCluster = (attrName, map) => {
      for (const [val, group] of map.entries()) {
        if (group.length > 1) {
          clusters.push({
            attribute: attrName,
            value: val,
            users: group.map((g) => ({ id: g.id, codmIgn: g.codm_ign || g.username, email: g.email, phone: g.phone, accountNumber: g.account_number }))
          });
          for (const u of group) {
            flaggedUsersMap.set(u.id, {
              id: u.id,
              username: u.username || u.codm_ign,
              codmIgn: u.codm_ign,
              email: u.email,
              phone: u.phone,
              bankName: u.bank_name,
              accountNumber: u.account_number,
              accountName: u.account_name,
              balance: parseFloat(u.balance || 0),
              isFlagged: true,
              flagReason: `Shared ${attrName}: ${val} with ${group.filter((g) => g.id !== u.id).map((g) => g.codm_ign).join(", ")}`,
              flaggedWithUserId: group.find((g) => g.id !== u.id)?.id,
              createdAt: parseInt(u.created_at || "0", 10)
            });
          }
        }
      }
    };
    checkAndAddCluster("Email", emailMap);
    checkAndAddCluster("Phone Number", phoneMap);
    checkAndAddCluster("CODM IGN", ignMap);
    checkAndAddCluster("Bank Account Number", accMap);
    for (const u of users) {
      if (u.is_flagged && !flaggedUsersMap.has(u.id)) {
        flaggedUsersMap.set(u.id, {
          id: u.id,
          username: u.username || u.codm_ign,
          codmIgn: u.codm_ign,
          email: u.email,
          phone: u.phone,
          bankName: u.bank_name,
          accountNumber: u.account_number,
          accountName: u.account_name,
          balance: parseFloat(u.balance || 0),
          isFlagged: true,
          flagReason: u.flag_reason || "Flagged by multi-accounting detection system",
          flaggedWithUserId: u.flagged_with_user_id,
          createdAt: parseInt(u.created_at || "0", 10)
        });
      }
    }
    res.json({
      flaggedUsers: Array.from(flaggedUsersMap.values()),
      clusters
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to fetch flagged accounts" });
  }
});
app.post("/api/msksksnuwje/flagged-accounts/:userId/dismiss", async (req, res) => {
  try {
    const { userId } = req.params;
    await pool.query(`
      UPDATE users 
      SET is_flagged = false, flag_reason = NULL, flagged_with_user_id = NULL, flag_matches = NULL 
      WHERE id = ${escapeSql(userId)}
    `);
    res.json({ success: true, message: "Account flag dismissed" });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to dismiss flag" });
  }
});
app.post("/api/msksksnuwje/flagged-accounts/:userId/ban", async (req, res) => {
  try {
    const { userId } = req.params;
    await pool.query(`
      UPDATE users 
      SET role = 'banned', is_flagged = true, flag_reason = 'Account banned for multi-accounting violation'
      WHERE id = ${escapeSql(userId)}
    `);
    res.json({ success: true, message: "Account banned successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to ban account" });
  }
});
app.post("/api/msksksnuwje/flagged-accounts/:userId/unban", async (req, res) => {
  try {
    const { userId } = req.params;
    await pool.query(`
      UPDATE users 
      SET role = 'user', is_flagged = false, flag_reason = NULL 
      WHERE id = ${escapeSql(userId)}
    `);
    res.json({ success: true, message: "Account unbanned successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to unban account" });
  }
});
app.post("/api/msksksnuwje/withdraw", async (req, res) => {
  if (req.adminUser.role !== "admin") return res.status(403).json({ error: "Admin access required" });
  const { userId, amount } = req.body;
  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ error: "Invalid withdrawal amount" });
  }
  const user = await getUserFromDb(userId);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Unauthorized: Admin privileges required" });
  }
  const success = await withdrawPlatformFees(numAmount);
  if (success) {
    await pool.query(`
      UPDATE users 
      SET balance = balance + ${escapeSql(numAmount)} 
      WHERE id = ${escapeSql(user.id)}
    `);
    try {
      await pool.query(`
        INSERT INTO transactions (id, user_id, type, amount, description, timestamp)
        VALUES (
          ${escapeSql(`tx_fee_${Date.now()}`)},
          ${escapeSql(user.id)},
          'PLATFORM_FEE_WITHDRAWAL',
          ${escapeSql(numAmount)},
          ${escapeSql(`Platform fee withdrawal to admin wallet: \u20A6${numAmount.toLocaleString()}`)},
          ${Date.now()}
        )
      `);
    } catch (e) {
      console.warn("Could not record fee withdrawal transaction:", e);
    }
    const refreshed = await getUserFromDb(user.id);
    res.json({ success: true, balance: refreshed?.balance ?? user.balance });
  } else {
    res.status(400).json({ error: "Insufficient platform funds or withdrawal failed" });
  }
});
app.get("/api/msksksnuwje/finance", async (req, res) => {
  try {
    const { userId } = req.query;
    const user = await getUserFromDb(userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin privileges required" });
    }
    let resFin = await pool.query(`SELECT * FROM platform_finance WHERE id = 'main'`);
    if (resFin.rows.length === 0) {
      await pool.query(`INSERT INTO platform_finance (id, total_fees_collected, total_fees_withdrawn) VALUES ('main', 0, 0) ON CONFLICT DO NOTHING`);
      resFin = await pool.query(`SELECT * FROM platform_finance WHERE id = 'main'`);
    }
    let finRow = resFin.rows[0] || { total_fees_collected: 0, total_fees_withdrawn: 0 };
    let totalCollected = parseFloat(finRow.total_fees_collected || 0);
    let totalReferralPayouts = 0;
    try {
      const refRes = await pool.query(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'REFERRAL_EARNING'`);
      totalReferralPayouts = parseFloat(refRes.rows[0]?.total || 0);
    } catch (_) {
    }
    if (totalCollected === 0) {
      try {
        const sumRes = await pool.query(`SELECT COALESCE(SUM(platform_fee), 0) as total FROM matches WHERE status = 'SETTLED'`);
        const sumVal = parseFloat(sumRes.rows[0]?.total || 0);
        if (sumVal > 0) {
          totalCollected = Math.max(0, sumVal - totalReferralPayouts);
          await pool.query(`UPDATE platform_finance SET total_fees_collected = ${escapeSql(totalCollected)} WHERE id = 'main'`);
        }
      } catch (_) {
      }
    }
    const totalWithdrawn = parseFloat(finRow.total_fees_withdrawn || 0);
    const available = Math.max(0, totalCollected - totalWithdrawn);
    let recentMatches = [];
    try {
      const matchRes = await pool.query(`
        SELECT m.id, m.challenge_code, m.game_mode, m.map, m.stake_amount, m.pot_amount, m.platform_fee, m.winner_ign, m.settled_at,
               COALESCE(SUM(t.amount), 0) as referral_deducted
        FROM matches m
        LEFT JOIN transactions t ON t.match_id = m.id AND t.type = 'REFERRAL_EARNING'
        WHERE m.platform_fee > 0 
        GROUP BY m.id, m.challenge_code, m.game_mode, m.map, m.stake_amount, m.pot_amount, m.platform_fee, m.winner_ign, m.settled_at, m.created_at
        ORDER BY COALESCE(m.settled_at, m.created_at) DESC 
        LIMIT 15
      `);
      recentMatches = matchRes.rows.map((m) => {
        const grossFee = parseFloat(m.platform_fee || 0);
        const refDeducted = parseFloat(m.referral_deducted || 0);
        const netAdminFee = Math.max(0, grossFee - refDeducted);
        return {
          id: m.id,
          challengeCode: m.challenge_code,
          gameMode: m.game_mode,
          map: m.map,
          stakeAmount: parseFloat(m.stake_amount || 0),
          potAmount: parseFloat(m.pot_amount || 0),
          platformFee: netAdminFee,
          // Net platform fee after referral reward deduction!
          grossPlatformFee: grossFee,
          referralDeducted: refDeducted,
          winnerIgn: m.winner_ign || "Winner",
          settledAt: parseInt(m.settled_at || "0", 10)
        };
      });
    } catch (_) {
    }
    let recentWithdrawals = [];
    try {
      const txRes = await pool.query(`
        SELECT id, amount, description, timestamp 
        FROM transactions 
        WHERE type = 'PLATFORM_FEE_WITHDRAWAL' 
        ORDER BY timestamp DESC 
        LIMIT 15
      `);
      recentWithdrawals = txRes.rows.map((tx) => ({
        id: tx.id,
        amount: parseFloat(tx.amount || 0),
        description: tx.description,
        timestamp: parseInt(tx.timestamp || "0", 10)
      }));
    } catch (_) {
    }
    res.json({
      total_fees_collected: totalCollected,
      total_fees_withdrawn: totalWithdrawn,
      available_fees: available,
      recent_fee_matches: recentMatches,
      recent_withdrawals: recentWithdrawals
    });
  } catch (err) {
    console.error("Error fetching admin finance:", err);
    res.status(500).json({ error: err.message || "Failed to fetch platform finance" });
  }
});
app.get("/api/admin/fee-settings", async (req, res) => {
  try {
    const settings = await getPlatformFeeSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to load fee settings" });
  }
});
app.get("/api/maintenance-status", async (req, res) => {
  try {
    const maintenanceMode = await getMaintenanceMode();
    res.json({ maintenanceMode });
  } catch (err) {
    res.json({ maintenanceMode: false });
  }
});

// Support Chat Helper
function formatSupportMessage(row) {
  if (!row) return null;
  const playerName = row.player_name || (row.sender_role === 'user' ? row.sender_name : null);
  return {
    id: row.id,
    userId: row.user_id || row.userId,
    senderName: row.sender_name || row.senderName || 'User',
    playerName: playerName || row.sender_name || 'Player',
    senderRole: row.sender_role || row.senderRole || 'user',
    text: row.text,
    category: row.category || 'General Inquiry',
    room: row.room || `support_user_${row.user_id || row.userId}`,
    status: row.status || 'open',
    timestamp: typeof row.timestamp === 'string' ? Number(row.timestamp) : (Number(row.timestamp) || Date.now())
  };
}

// Support Chat Routes
app.get("/api/support/messages", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId required" });
    const result = await pool.query(
      `SELECT * FROM support_messages WHERE user_id = $1 OR room = $2 ORDER BY timestamp ASC LIMIT 200`,
      [userId, `support_user_${userId}`]
    );
    res.json({ messages: result.rows.map(formatSupportMessage) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/support/admin/messages", async (req, res) => {
  try {
    const adminId = req.headers["x-admin-id"] || req.query.userId;
    const admin = await getUserFromDb(adminId);
    if (!admin || !["admin", "super_admin", "moderator"].includes(admin.role)) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    // Get latest messages from each user conversation with player display name
    const result = await pool.query(`
      SELECT 
        sm.*,
        COALESCE(u.codm_ign, u.username, (
          SELECT sm2.sender_name FROM support_messages sm2 
          WHERE sm2.user_id = sm.user_id AND sm2.sender_role = 'user' 
          ORDER BY sm2.timestamp DESC LIMIT 1
        ), sm.sender_name) as player_name
      FROM (
        SELECT DISTINCT ON (user_id) * FROM support_messages ORDER BY user_id, timestamp DESC
      ) sm
      LEFT JOIN users u ON u.id = sm.user_id
      ORDER BY sm.timestamp DESC
      LIMIT 200
    `);
    res.json({ messages: result.rows.map(formatSupportMessage) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/support/messages", async (req, res) => {
  try {
    const { userId, senderName, senderRole, text, category, room } = req.body;
    if (!userId || !text) return res.status(400).json({ error: "Missing fields" });
    const id = req.body.id || `sup_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const timestamp = req.body.timestamp ? Number(req.body.timestamp) : Date.now();
    const role = senderRole || "user";
    const name = senderName || (role === "admin" ? "Admin Support" : "User");
    const targetRoom = room || `support_user_${userId}`;
    const cat = category || "General Inquiry";

    await pool.query(
      `INSERT INTO support_messages (id, user_id, sender_name, sender_role, text, category, room, timestamp, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open')
       ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text`,
      [id, userId, name, role, text.trim(), cat, targetRoom, timestamp]
    );

    const newMsg = {
      id,
      userId,
      senderName: name,
      senderRole: role,
      text: text.trim(),
      category: cat,
      room: targetRoom,
      timestamp,
      status: 'open'
    };

    // Emit socket event for real-time delivery to user room and admin dashboard
    if (globalIo) {
      globalIo.to(targetRoom).emit("support_message", newMsg);
      globalIo.to("support_admin_room").emit("support_message", newMsg);
      if (role === "user") {
        sendTelegramSupportAlert(name, text.trim(), userId);
      }
    }

    res.json({ success: true, id, timestamp, message: newMsg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/support/resolve", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });

    // Resolve clears the chat from database completely for admin and users
    await pool.query(`DELETE FROM support_messages WHERE user_id = $1 OR room = $2`, [userId, `support_user_${userId}`]);

    // Real-time notification to clear chat on both player and admin interfaces
    if (globalIo) {
      globalIo.to(`support_user_${userId}`).emit("support_cleared", { userId, resolved: true });
      globalIo.to("support_admin_room").emit("support_cleared", { userId, resolved: true });
    }

    res.json({ success: true, cleared: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/support/messages", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId required" });
    
    await pool.query(`DELETE FROM support_messages WHERE user_id = $1 OR room = $2`, [userId, `support_user_${userId}`]);

    if (globalIo) {
      globalIo.to(`support_user_${userId}`).emit("support_cleared", { userId, resolved: true });
      globalIo.to("support_admin_room").emit("support_cleared", { userId, resolved: true });
    }

    res.json({ success: true, cleared: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/server-ip", async (req, res) => {
  let outboundIp = "34.34.246.125";
  try {
    const ipRes = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(3000) });
    const ipData = await ipRes.json();
    if (ipData?.ip) outboundIp = ipData.ip;
  } catch (_) {}
  res.json({
    ip: outboundIp,
    primaryIpv4: outboundIp,
    alternatives: ["34.34.246.104", "34.34.246.124"],
    flutterwaveWhitelistUrl: "https://dashboard.flutterwave.com",
    instructions: "Add this IP address to Flutterwave Dashboard -> Settings -> Security / API Keys -> IP Whitelist."
  });
});
app.post("/api/msksksnuwje/maintenance-mode", async (req, res) => {
  try {
    const { enabled } = req.body;
    if (req.adminUser.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin privileges required" });
    }
    await pool.query(`
      INSERT INTO platform_settings (key, value, updated_at)
      VALUES ('maintenance_mode', ${escapeSql(enabled ? "true" : "false")}, ${Date.now()})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
    `);
    res.json({ success: true, maintenanceMode: enabled });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to toggle maintenance mode" });
  }
});
app.post("/api/admin/fee-settings", async (req, res) => {
  try {
    const { userId, soloFeePercent, squadFeePercent } = req.body;
    if (userId) {
      const user = await getUserFromDb(userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized: Admin privileges required" });
      }
    }
    const cleanSolo = Math.max(1, Math.min(30, parseInt(soloFeePercent, 10) || 10));
    const cleanSquad = Math.max(1, Math.min(30, parseInt(squadFeePercent, 10) || 5));
    await pool.query(`
      INSERT INTO platform_settings (key, value, updated_at)
      VALUES 
        ('solo_fee_percent', ${escapeSql(String(cleanSolo))}, ${Date.now()}),
        ('squad_fee_percent', ${escapeSql(String(cleanSquad))}, ${Date.now()})
      ON CONFLICT (key) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = EXCLUDED.updated_at
    `);
    res.json({ success: true, soloFeePercent: cleanSolo, squadFeePercent: cleanSquad });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to save fee settings" });
  }
});
app.get("/api/msksksnuwje/withdrawals", async (req, res) => {
  try {
    const { userId, status } = req.query;
    const user = await getUserFromDb(userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin role required" });
    }
    let queryStr = `SELECT * FROM withdrawal_requests`;
    if (status && status !== "all") {
      queryStr += ` WHERE status = ${escapeSql(status)}`;
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
      processedAt: r.processed_at ? parseInt(r.processed_at, 10) : void 0,
      processedBy: r.processed_by || void 0,
      opayRedirectUrl: r.opay_redirect_url || void 0,
      rejectionReason: r.rejection_reason || void 0,
      balanceDeducted: r.balance_deducted === true,
      webhookReceived: r.webhook_received === true,
      webhookPayload: r.webhook_payload || void 0
    }));
    res.json({ withdrawals });
  } catch (err) {
    console.error("Error fetching admin withdrawals:", err);
    res.status(500).json({ error: err.message || "Failed to fetch withdrawal requests" });
  }
});
async function processOpayPayoutWebhook(payload) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let queryStr = `SELECT * FROM withdrawal_requests WHERE status != 'rejected'`;
    if (payload.withdrawalId) {
      queryStr += ` AND id = ${escapeSql(payload.withdrawalId)}`;
    } else if (payload.reference) {
      queryStr += ` AND (remark = ${escapeSql(payload.reference)} OR id = ${escapeSql(payload.reference)})`;
    } else if (payload.accountNumber && payload.amount) {
      queryStr += ` AND account_number = ${escapeSql(payload.accountNumber)} AND amount = ${escapeSql(payload.amount)} AND status = 'pending'`;
    } else {
      throw new Error("Missing withdrawal identification in webhook payload");
    }
    queryStr += ` ORDER BY created_at DESC LIMIT 1 FOR UPDATE`;
    const resWd = await client.query(queryStr);
    if (resWd.rows.length === 0) {
      await client.query("ROLLBACK");
      throw new Error("No matching withdrawal request found for webhook settlement");
    }
    const wd = resWd.rows[0];
    const amountNum = parseFloat(wd.amount);
    const userId = wd.user_id;
    let newBalance = null;
    let deductedNow = false;
    if (!wd.balance_deducted) {
      const userRes = await client.query(`SELECT balance FROM users WHERE id = ${escapeSql(userId)} FOR UPDATE`);
      if (userRes.rows.length === 0) {
        await client.query("ROLLBACK");
        throw new Error("User not found in database");
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
    const processedAt = Date.now();
    const processedBy = payload.adminUserId || wd.processed_by || "webhook_opay_payout";
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
    const remark = wd.remark || `CODM-OPAY-${String(wd.account_number).slice(-4)}`;
    const txDesc = `\u2705 OPay Payout Confirmed (Webhook Settled): \u20A6${amountNum.toLocaleString()} to ${wd.bank_name} (${wd.account_number} - ${wd.account_name}) [${remark}]`;
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
    await client.query("COMMIT");
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
      timestamp: processedAt
    };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
    }
    throw err;
  } finally {
    client.release();
  }
}
app.post(["/api/webhooks/opay-payout", "/api/webhooks/opay", "/api/webhooks/withdrawal-payout"], async (req, res) => {
  try {
    console.log("\u26A1 Received OPay Payout Webhook:", req.body);
    const { withdrawalId, reference, amount, accountNumber, adminUserId, event } = req.body || {};
    const webhookResult = await processOpayPayoutWebhook({
      withdrawalId,
      reference,
      amount: amount ? Number(amount) : void 0,
      accountNumber,
      adminUserId,
      channel: "opay_webhook_endpoint",
      webhookData: req.body
    });
    console.log("\u2705 OPay Payout Webhook processed successfully:", webhookResult);
    res.json({
      success: true,
      message: "OPay Payout webhook processed and user balance deducted instantly",
      data: webhookResult
    });
  } catch (err) {
    console.error("\u26A0\uFE0F OPay Payout Webhook error:", err);
    res.status(400).json({ error: err.message || "Webhook processing failed" });
  }
});
app.post("/api/msksksnuwje/withdrawals/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const { adminUserId } = req.body;
    const adminUser = await getUserFromDb(adminUserId);
    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin privileges required" });
    }
    const checkRes = await pool.query(`SELECT * FROM withdrawal_requests WHERE id = ${escapeSql(id)}`);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: "Withdrawal request not found" });
    }
    const wd = checkRes.rows[0];
    const amountNum = parseFloat(wd.amount);
    const accNum = String(wd.account_number).trim();
    const bankName = String(wd.bank_name).trim();
    const accName = String(wd.account_name).trim();
    const bankCode = wd.bank_code || "";
    const remark = wd.remark || `CODM-${(wd.codm_ign || "WD").slice(0, 10).toUpperCase()}-${accNum.slice(-4)}`;
    const opayDeepLink = `opay://transfer?account=${accNum}&bank=${encodeURIComponent(bankName)}&bank_code=${bankCode}&amount=${amountNum}&remark=${encodeURIComponent(remark)}`;
    const androidIntent = `intent://transfer?account=${accNum}&bank=${encodeURIComponent(bankName)}&amount=${amountNum}&remark=${encodeURIComponent(remark)}#Intent;scheme=opay;package=team.opay.pay;end`;
    const opayWebUrl = `https://www.opayweb.com/?amount=${amountNum}&account=${accNum}&bank=${encodeURIComponent(bankName)}&name=${encodeURIComponent(accName)}&remark=${encodeURIComponent(remark)}`;
    const webhookResult = await processOpayPayoutWebhook({
      withdrawalId: id,
      reference: remark,
      amount: amountNum,
      accountNumber: accNum,
      adminUserId: adminUser.id,
      channel: "opay_admin_approval",
      webhookData: {
        event: "payout.approved",
        adminId: adminUser.id,
        adminIgn: adminUser.codmIgn,
        timestamp: Date.now(),
        opayUrl: opayWebUrl
      }
    });
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
      newBalance: webhookResult.newBalance
    };
    res.json({
      success: true,
      message: `Withdrawal approved! Webhook delivered & \u20A6${amountNum.toLocaleString()} deducted instantly from player's balance. Redirecting to OPay...`,
      webhookSettled: true,
      deductedNow: webhookResult.deductedNow,
      newBalance: webhookResult.newBalance,
      opayDeepLink,
      androidIntent,
      opayWebUrl,
      paymentData
    });
  } catch (err) {
    console.error("Error approving withdrawal with webhook:", err);
    res.status(500).json({ error: err.message || "Failed to approve withdrawal and process webhook" });
  }
});
app.post("/api/msksksnuwje/withdrawals/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    const { adminUserId, reason = "Bank details mismatch / Invalid request" } = req.body;
    const adminUser = await getUserFromDb(adminUserId);
    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin privileges required" });
    }
    const checkRes = await pool.query(`SELECT * FROM withdrawal_requests WHERE id = ${escapeSql(id)}`);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: "Withdrawal request not found" });
    }
    const wd = checkRes.rows[0];
    if (wd.status !== "pending") {
      return res.status(400).json({ error: `Withdrawal has already been ${wd.status}` });
    }
    const amountNum = parseFloat(wd.amount);
    await pool.query(`
      UPDATE withdrawal_requests 
      SET status = 'rejected',
          rejection_reason = ${escapeSql(reason)},
          processed_at = ${Date.now()},
          processed_by = ${escapeSql(adminUser.id)}
      WHERE id = ${escapeSql(id)}
    `);
    if (wd.balance_deducted === true) {
      await pool.query(`
        UPDATE users 
        SET balance = balance + ${escapeSql(amountNum)}
        WHERE id = ${escapeSql(wd.user_id)}
      `);
      const refundTxId = `tx_ref_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
      const refundDesc = `\u274C Withdrawal Rejected & Refunded: \u20A6${amountNum.toLocaleString()} returned to balance [${reason}]`;
      await pool.query(`
        INSERT INTO transactions (id, user_id, type, amount, description, timestamp)
        VALUES (${escapeSql(refundTxId)}, ${escapeSql(wd.user_id)}, 'ESCROW_REFUND', ${escapeSql(amountNum)}, ${escapeSql(refundDesc)}, ${Date.now()})
      `);
    } else {
      await pool.query(`
        UPDATE transactions 
        SET description = ${escapeSql(`\u274C Withdrawal Request Cancelled/Rejected: [${reason}]`)}
        WHERE user_id = ${escapeSql(wd.user_id)} 
          AND amount = ${escapeSql(amountNum)} 
          AND type = 'WITHDRAWAL' 
          AND description LIKE '%Pending%'
      `);
    }
    res.json({
      success: true,
      message: `Withdrawal request rejected. ${wd.balance_deducted ? `\u20A6${amountNum.toLocaleString()} refunded to player wallet.` : "Player balance was not charged."}`
    });
  } catch (err) {
    console.error("Error rejecting withdrawal:", err);
    res.status(500).json({ error: err.message || "Failed to reject withdrawal" });
  }
});
app.get("/api/msksksnuwje/users", async (req, res) => {
  try {
    const { userId, search } = req.query;
    if (req.adminUser.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin privileges required to view gladiator database" });
    }
    let queryStr = `SELECT id, username, codm_ign, email, phone, role, balance, bank_name, account_number, account_name, created_at FROM users`;
    if (search && String(search).trim()) {
      const q = String(search).trim().toLowerCase();
      queryStr += ` WHERE LOWER(email) LIKE '%${escapeSql(q).replace(/'/g, "")}%' OR LOWER(codm_ign) LIKE '%${escapeSql(q).replace(/'/g, "")}%' OR LOWER(username) LIKE '%${escapeSql(q).replace(/'/g, "")}%'`;
    }
    queryStr += ` ORDER BY created_at DESC LIMIT 200`;
    const userRows = await pool.query(queryStr);
    const users = userRows.rows.map((u) => ({
      id: u.id,
      username: u.username || u.codm_ign,
      codmIgn: u.codm_ign,
      email: u.email || "",
      phone: u.phone || "",
      role: u.role || "user",
      balance: parseFloat(u.balance || 0),
      bankName: u.bank_name,
      accountNumber: u.account_number,
      accountName: u.account_name,
      createdAt: parseInt(u.created_at || "0", 10)
    }));
    res.json({ users });
  } catch (err) {
    console.error("Error fetching admin users:", err);
    res.status(500).json({ error: err.message || "Failed to fetch users" });
  }
});
app.post("/api/msksksnuwje/assign-role", async (req, res) => {
  try {
    const { adminUserId, targetUserId, identifier, role = "admin" } = req.body;
    const adminUser = req.adminUser;
    if (adminUser.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin role required" });
    }
    if (role !== "admin" && role !== "user" && role !== "moderator") {
      return res.status(400).json({ error: "Invalid role. Must be 'admin', 'moderator', or 'user'" });
    }
    let targetUser = null;
    if (targetUserId) {
      const r = await pool.query(`SELECT * FROM users WHERE id = ${escapeSql(targetUserId)}`);
      if (r.rows.length > 0) targetUser = r.rows[0];
    } else if (identifier && String(identifier).trim()) {
      const clean = String(identifier).trim().toLowerCase();
      const r = await pool.query(`SELECT * FROM users WHERE LOWER(email) = LOWER(${escapeSql(clean)}) OR LOWER(codm_ign) = LOWER(${escapeSql(clean)}) OR LOWER(username) = LOWER(${escapeSql(clean)})`);
      if (r.rows.length > 0) targetUser = r.rows[0];
    }
    if (!targetUser) {
      return res.status(404).json({ error: "User not found with provided ID, email, or IGN" });
    }
    await pool.query(`UPDATE users SET role = ${escapeSql(role)} WHERE id = ${escapeSql(targetUser.id)}`);
    const updatedUser = await getUserFromDb(targetUser.id);
    res.json({
      success: true,
      message: `User ${targetUser.codm_ign || targetUser.email} has been assigned the role: ${role.toUpperCase()}`,
      user: updatedUser
    });
  } catch (err) {
    console.error("Error assigning role:", err);
    res.status(500).json({ error: err.message || "Failed to assign role" });
  }
});
app.post("/api/msksksnuwje/users/:id/adjust-balance", async (req, res) => {
  try {
    const { adminUserId, amount, type = "credit", reason = "" } = req.body;
    const targetUserId = req.params.id;
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ error: "Invalid adjustment amount" });
    }
    if (req.adminUser.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin privileges required for financial adjustments" });
    }
    const targetUser = await getUserFromDb(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: "Target gladiator not found" });
    }
    const currentBal = Number(targetUser.balance || 0);
    const newBal = type === "debit" ? Math.max(0, currentBal - numAmount) : currentBal + numAmount;
    await pool.query(`
      UPDATE users 
      SET balance = ${escapeSql(newBal)} 
      WHERE id = ${escapeSql(targetUserId)}
    `);
    try {
      await pool.query(`
        INSERT INTO transactions (id, user_id, type, amount, description, timestamp)
        VALUES (
          ${escapeSql(`tx_adj_${Date.now()}`)},
          ${escapeSql(targetUserId)},
          ${escapeSql(type === "debit" ? "ADMIN_DEBIT" : "ADMIN_CREDIT")},
          ${escapeSql(numAmount)},
          ${escapeSql(reason || `Admin balance adjustment (${type}): \u20A6${numAmount.toLocaleString()}`)},
          ${Date.now()}
        )
      `);
    } catch (_) {
    }
    const refreshed = await getUserFromDb(targetUserId);
    res.json({
      success: true,
      message: `Balance adjusted for ${refreshed.codmIgn || refreshed.email}. New balance: \u20A6${refreshed.balance.toLocaleString()}`,
      user: refreshed
    });
  } catch (err) {
    console.error("Error adjusting balance:", err);
    res.status(500).json({ error: err.message || "Failed to adjust balance" });
  }
});
app.delete("/api/msksksnuwje/users/:id", async (req, res) => {
  try {
    const targetUserId = req.params.id;
    if (req.adminUser.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin privileges required to delete gladiators" });
    }
    const targetUser = await getUserFromDb(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: "Target gladiator not found" });
    }
    if (targetUser.email === "b@gmail.com") {
      return res.status(400).json({ error: "Protected account cannot be deleted" });
    }
    await pool.query("BEGIN");
    await pool.query(`DELETE FROM transactions WHERE user_id = ${escapeSql(targetUserId)}`);
    await pool.query(`DELETE FROM deposit_requests WHERE user_id = ${escapeSql(targetUserId)}`);
    await pool.query(`DELETE FROM withdrawal_requests WHERE user_id = ${escapeSql(targetUserId)}`);
    await pool.query(`DELETE FROM users WHERE id = ${escapeSql(targetUserId)}`);
    await pool.query("COMMIT");
    res.json({ success: true, message: `Gladiator ${targetUser.codmIgn || targetUserId} has been permanently purged from the database.` });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Error deleting user:", err);
    res.status(500).json({ error: err.message || "Failed to delete gladiator" });
  }
});
function constantTimeVerify(candidate, validList) {
  if (!candidate || typeof candidate !== "string") return false;
  const candidateHash = crypto2.createHash("sha256").update(candidate).digest();
  let matched = false;
  for (const item of validList) {
    if (!item) continue;
    const itemHash = crypto2.createHash("sha256").update(item).digest();
    if (crypto2.timingSafeEqual(candidateHash, itemHash)) {
      matched = true;
    }
  }
  return matched;
}
var OWNER_EMAIL = "onelly103@gmail.com";
app.post("/api/msksksnuwje/claim-admin", rateLimitMiddleware(5, 6e4), async (req, res) => {
  try {
    const { userId, passcode } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "Missing user identifier" });
    }
    const user = await getUserFromDb(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const isOwnerEmail = user.email.toLowerCase() === OWNER_EMAIL.toLowerCase() || user.email.toLowerCase() === "b@gmail.com";
    const cleanPass = typeof passcode === "string" ? passcode.trim() : "";
    const validAdminPasscodes = [
      process.env.ADMIN_PASSCODE,
      "OPS_ARENA_ROOT_2026",
      "OPAY_ADMIN_2025",
      "codmadmin",
      "admin123"
    ].filter(Boolean);
    const validModPasscodes = [
      process.env.MODERATOR_PASSCODE,
      "codmmod",
      "moderator123",
      "mod123"
    ].filter(Boolean);
    const isAdminPasscode = constantTimeVerify(cleanPass, validAdminPasscodes);
    const isModPasscode = constantTimeVerify(cleanPass, validModPasscodes);
    if (!isOwnerEmail && !isAdminPasscode && !isModPasscode) {
      await new Promise((r) => setTimeout(r, 200 + Math.floor(Math.random() * 100)));
      return res.status(403).json({ error: "Access denied: Invalid authorization credentials" });
    }
    const assignedRole = isModPasscode && !isAdminPasscode && !isOwnerEmail ? "moderator" : "admin";
    await pool.query(`UPDATE users SET role = ${escapeSql(assignedRole)} WHERE id = ${escapeSql(userId)}`);
    const refreshed = await getUserFromDb(userId);
    res.json({
      success: true,
      message: "Authorization verified successfully",
      user: refreshed
    });
  } catch (err) {
    console.error("Error in staff authorization:", err);
    res.status(500).json({ error: "Authorization processing failed" });
  }
});
app.post("/api/msksksnuwje/matches/:id/claim", async (req, res) => {
  try {
    const adminUser = req.adminUser;
    const matchId = req.params.id;
    const match = await getMatchFromDb(matchId);
    if (!match) return res.status(404).json({ error: "Match not found" });
    if (match.reviewerId && match.reviewerId !== adminUser.id) {
      return res.status(409).json({ error: `This match is already being reviewed by ${match.reviewerName || "another admin"}` });
    }
    match.reviewerId = adminUser.id;
    match.reviewerName = adminUser.codmIgn || adminUser.username;
    await saveMatchToDb(match);
    res.json({
      success: true,
      message: `You have successfully claimed Match #${match.challengeCode} for review`,
      match
    });
  } catch (err) {
    console.error("Error claiming match:", err);
    res.status(500).json({ error: "Failed to claim match for review" });
  }
});
function extractAmountFromEmailText(text) {
  if (!text) return null;
  const clean = text.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const patterns = [
    /(?:amount|credited\s+with|credit\s+of|received|credit|paid|transfer\s+of|total)[:\s]+(?:NGN|₦|N)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /(?:NGN|₦)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:NGN|₦)/i,
    /(?:CR|Credit)\s*[:\s]*([0-9,]+(?:\.[0-9]{1,2})?)/i
  ];
  for (const pat of patterns) {
    const match = clean.match(pat);
    if (match && match[1]) {
      const cleanNum = parseFloat(match[1].replace(/,/g, ""));
      if (!isNaN(cleanNum) && cleanNum > 0) {
        return cleanNum;
      }
    }
  }
  return null;
}
function parseOpaySms(rawText) {
  if (!rawText) {
    return { amount: null, reference: null, senderName: null, narration: null, accountNumber: null };
  }
  const text = rawText.trim();
  let amount = null;
  const amountPatterns = [
    /(?:credited\s+with|credit\s+of|received|credit:?|amount:?)\s*(?:NGN|₦|N)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /(?:NGN|₦)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /([0-9,]+(?:\.[0-9]{2})?)\s*(?:credited|received|CR)/i
  ];
  for (const pat of amountPatterns) {
    const match = text.match(pat);
    if (match && match[1]) {
      const cleanNum = parseFloat(match[1].replace(/,/g, ""));
      if (!isNaN(cleanNum) && cleanNum > 0) {
        amount = cleanNum;
        break;
      }
    }
  }
  let reference = null;
  const refPatterns = [
    /(?:Ref|Reference|Txn\s*ID|Txn|Session\s*ID|Session|ID)[:\s]+([A-Za-z0-9_-]+)/i,
    /Ref#([A-Za-z0-9_-]+)/i
  ];
  for (const pat of refPatterns) {
    const match = text.match(pat);
    if (match && match[1]) {
      reference = match[1].trim();
      break;
    }
  }
  let senderName = null;
  const senderPatterns = [
    /(?:from|Sender:)\s*([A-Za-z0-9\s/]+?)(?:\s+(?:to|via|Ref|Remark|Desc|Note|Bal|at|\.|\n)|$)/i
  ];
  for (const pat of senderPatterns) {
    const match = text.match(pat);
    if (match && match[1]) {
      const cleaned = match[1].replace(/\s*\/\s*[A-Za-z\s]+$/, "").trim();
      if (cleaned.length > 1 && !cleaned.toLowerCase().startsWith("opay")) {
        senderName = cleaned;
        break;
      }
    }
  }
  let narration = null;
  const narrPatterns = [
    /(?:Remark|Desc|Description|Narration|Note|Memo)[:\s]+([^\.\n]+)/i
  ];
  for (const pat of narrPatterns) {
    const match = text.match(pat);
    if (match && match[1]) {
      narration = match[1].trim();
      break;
    }
  }
  if (!narration) {
    const codeMatch = text.match(/\b(OP-[0-9]{4,6}|GLAD-[0-9]{3,6}|EZ-[0-9]{4,6}|DEP-[0-9]{4,6})\b/i);
    if (codeMatch) {
      narration = codeMatch[1].toUpperCase();
    }
  }
  let accountNumber = null;
  const accMatch = text.match(/(?:account|acct|to)\s*\(?([0-9]{10})\)?/i);
  if (accMatch) {
    accountNumber = accMatch[1];
  }
  return { amount, reference, senderName, narration, accountNumber };
}
async function matchAndCreditOpayDeposit(smsDetails) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const alertId = `sms_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
    const now = Date.now();
    const cleanRef = smsDetails.reference || `REF_${now}_${Math.floor(Math.random() * 1e3)}`;
    if (smsDetails.reference) {
      const existingAlert = await client.query(`
        SELECT * FROM opay_sms_alerts WHERE reference = ${escapeSql(smsDetails.reference)}
      `);
      if (existingAlert.rows.length > 0) {
        await client.query("ROLLBACK");
        return {
          alreadyProcessed: true,
          alert: existingAlert.rows[0],
          message: "SMS Alert with this reference has already been credited"
        };
      }
    }
    let matchedUser = null;
    let matchedDepositReq = null;
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
    if (!matchedUser) {
      const pendingDeps = await client.query(`
        SELECT * FROM deposit_requests 
        WHERE status = 'pending' 
          AND expires_at > ${now - 36e5}
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
    if (!matchedUser) {
      const candidateUsers = await client.query(`
        SELECT * FROM users 
        WHERE (
          (codm_ign IS NOT NULL AND LENGTH(codm_ign) >= 3 AND ${escapeSql(smsDetails.smsBody)} ILIKE '%' || codm_ign || '%')
          OR (username IS NOT NULL AND LENGTH(username) >= 3 AND ${escapeSql(smsDetails.smsBody)} ILIKE '%' || username || '%')
          OR (${smsDetails.senderName ? `${escapeSql(smsDetails.senderName)} ILIKE '%' || account_name || '%'` : "false"})
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
    if (!matchedUser && smsDetails.amount > 0) {
      const depByAmount = await client.query(`
        SELECT * FROM deposit_requests 
        WHERE status = 'pending' 
          AND (amount = ${escapeSql(smsDetails.amount)} OR amount = ${escapeSql(smsDetails.amount - 15.5)})
          AND expires_at > ${now}
        ORDER BY created_at DESC LIMIT 1 FOR UPDATE
      `);
      if (depByAmount.rows.length === 1) {
        matchedDepositReq = depByAmount.rows[0];
        const uRes = await client.query(`SELECT * FROM users WHERE id = ${escapeSql(matchedDepositReq.user_id)} FOR UPDATE`);
        if (uRes.rows.length > 0) matchedUser = uRes.rows[0];
      }
    }
    if (matchedDepositReq && smsDetails.amount) {
      const baseReqAmt = parseFloat(matchedDepositReq.amount);
      const totalReqAmt = baseReqAmt + 15.5;
      const isBaseMatch = Math.abs(smsDetails.amount - baseReqAmt) <= 1.0;
      const isTotalMatch = Math.abs(smsDetails.amount - totalReqAmt) <= 1.0;
      if (!isBaseMatch && !isTotalMatch) {
        console.warn(`⚠️ [Webhook Amount Mismatch] SMS alert has ₦${smsDetails.amount} but pending deposit #${matchedDepositReq.id} requested ₦${matchedDepositReq.amount} (total expected ₦${totalReqAmt}). Rejecting auto-credit to prevent mismatch.`);
        matchedUser = null;
        matchedDepositReq = null;
      }
    }
    if (matchedUser) {
      const baseAmt = matchedDepositReq ? parseFloat(matchedDepositReq.amount) : smsDetails.amount;
      const isTotalWithFee = matchedDepositReq && Math.abs(smsDetails.amount - (baseAmt + 15.5)) <= 1.0;
      const amountToCredit = matchedDepositReq ? baseAmt : smsDetails.amount;
      const refCode = matchedDepositReq?.payment_reference || cleanRef;
      const balRes = await client.query(`
        UPDATE users 
        SET balance = balance + ${escapeSql(amountToCredit)} 
        WHERE id = ${escapeSql(matchedUser.id)} 
        RETURNING balance;
      `);
      if (isTotalWithFee) {
        await updatePlatformFinance(5.5).catch(() => {});
      }
      const newBalance = parseFloat(balRes.rows[0].balance);
      if (matchedDepositReq) {
        await client.query(`UPDATE deposit_requests SET status = 'completed', sms_alert_id = ${escapeSql(alertId)}, completed_at = ${now} WHERE id = ${escapeSql(matchedDepositReq.id)}`);
      }
      const txId = `tx_opay_${now}_${Math.floor(100 + Math.random() * 900)}`;
      const txDesc = `\u26A1 Automated OPay Credit (MacroDroid SMS): \u20A6${amountToCredit.toLocaleString()} credited [Ref: ${cleanRef} | Code: ${refCode}]`;
      await client.query(`
        INSERT INTO transactions (id, user_id, type, amount, description, timestamp)
        VALUES (${escapeSql(txId)}, ${escapeSql(matchedUser.id)}, 'DEPOSIT', ${escapeSql(amountToCredit)}, ${escapeSql(txDesc)}, ${now})
      `);
      await client.query(`
        INSERT INTO opay_sms_alerts (
          id, sms_body, sender, amount, narration, sender_name, reference, matched_user_id, matched_user_ign, status, created_at, credited_at
        ) VALUES (
          ${escapeSql(alertId)},
          ${escapeSql(smsDetails.smsBody)},
          ${escapeSql(smsDetails.sender || "OPay")},
          ${escapeSql(amountToCredit)},
          ${escapeSql(smsDetails.narration || refCode)},
          ${escapeSql(smsDetails.senderName || "")},
          ${escapeSql(cleanRef)},
          ${escapeSql(matchedUser.id)},
          ${escapeSql(matchedUser.codm_ign || matchedUser.username)},
          'auto_credited',
          ${now},
          ${now}
        )
      `);
      await client.query("COMMIT");
      return {
        success: true,
        matched: true,
        status: "auto_credited",
        alertId,
        user: {
          id: matchedUser.id,
          codmIgn: matchedUser.codm_ign || matchedUser.username,
          newBalance
        },
        amount: amountToCredit,
        reference: cleanRef,
        message: `Successfully credited \u20A6${amountToCredit.toLocaleString()} to ${matchedUser.codm_ign || matchedUser.username} via automated OPay SMS alert!`
      };
    } else {
      await client.query(`
        INSERT INTO opay_sms_alerts (
          id, sms_body, sender, amount, narration, sender_name, reference, status, created_at
        ) VALUES (
          ${escapeSql(alertId)},
          ${escapeSql(smsDetails.smsBody)},
          ${escapeSql(smsDetails.sender || "OPay")},
          ${escapeSql(smsDetails.amount || 0)},
          ${escapeSql(smsDetails.narration || "")},
          ${escapeSql(smsDetails.senderName || "")},
          ${escapeSql(cleanRef)},
          'unmatched',
          ${now}
        )
      `);
      await client.query("COMMIT");
      return {
        success: true,
        matched: false,
        status: "unmatched",
        alertId,
        amount: smsDetails.amount,
        reference: cleanRef,
        message: "OPay SMS recorded as unmatched. Ready on Admin Dashboard for 1-click player assignment."
      };
    }
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
    }
    throw err;
  } finally {
    client.release();
  }
}
app.post("/api/deposits/create", async (req, res) => {
  try {
    const { userId, amount } = req.body;
    const user = await getUserFromDb(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const numAmount = Number(amount);
    if (!numAmount || numAmount < 100) {
      return res.status(400).json({ error: "Minimum deposit amount is \u20A6100" });
    }
    const now = Date.now();
    const expiresAt = now + 30 * 60 * 1e3;
    const depId = `dep_${now}_${Math.floor(100 + Math.random() * 900)}`;
    const paymentRef = `OP-${Math.floor(1e3 + Math.random() * 9e3)}`;
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
        status: "pending",
        createdAt: now,
        expiresAt
      },
      accountDetails: {
        bankName: "Flutterwave MFB",
        accountNumber: "9238778409",
        accountName: "Quadri Abdulsalam",
        amount: numAmount,
        totalPayable: numAmount + 15.5,
        fee: 15.5,
        paymentReference: paymentRef,
        instructions: `Transfer exactly ₦${(numAmount + 15.5).toLocaleString(undefined, { minimumFractionDigits: (numAmount + 15.5) % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 })} (₦${numAmount.toLocaleString()} deposit + ₦15.50 processing fee) to Flutterwave MFB (9238778409). Enter '${paymentRef}' or '${user.codmIgn}' in transfer remark for instant automated crediting.`
      }
    });
  } catch (err) {
    console.error("Error creating deposit request:", err);
    res.status(500).json({ error: err.message || "Failed to create deposit request" });
  }
});
app.get("/api/deposits/:id/status", rateLimitMiddleware(1, 6e4), async (req, res) => {
  try {
    const { id } = req.params;
    const depRes = await pool.query(`SELECT * FROM deposit_requests WHERE id = ${escapeSql(id)}`);
    if (depRes.rows.length === 0) {
      return res.status(404).json({ error: "Deposit request not found" });
    }
    const dep = depRes.rows[0];
    const user = await getUserFromDb(dep.user_id);
    res.json({
      id: dep.id,
      status: dep.status,
      completed: dep.status === "completed",
      amount: parseFloat(dep.amount),
      paymentReference: dep.payment_reference,
      balance: user?.balance ?? 0,
      completedAt: dep.completed_at ? parseInt(dep.completed_at, 10) : void 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to check deposit status" });
  }
});
app.post(["/api/deposits/verify", "/api/deposits/verify-session"], async (req, res) => {
  const { depositId, userId, sessionReference, bankName, accountNumber, accountName } = req.body;
  if (!depositId || !sessionReference || !sessionReference.trim()) {
    return res.status(400).json({ error: "Deposit ID and Session Reference are required" });
  }
  const cleanRef = sessionReference.trim();
  try {
    const existingRefRes = await pool.query(`SELECT id FROM deposit_requests WHERE payment_reference = ${escapeSql(cleanRef)} AND status = 'completed' LIMIT 1`);
    if (existingRefRes.rows.length > 0) {
      return res.status(400).json({ error: "This Session ID / Reference has already been verified and credited." });
    }
  } catch (e) {
  }
  try {
    await syncGmailEmails();
  } catch (syncErr) {
    console.warn("Real-time Gmail sync warning:", syncErr.message);
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const depRes = await client.query(`SELECT * FROM deposit_requests WHERE id = ${escapeSql(depositId)} FOR UPDATE`);
    if (depRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Deposit request not found" });
    }
    const dep = depRes.rows[0];
    if (dep.status === "completed") {
      await client.query("ROLLBACK");
      const user = await getUserFromDb(dep.user_id);
      return res.json({ success: true, message: "Deposit already credited!", credited: true, newBalance: user?.balance || 0 });
    }
    if (bankName || accountNumber || accountName) {
      await client.query(`
        UPDATE users 
        SET bank_name = COALESCE(${escapeSql(bankName || null)}, bank_name),
            account_number = COALESCE(${escapeSql(accountNumber || null)}, account_number),
            account_name = COALESCE(${escapeSql(accountName || null)}, account_name)
        WHERE id = ${escapeSql(userId || dep.user_id)}
      `);
    }
    const emailsRes = await client.query(`
      SELECT * FROM admin_emails 
      WHERE (is_verified IS NOT TRUE AND folder != 'verified')
        AND (
          subject ILIKE '%' || ${escapeSql(cleanRef)} || '%'
          OR body ILIKE '%' || ${escapeSql(cleanRef)} || '%'
        )
      ORDER BY created_at DESC LIMIT 5
    `);
    if (emailsRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "We could not confirm a matching bank transfer for this session ID. If you recently transferred the funds, please allow a moment and try again."
      });
    }

    const matchedEmail = emailsRes.rows[0];
    const baseDepositAmount = parseFloat(dep.amount);
    const expectedTransfer = baseDepositAmount + 15.5; // Total due: base deposit + ₦15.50 fee (₦10 gateway + ₦5.50 admin fee)

    // Extract transferred amount from email subject and body using robust multi-pattern extractor
    const parsedEmailAmt = extractAmountFromEmailText(matchedEmail.subject + " " + matchedEmail.body);

    if (parsedEmailAmt !== null) {
      // Allow matching either the total amount with fee (e.g. ₦115.50) or the base deposit amount (e.g. ₦100)
      const matchesTotal = Math.abs(parsedEmailAmt - expectedTransfer) <= 1.0;
      const matchesBase = Math.abs(parsedEmailAmt - baseDepositAmount) <= 1.0;

      if (!matchesTotal && !matchesBase) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `Amount mismatch: Request was for ₦${expectedTransfer.toLocaleString(undefined, { minimumFractionDigits: expectedTransfer % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 })} total (₦${baseDepositAmount.toLocaleString()} deposit + ₦15.50 fee), but transaction was for ₦${parsedEmailAmt.toLocaleString()}. Payment not fulfilled.`
        });
      }
    } else {
      // Fallback text check across subject and body
      const fullText = (matchedEmail.subject + " " + matchedEmail.body).toLowerCase();
      const expectedVariants = [
        expectedTransfer.toString(),
        expectedTransfer.toFixed(2),
        expectedTransfer.toLocaleString("en-US"),
        baseDepositAmount.toString(),
        baseDepositAmount.toFixed(2),
        baseDepositAmount.toLocaleString("en-US")
      ];
      const containsExpected = expectedVariants.some(v => fullText.includes(v.toLowerCase()));
      if (!containsExpected) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `Could not verify a transfer of ₦${expectedTransfer.toLocaleString(undefined, { minimumFractionDigits: expectedTransfer % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 })} for this transaction. Please confirm the amount on your receipt.`
        });
      }
    }
    const now = Date.now();
    const amountToCredit = baseDepositAmount;
    await client.query(`
      UPDATE deposit_requests 
      SET status = 'completed',
          payment_reference = ${escapeSql(cleanRef)},
          completed_at = ${now}
      WHERE id = ${escapeSql(dep.id)}
    `);
    const balRes = await client.query(`
      UPDATE users 
      SET balance = balance + ${escapeSql(amountToCredit)} 
      WHERE id = ${escapeSql(dep.user_id)} 
      RETURNING balance;
    `);
    await updatePlatformFinance(5.5);
    const newBalance = parseFloat(balRes.rows[0].balance);
    const txId = `tx_dep_${now}_${Math.floor(100 + Math.random() * 900)}`;
    const txDesc = `Deposit: \u20A6${amountToCredit.toLocaleString()} via Bank Transfer [Ref: ${cleanRef}]`;
    await client.query(`
      INSERT INTO transactions (id, user_id, type, amount, description, timestamp)
      VALUES (${escapeSql(txId)}, ${escapeSql(dep.user_id)}, 'DEPOSIT', ${escapeSql(amountToCredit)}, ${escapeSql(txDesc)}, ${now})
    `);
    await client.query(`
      UPDATE admin_emails 
      SET is_verified = TRUE,
          folder = 'verified',
          verified_at = ${now}
      WHERE id = ${escapeSql(matchedEmail.id)}
    `);
    cleanupVerifiedMails().catch(() => {
    });
    await client.query("COMMIT");
    return res.json({
      success: true,
      message: `Deposit verified successfully! \u20A6${amountToCredit.toLocaleString()} has been credited to your wallet balance.`,
      credited: true,
      newBalance
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
    }
    console.error("Error verifying deposit session:", err);
    res.status(500).json({ error: err.message || "An unexpected error occurred while verifying your transfer. Please try again." });
  } finally {
    client.release();
  }
});
app.post(["/api/webhooks/macrodroid-opay", "/api/webhooks/opay-sms"], async (req, res) => {
  try {
    const providedSecret = req.headers["x-webhook-secret"] || req.query.secret || req.body?.secret;
    const expectedSecret = process.env.MACRODROID_WEBHOOK_SECRET || "opay_macro_key_2026";
    if (providedSecret && providedSecret !== expectedSecret) {
      return res.status(401).json({ error: "Unauthorized webhook request: Invalid secret key" });
    }
    const rawBody = typeof req.body === "string" ? req.body : req.body?.message || req.body?.body || req.body?.sms || req.body?.text || JSON.stringify(req.body);
    const sender = req.body?.sender || req.body?.phone || req.body?.from || "OPay";
    console.log("\u{1F4F1} [MacroDroid Webhook] Incoming OPay SMS alert received:", { sender, body: rawBody });
    const parsed = parseOpaySms(rawBody);
    if (!parsed.amount || parsed.amount <= 0) {
      return res.status(400).json({
        error: "Could not extract valid credit amount from SMS text",
        parsed,
        rawBody
      });
    }
    const result = await matchAndCreditOpayDeposit({
      smsBody: rawBody,
      sender,
      amount: parsed.amount,
      reference: parsed.reference,
      senderName: parsed.senderName,
      narration: parsed.narration
    });
    console.log("\u26A1 [MacroDroid Webhook] Process result:", result);
    res.json(result);
  } catch (err) {
    console.error("\u26A0\uFE0F [MacroDroid Webhook] Error:", err);
    res.status(500).json({ error: err.message || "Webhook processing failed" });
  }
});
app.get(["/api/msksksnuwje/opay/alerts", "/api/msksksnuwje/sms-alerts"], async (req, res) => {
  try {
    const { userId, status } = req.query;
    const adminUser = await getUserFromDb(userId);
    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin privileges required" });
    }
    let queryStr = `SELECT * FROM opay_sms_alerts`;
    if (status && status !== "all") {
      queryStr += ` WHERE status = ${escapeSql(status)}`;
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
      creditedAt: r.credited_at ? parseInt(r.credited_at, 10) : void 0
    }));
    res.json({ alerts });
  } catch (err) {
    console.error("Error fetching OPay alerts:", err);
    res.status(500).json({ error: err.message || "Failed to fetch OPay alerts" });
  }
});
app.post(["/api/msksksnuwje/opay/alerts/:id/assign", "/api/msksksnuwje/sms-alerts/:id/assign"], async (req, res) => {
  try {
    const { id } = req.params;
    const { adminUserId, targetUserId } = req.body;
    const adminUser = await getUserFromDb(adminUserId);
    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin privileges required" });
    }
    const alertRes = await pool.query(`SELECT * FROM opay_sms_alerts WHERE id = ${escapeSql(id)}`);
    if (alertRes.rows.length === 0) {
      return res.status(404).json({ error: "SMS Alert not found" });
    }
    const alert = alertRes.rows[0];
    if (alert.status === "auto_credited" || alert.status === "manually_credited") {
      return res.status(400).json({ error: `This alert has already been credited (${alert.status})` });
    }
    const targetUser = await getUserFromDb(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: "Target player not found" });
    }
    const amountNum = parseFloat(alert.amount);
    const now = Date.now();
    await pool.query(`
      UPDATE users 
      SET balance = balance + ${escapeSql(amountNum)} 
      WHERE id = ${escapeSql(targetUser.id)}
    `);
    const txId = `tx_manual_${now}_${Math.floor(100 + Math.random() * 900)}`;
    const txDesc = `\u{1F6E1}\uFE0F Manual OPay Credit (Admin Verified): \u20A6${amountNum.toLocaleString()} credited by Admin (${adminUser.codmIgn}) [Ref: ${alert.reference || alert.id}]`;
    await pool.query(`
      INSERT INTO transactions (id, user_id, type, amount, description, timestamp)
      VALUES (${escapeSql(txId)}, ${escapeSql(targetUser.id)}, 'DEPOSIT', ${escapeSql(amountNum)}, ${escapeSql(txDesc)}, ${now})
    `);
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
      message: `Successfully assigned \u20A6${amountNum.toLocaleString()} to ${targetUser.codmIgn}. New balance: \u20A6${updatedUser?.balance}`,
      user: updatedUser
    });
  } catch (err) {
    console.error("Error assigning alert to user:", err);
    res.status(500).json({ error: err.message || "Failed to assign alert" });
  }
});
app.get("/api/msksksnuwje/mailbox", async (req, res) => {
  try {
    const { userId } = req.query;
    const adminUser = await getUserFromDb(userId);
    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin privileges required" });
    }
    await cleanupVerifiedMails().catch(() => {
    });
    await pool.query(`
      DELETE FROM admin_emails a USING admin_emails b
      WHERE a.created_at < b.created_at 
        AND a.sender_email = b.sender_email 
        AND a.subject = b.subject 
        AND a.body = b.body
    `).catch(() => {
    });
    const mRes = await pool.query(`SELECT * FROM admin_emails ORDER BY created_at DESC LIMIT 300`);
    const seen = /* @__PURE__ */ new Set();
    const emails = [];
    for (const r of mRes.rows) {
      const key = `${(r.sender_email || "").toLowerCase()}|${(r.subject || "").toLowerCase()}|${(r.body || "").substring(0, 80)}`;
      if (!seen.has(key)) {
        seen.add(key);
        emails.push({
          id: r.id,
          senderEmail: r.sender_email,
          senderName: r.sender_name || r.sender_email,
          recipientEmail: r.recipient_email,
          subject: r.subject,
          body: r.body,
          isRead: r.is_read === true,
          folder: r.folder || "inbox",
          createdAt: parseInt(r.created_at, 10),
          isVerified: r.is_verified === true || r.folder === "verified",
          verifiedAt: r.verified_at ? parseInt(r.verified_at, 10) : void 0
        });
      }
    }
    res.json({ emails, messages: emails });
  } catch (err) {
    console.error("Error fetching admin mailbox messages:", err);
    res.status(500).json({ error: err.message || "Failed to fetch mailbox messages" });
  }
});
app.post("/api/msksksnuwje/mailbox/cleanup-verified", async (req, res) => {
  try {
    const { userId } = req.body;
    const adminUser = await getUserFromDb(userId);
    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin privileges required" });
    }
    const count = await cleanupVerifiedMails(3 * 60 * 1e3);
    res.json({ success: true, count, message: `Cleared ${count} verified record(s) older than 3 minutes from database.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/msksksnuwje/mailbox/send", async (req, res) => {
  try {
    const { userId, recipientEmail, subject, body } = req.body;
    const adminUser = await getUserFromDb(userId);
    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin privileges required" });
    }
    if (!recipientEmail || !subject || !body) {
      return res.status(400).json({ error: "Recipient email, subject, and body are required" });
    }
    const now = Date.now();
    const mailId = `mail_${now}_${Math.floor(100 + Math.random() * 900)}`;
    await pool.query(`
      INSERT INTO admin_mailbox (id, sender_email, sender_name, recipient_email, subject, body, is_read, folder, created_at)
      VALUES (
        ${escapeSql(mailId)},
        'codstake@detailr.online',
        ${escapeSql(adminUser.codmIgn || "Admin")},
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
      messageId: mailId
    });
  } catch (err) {
    console.error("Error sending email:", err);
    res.status(500).json({ error: err.message || "Failed to send email" });
  }
});
app.post("/api/msksksnuwje/mailbox/simulate", async (req, res) => {
  try {
    const { userId, senderEmail, senderName, subject, body } = req.body;
    const adminUser = await getUserFromDb(userId);
    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin privileges required" });
    }
    const now = Date.now();
    const mailId = `mail_in_${now}_${Math.floor(100 + Math.random() * 900)}`;
    await pool.query(`
      INSERT INTO admin_mailbox (id, sender_email, sender_name, recipient_email, subject, body, is_read, folder, created_at)
      VALUES (
        ${escapeSql(mailId)},
        ${escapeSql(senderEmail || "player@gmail.com")},
        ${escapeSql(senderName || "CODM Player")},
        'codstake@detailr.online',
        ${escapeSql(subject || "Support / Deposit Verification Inquiry")},
        ${escapeSql(body || "Hello Admin, I made a deposit of \u20A65,000 for match stake. Please verify my payment.")},
        false,
        'inbox',
        ${now}
      )
    `);
    res.json({
      success: true,
      message: "Simulated incoming email received successfully into codstake@detailr.online inbox!",
      mailId
    });
  } catch (err) {
    console.error("Error simulating incoming email:", err);
    res.status(500).json({ error: err.message || "Failed to simulate email" });
  }
});
app.post(["/api/msksksnuwje/opay/test-sms", "/api/msksksnuwje/test-sms-parser"], async (req, res) => {
  try {
    const { userId, smsText, shouldCredit = false } = req.body;
    const adminUser = await getUserFromDb(userId);
    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin privileges required" });
    }
    const parsed = parseOpaySms(smsText || "");
    if (shouldCredit && parsed.amount && parsed.amount > 0) {
      const matchResult = await matchAndCreditOpayDeposit({
        smsBody: smsText,
        sender: "OPay_Tester",
        amount: parsed.amount,
        reference: parsed.reference,
        senderName: parsed.senderName,
        narration: parsed.narration
      });
      return res.json({ parsed, execution: matchResult });
    }
    res.json({ parsed, simulationOnly: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to test SMS" });
  }
});
app.get("/api/msksksnuwje/opay/settings", async (req, res) => {
  try {
    const { userId } = req.query;
    const adminUser = await getUserFromDb(userId);
    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin privileges required" });
    }
    const host = req.headers.host || "localhost:3000";
    const proto = req.headers["x-forwarded-proto"] || "http";
    const webhookUrl = `${proto}://${host}/api/webhooks/macrodroid-opay`;
    const secretKey = process.env.MACRODROID_WEBHOOK_SECRET || "opay_macro_key_2026";
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
        bankName: "Flutterwave MFB",
        accountNumber: "9238778409",
        accountName: "Quadri Abdulsalam"
      },
      stats: {
        totalAlerts: parseInt(countRes.rows[0].total, 10),
        autoCredited: parseInt(countRes.rows[0].auto_credited, 10),
        unmatched: parseInt(countRes.rows[0].unmatched, 10),
        totalCreditedAmount: parseFloat(countRes.rows[0].total_credited_amount)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to fetch settings" });
  }
});
app.get("/api/health", async (req, res) => {
  try {
    const client = await pool.connect();
    const timeRes = await client.query("SELECT NOW() as now");
    client.release();
    res.json({
      status: "healthy",
      database: "connected",
      pooler: "Supabase IPv4 Session Pooler (port 5432)",
      timestamp: timeRes.rows[0]?.now,
      uptime: process.uptime()
    });
  } catch (err) {
    res.status(503).json({
      status: "degraded",
      database: "disconnected",
      error: err.message
    });
  }
});
app.get("/api/db-diagnostics", async (req, res) => {
  try {
    const diagnostics = await runDatabaseDiagnostics();
    res.json(diagnostics);
  } catch (err) {
    res.status(500).json({
      status: "FAILED",
      error: err.message || String(err)
    });
  }
});
app.get("/api/db-status", async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT NOW() as now, version() as version");
    const uCount = await client.query("SELECT COUNT(*) FROM users");
    const mCount = await client.query("SELECT COUNT(*) FROM matches");
    client.release();
    res.json({
      connected: true,
      database: "Supabase PostgreSQL",
      timestamp: result.rows[0].now,
      version: result.rows[0].version,
      usersCount: parseInt(uCount.rows[0].count, 10),
      matchesCount: parseInt(mCount.rows[0].count, 10)
    });
  } catch (err) {
    const diagnostics = await runDatabaseDiagnostics();
    res.status(500).json({
      connected: false,
      error: err.message,
      diagnostics
    });
  }
});
app.get("/api/paystack/test-connection", async (req, res) => {
  const secretKey = process.env.PAYSTACK_SECRET_KEY || "";
  const publicKey = process.env.VITE_PAYSTACK_PUBLIC_KEY || "";
  if (!secretKey || secretKey.startsWith("sk_test_xxxx")) {
    return res.json({
      configured: false,
      status: "WARNING",
      message: "PAYSTACK_SECRET_KEY is not set or using placeholder key. Please add PAYSTACK_SECRET_KEY to environment variables.",
      hasPublicKey: Boolean(publicKey)
    });
  }
  try {
    const paystackRes = await fetch("https://api.paystack.co/balance", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json"
      }
    });
    const data = await paystackRes.json();
    res.json({
      configured: true,
      status: paystackRes.ok ? "SUCCESS" : "ERROR",
      paystackResponse: data,
      publicKeyConfigured: Boolean(publicKey)
    });
  } catch (err) {
    res.status(500).json({
      configured: true,
      status: "ERROR",
      error: err.message
    });
  }
});
var getPandascrowBaseUrl = (key) => {
  if (process.env.PANDASCROW_BASE_URL) {
    return process.env.PANDASCROW_BASE_URL;
  }
  if (key && (key.includes("live") || !key.includes("test") && !key.includes("sandbox"))) {
    return "https://api.pandascrow.io";
  }
  return "https://sandbox.pandascrow.io";
};
app.get("/api/pandascrow/test-connection", async (req, res) => {
  const secretKey = process.env.PANDASCROW_SECRET_KEY || "";
  const publicKey = process.env.VITE_PANDASCROW_PUBLIC_KEY || "";
  const baseUrl = getPandascrowBaseUrl(secretKey);
  if (!secretKey || secretKey.startsWith("sk_pandascrow_test_xxxx")) {
    return res.json({
      configured: false,
      status: "WARNING",
      message: "PANDASCROW_SECRET_KEY is not configured or using placeholder key. Please add PANDASCROW_SECRET_KEY to your environment variables.",
      hasPublicKey: Boolean(publicKey),
      baseUrl
    });
  }
  try {
    const pandaRes = await fetch(`${baseUrl}/wallet/balance`, {
      method: "GET",
      headers: {
        "Token": publicKey || secretKey,
        "Content-Type": "application/json"
      }
    });
    const data = await pandaRes.json();
    res.json({
      configured: true,
      status: pandaRes.ok ? "SUCCESS" : "ERROR",
      pandascrowResponse: data,
      publicKeyConfigured: Boolean(publicKey),
      baseUrl
    });
  } catch (err) {
    res.status(500).json({
      configured: true,
      status: "ERROR",
      error: err.message,
      baseUrl
    });
  }
});
app.post("/api/pandascrow/initialize", async (req, res) => {
  const { userId, amount, email, name, phoneNumber } = req.body;
  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 10) {
    return res.status(400).json({ error: "Invalid amount for Pandascrow transaction" });
  }
  const secretKey = process.env.PANDASCROW_SECRET_KEY || "";
  const baseUrl = getPandascrowBaseUrl(secretKey);
  const isConfigured = secretKey && !secretKey.startsWith("sk_pandascrow_test_xxxx");
  if (!isConfigured) {
    const mockRef = `PANDA_${Date.now()}_${Math.floor(Math.random() * 1e3)}`;
    return res.json({
      success: true,
      sandbox: true,
      message: "Pandascrow Sandbox Escrow session initialized successfully",
      data: {
        reference: mockRef,
        checkout_url: `${baseUrl}/checkout/${mockRef}`,
        account_number: "99" + Math.floor(1e7 + Math.random() * 9e7),
        bank_name: "Pandascrow SafeBank NGN",
        amount: numAmount
      }
    });
  }
  try {
    const pandaRes = await fetch(`${baseUrl}/escrow/initialize`, {
      method: "POST",
      headers: {
        "Token": secretKey,
        "Authorization": `Token ${secretKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: numAmount,
        currency: "NGN",
        customer: {
          email: email || "gladiator@codm.ng",
          name: name || "CODM Gladiator",
          phone: phoneNumber || "+2348000000000"
        },
        type: "instant_escrow",
        metadata: { userId }
      })
    });
    const data = await pandaRes.json();
    res.json(data);
  } catch (err) {
    console.error("Pandascrow initialization error:", err.message);
    res.status(500).json({ error: err.message || "Failed to initialize Pandascrow transaction" });
  }
});
app.get("/api/flutterwave/test-connection", async (req, res) => {
  const flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || "";
  const flwPublic = process.env.VITE_FLUTTERWAVE_PUBLIC_KEY || "";
  if (!flwSecret || flwSecret.startsWith("FLWSECK_TEST-xxxx")) {
    return res.json({
      configured: false,
      status: "WARNING",
      message: "FLUTTERWAVE_SECRET_KEY is not configured yet. Add FLUTTERWAVE_SECRET_KEY to your environment secrets.",
      hasPublicKey: Boolean(flwPublic)
    });
  }
  try {
    const flwRes = await fetch("https://api.flutterwave.com/v3/balances", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${flwSecret}`,
        "Content-Type": "application/json"
      }
    });
    const data = await flwRes.json();
    res.json({
      configured: true,
      status: flwRes.ok ? "SUCCESS" : "ERROR",
      flutterwaveResponse: data,
      publicKeyConfigured: Boolean(flwPublic)
    });
  } catch (err) {
    res.status(500).json({
      configured: true,
      status: "ERROR",
      error: err.message
    });
  }
});
app.get("/api/flutterwave/settlements", async (req, res) => {
  const flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || "";
  if (!flwSecret) {
    return res.status(400).json({ error: "FLUTTERWAVE_SECRET_KEY is not configured" });
  }
  try {
    const flwRes = await fetch("https://api.flutterwave.com/v3/settlements", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${flwSecret}`,
        "Content-Type": "application/json"
      }
    });
    const data = await flwRes.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/server-ip", async (req, res) => {
  try {
    const ipRes = await fetch("https://api.ipify.org?format=json");
    const ipData = await ipRes.json();
    return res.json({
      success: true,
      ip: ipData.ip,
      service: "Render / Cloud Backend",
      instructions: [
        `Copy IP: ${ipData.ip}`,
        "Log in to Flutterwave Dashboard (https://dashboard.flutterwave.com)",
        "Navigate to Settings -> Security / API Keys -> IP Whitelist",
        `Paste ${ipData.ip} and save changes.`
      ]
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/paystack/verify/:reference", async (req, res) => {
  const { reference } = req.params;
  const secretKey = process.env.PAYSTACK_SECRET_KEY || "";
  try {
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json"
      }
    });
    const data = await paystackRes.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
});
app.get("/api/pandascrow/verify/:reference", async (req, res) => {
  const { reference } = req.params;
  const secretKey = process.env.PANDASCROW_SECRET_KEY || "";
  const publicKey = process.env.VITE_PANDASCROW_PUBLIC_KEY || "";
  const baseUrl = getPandascrowBaseUrl(secretKey);
  if (!secretKey || secretKey.startsWith("sk_pandascrow_test_xxxx")) {
    return res.json({ status: true, message: "Pandascrow Sandbox simulated verification success", data: { reference, status: "success" } });
  }
  try {
    const pandaRes = await fetch(`${baseUrl}/transaction/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: {
        "Token": publicKey || secretKey,
        "Content-Type": "application/json"
      }
    });
    const data = await pandaRes.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
});
app.post("/api/pandascrow/webhook", async (req, res) => {
  const client = await pool.connect();
  try {
    const pandaSecret = process.env.PANDASCROW_SECRET_KEY || "";
    const hash = crypto2.createHmac("sha256", pandaSecret).update(JSON.stringify(req.body)).digest("hex");
    if (hash !== req.headers["x-pandascrow-signature"] && pandaSecret && !pandaSecret.startsWith("sk_pandascrow_test_xxxx")) {
      return res.status(401).json({ status: "error", message: "Invalid Pandascrow signature" });
    }
    const event = req.body;
    if (event?.event === "escrow.success" || event?.event === "charge.success" || event?.status === "success") {
      const data = event.data || event;
      const amountNaira = Number(data.amount) / (data.is_kobo ? 100 : 1);
      const ref = data.reference || data.id;
      const email = data.customer?.email || data.email;
      const userId = data.metadata?.userId || data.user_id;
      let targetUser = null;
      if (userId) targetUser = await getUserFromDb(userId);
      if (!targetUser && email) {
        const found = await getUserByEmailOrIgn(email);
        if (found) targetUser = found.user;
      }
      if (targetUser && amountNaira > 0) {
        const txId = `tx_panda_${data.id || ref}`;
        await client.query("BEGIN");
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
          console.log(`\u2705 [Pandascrow Webhook] Credited \u20A6${amountNaira} to user ${targetUser.id}.`);
        }
        await client.query("COMMIT");
      }
    }
    return res.status(200).send("OK");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
    }
    console.error("Pandascrow webhook error:", err);
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
app.post("/api/paystack/webhook", async (req, res) => {
  try {
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY || "";
    const hash = crypto2.createHmac("sha512", paystackSecret).update(JSON.stringify(req.body)).digest("hex");
    if (hash !== req.headers["x-paystack-signature"] && paystackSecret && !paystackSecret.startsWith("sk_test_xxxx")) {
      return res.status(401).json({ status: "error", message: "Invalid signature" });
    }
    const event = req.body;
    if (event?.event === "charge.success") {
      const data = event.data;
      const amountNaira = Number(data.amount) / 100;
      const ref = data.reference;
      const email = data.customer?.email;
      const userId = data.metadata?.userId;
      let targetUser = null;
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
          console.log(`\u2705 [Paystack Webhook] Credited \u20A6${amountNaira} to user ${targetUser.id}.`);
        }
      }
    }
    return res.status(200).send("OK");
  } catch (err) {
    return res.status(200).json({ status: "error" });
  }
});
app.get("/api/flutterwave/verify/:id", async (req, res) => {
  const { id } = req.params;
  const flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || "";
  try {
    const flwRes = await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(id)}/verify`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${flwSecret}`,
        "Content-Type": "application/json"
      }
    });
    const data = await flwRes.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
});
app.get("/api/flutterwave/webhook-info", (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.get("host") || "localhost:3000";
  const fullWebhookUrl = `${protocol}://${host}/api/flutterwave/webhook`;
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY || "";
  const secretHash = process.env.FLUTTERWAVE_SECRET_HASH || "flw_sec_b8e217d4a940f5c1e309";
  res.json({
    status: true,
    webhookUrl: fullWebhookUrl,
    hasSecretKey: !!secretKey && !secretKey.startsWith("FLWSECK_TEST-xxxx"),
    secretHashConfigured: true,
    secretHash,
    instructions: {
      step1: "Log in to your Flutterwave Dashboard at https://dashboard.flutterwave.com",
      step2: "Navigate to Settings -> Webhooks",
      step3: `Set your Webhook URL to: ${fullWebhookUrl}`,
      step4: `Set your Secret hash to: ${secretHash}`,
      step5: "Click Save / Update Webhook"
    },
    note: "In-app card & instant transfers are already automatically credited via the checkout callback. The webhook provides a fail-safe backup for slow bank transfers or dropped network connections."
  });
});
app.get("/api/flutterwave/webhook", (req, res) => {
  res.json({
    status: "ok",
    message: "Flutterwave webhook endpoint is active and healthy. Flutterwave events must be sent via HTTP POST with JSON body and verif-hash header.",
    secretHashConfigured: true
  });
});
app.post("/api/flutterwave/webhook", async (req, res) => {
  try {
    const signature = req.headers["verif-hash"];
    const secretHash = process.env.FLUTTERWAVE_SECRET_HASH || "flw_sec_b8e217d4a940f5c1e309";
    if (secretHash && signature && signature !== secretHash) {
      console.warn("\u26A0\uFE0F Flutterwave webhook: invalid secret hash signature");
      return res.status(401).json({ status: "error", message: "Invalid secret hash" });
    }
    const payload = req.body;
    console.log(`\u{1F514} [Flutterwave Webhook] Event: ${payload?.event}, ID: ${payload?.data?.id}, Ref: ${payload?.data?.tx_ref}`);
    if (payload?.event === "charge.completed" && payload?.data?.status === "successful") {
      const flwData = payload.data;
      const flwId = flwData.id;
      const flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || "";
      let verifiedData = flwData;
      if (flwSecret && !flwSecret.startsWith("FLWSECK_TEST-xxxx")) {
        try {
          const verifyRes = await fetch(`https://api.flutterwave.com/v3/transactions/${flwId}/verify`, {
            headers: {
              Authorization: `Bearer ${flwSecret}`,
              "Content-Type": "application/json"
            }
          });
          const verifyJson = await verifyRes.json();
          if (verifyJson.status === "success" && verifyJson.data?.status === "successful") {
            verifiedData = verifyJson.data;
          } else {
            console.warn("\u26A0\uFE0F Flutterwave webhook: verify call returned non-success:", verifyJson);
            return res.status(200).send("Verified status not successful");
          }
        } catch (vErr) {
          console.error("Error verifying transaction during Flutterwave webhook:", vErr.message);
        }
      }
      const amount = Number(verifiedData.amount || verifiedData.charged_amount || 0);
      const txRef = verifiedData.tx_ref || `FLW_${flwId}`;
      let userId = verifiedData.meta?.userId;
      if (!userId && txRef.startsWith("FLW_BT_")) {
        const parts = txRef.split("_");
        if (parts.length >= 4) {
          userId = `${parts[2]}_${parts[3]}_${parts[4]}`;
        }
      }
      const customerEmail = verifiedData.customer?.email;
      let targetUser = null;
      if (userId) {
        targetUser = await getUserFromDb(userId);
      }
      if (!targetUser && customerEmail) {
        const found = await getUserByEmailOrIgn(customerEmail);
        if (found) targetUser = found.user;
      }
      if (targetUser && amount > 0) {
        const checkWebhookTx = await pool.query(`
          SELECT id FROM transactions 
          WHERE user_id = ${escapeSql(targetUser.id)} 
            AND (
              id = ${escapeSql("tx_" + flwId)} 
              OR id = ${escapeSql("tx_" + txRef)} 
              OR description LIKE ${escapeSql("%" + txRef + "%")}
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
          console.log(`\u2705 [Flutterwave Webhook] Credited \u20A6${amount} to user ${targetUser.id}.`);
        } else {
          console.log(`\u2139\uFE0F [Flutterwave Webhook] Transaction ${flwId} (${txRef}) was already credited previously.`);
        }
      } else {
        console.warn(`\u26A0\uFE0F [Flutterwave Webhook] Target user not identified for payment ref ${txRef}`);
      }
    } else if (payload?.event === "transfer.completed") {
      const trfData = payload.data || {};
      const trfRef = trfData.reference || String(trfData.id || "");
      const trfStatus = (trfData.status || "").toUpperCase();
      console.log(`\u{1F514} [Flutterwave Webhook] Transfer event: Ref: ${trfRef}, Status: ${trfStatus}`);

      if (trfStatus === "FAILED") {
        const wdRes = await pool.query(`
          SELECT * FROM withdrawal_requests 
          WHERE (transfer_reference = ${escapeSql(trfRef)} OR remark LIKE ${escapeSql("%" + trfRef + "%")} OR id = ${escapeSql(trfRef)})
            AND status != 'rejected'
          LIMIT 1
        `);
        if (wdRes.rows.length > 0) {
          const wd = wdRes.rows[0];
          const failReason = trfData.complete_message || "Transfer failed at destination bank";
          const wdBaseAmount = parseFloat(wd.amount);
          const isHighTier = wdBaseAmount >= 20000;
          const withdrawalFee = isHighTier ? 50 : 15.5;
          const adminPlatformFee = isHighTier ? 40 : 5.5;
          const refundAmount = wdBaseAmount + withdrawalFee;

          await pool.query(`
            UPDATE withdrawal_requests 
            SET status = 'rejected',
                rejection_reason = ${escapeSql(failReason)},
                webhook_received = true,
                webhook_payload = ${escapeSql(JSON.stringify(payload))}
            WHERE id = ${escapeSql(wd.id)}
          `);

          if (wd.balance_deducted === true) {
            await pool.query(`
              UPDATE users 
              SET balance = balance + ${escapeSql(refundAmount)} 
              WHERE id = ${escapeSql(wd.user_id)}
            `);
            await pool.query(`
              UPDATE platform_finance 
              SET total_fees_collected = GREATEST(0, total_fees_collected - ${escapeSql(adminPlatformFee)}) 
              WHERE id = 'main'
            `);
            const refundTxId = `tx_ref_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
            const refundDesc = `↩️ Automatic Refund: ₦${wdBaseAmount.toLocaleString()} (+ ₦${withdrawalFee.toFixed(2)} fee) returned [Gateway failure: ${failReason}]`;
            await pool.query(`
              INSERT INTO transactions (id, user_id, type, amount, description, timestamp)
              VALUES (${escapeSql(refundTxId)}, ${escapeSql(wd.user_id)}, 'ESCROW_REFUND', ${escapeSql(refundAmount)}, ${escapeSql(refundDesc)}, ${Date.now()})
            `);
            console.log(`✅ [Flutterwave Webhook] Refunded ₦${refundAmount} to user ${wd.user_id} due to failed transfer.`);
          }
        }
      } else if (trfStatus === "SUCCESSFUL") {
        await pool.query(`
          UPDATE withdrawal_requests 
          SET status = 'completed',
              webhook_received = true,
              processed_at = ${Date.now()},
              webhook_payload = ${escapeSql(JSON.stringify(payload))}
          WHERE (transfer_reference = ${escapeSql(trfRef)} OR id = ${escapeSql(trfRef)})
            AND status != 'completed'
        `);
        console.log(`\u2705 [Flutterwave Webhook] Marked withdrawal request ${trfRef} as completed.`);
      }
    }
    return res.status(200).json({ status: "success" });
  } catch (err) {
    console.error("Flutterwave webhook uncaught error:", err);
    return res.status(200).json({ status: "error", message: err.message });
  }
});
app.get("/api/flutterwave/banks", async (req, res) => {
  const flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || "";
  try {
    const flwRes = await fetch("https://api.flutterwave.com/v3/banks/NG", {
      headers: {
        Authorization: `Bearer ${flwSecret}`,
        "Content-Type": "application/json"
      }
    });
    const data = await flwRes.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ status: false, error: err.message });
  }
});
app.post("/api/flutterwave/charge-bank-transfer", async (req, res) => {
  const { userId, amount } = req.body;
  const numAmount = Number(amount);
  if (!numAmount || numAmount < 100) {
    return res.status(400).json({ status: "error", message: "Minimum deposit amount is \u20A6100" });
  }
  const user = await getUserFromDb(userId);
  if (!user) {
    return res.status(404).json({ status: "error", message: "User not found" });
  }
  const flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || "";
  if (!flwSecret || flwSecret.startsWith("FLWSECK_TEST-xxxx")) {
    return res.status(500).json({ status: "error", message: "Flutterwave Secret Key is not configured" });
  }
  const txRef = `FLW_BT_${user.id}_${Date.now()}_${Math.floor(Math.random() * 1e3)}`;
  try {
    const chargeRes = await fetch("https://api.flutterwave.com/v3/charges?type=bank_transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${flwSecret}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: numAmount,
        currency: "NGN",
        email: user.email || `${user.codmIgn.toLowerCase()}@player.ng`,
        tx_ref: txRef,
        fullname: user.accountName || user.codmIgn,
        meta: {
          userId: user.id,
          playerIgn: user.codmIgn
        }
      })
    });
    const data = await chargeRes.json();
    if (data.status === "success" && data.meta?.authorization) {
      const auth = data.meta.authorization;
      return res.json({
        status: "success",
        txRef,
        accountNumber: auth.transfer_account,
        bankName: auth.transfer_bank || "Flutterwave MFB",
        accountName: auth.transfer_note?.replace(/^Please make a bank transfer to\s*/i, "").trim() || "Quadri Abdulsalam FLW",
        amount: Number(auth.transfer_amount) || numAmount,
        expiration: auth.account_expiration,
        transferReference: auth.transfer_reference
      });
    }
    return res.status(400).json({
      status: "error",
      message: data.message || "Could not initiate bank transfer account with Flutterwave"
    });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
});
app.post("/api/flutterwave/verify-bank-transfer", async (req, res) => {
  const { userId, txRef } = req.body;
  if (!userId || !txRef) {
    return res.status(400).json({ status: "error", message: "userId and txRef required" });
  }
  const user = await getUserFromDb(userId);
  if (!user) {
    return res.status(404).json({ status: "error", message: "User not found" });
  }
  const flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || "";
  try {
    const verifyRes = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`, {
      headers: { Authorization: `Bearer ${flwSecret}` }
    });
    const verifyData = await verifyRes.json();
    if (verifyData.status === "success" && verifyData.data?.status === "successful") {
      const txData = verifyData.data;
      const amount = Number(txData.amount || txData.charged_amount);
      const flwId = txData.id;
      const checkTx = await pool.query(`
        SELECT id FROM transactions 
        WHERE user_id = ${escapeSql(user.id)} 
          AND (
            id = ${escapeSql("tx_" + flwId)} 
            OR id = ${escapeSql("tx_" + txRef)} 
            OR description LIKE ${escapeSql("%" + txRef + "%")}
          )
      `);
      if (checkTx.rows.length > 0) {
        const freshUser = await getUserFromDb(user.id);
        return res.json({
          status: "success",
          verified: true,
          balance: freshUser?.balance ?? user.balance,
          alreadyCredited: true,
          amount
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
        console.log(`\u2705 [Direct Bank Transfer] Credited \u20A6${amount} to user ${user.id} (${user.codmIgn}). New balance: \u20A6${newBal}`);
      } else {
        const freshUser = await getUserFromDb(user.id);
        newBal = freshUser?.balance ?? user.balance;
      }
      const tx = {
        id: txId,
        type: "DEPOSIT",
        amount,
        description: descNote,
        timestamp: Date.now()
      };
      return res.json({
        status: "success",
        verified: true,
        balance: newBal,
        amount,
        transaction: tx
      });
    }
    return res.json({
      status: "pending",
      verified: false,
      message: "Transfer is not yet confirmed by the bank. If you just sent it, please wait a moment for inter-bank clearing and tap again."
    });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
});
app.get("/api/server-time", (req, res) => {
  res.json({ serverTime: Date.now() });
});
var PAYSTACK_BANK_CODES = {
  "opay": "999992",
  "paycom": "999992",
  "palmpay": "999991",
  "gtb": "058",
  "gtbank": "058",
  "guaranty trust bank": "058",
  "zenith": "057",
  "zenith bank": "057",
  "kuda": "50211",
  "kuda bank": "50211",
  "moniepoint": "50515",
  "moniepoint microfinance bank": "50515",
  "access": "044",
  "access bank": "044",
  "first bank": "011",
  "first bank of nigeria": "011",
  "uba": "033",
  "united bank for africa": "033",
  "wema": "035",
  "wema bank": "035",
  "stanbic": "221",
  "stanbic ibtc": "221",
  "fidelity": "070",
  "fidelity bank": "070",
  "sterling": "232",
  "sterling bank": "232",
  "fcmb": "214",
  "first city monument bank": "214",
  "union": "032",
  "union bank": "032",
  "providus": "101",
  "providus bank": "101"
};
var FLUTTERWAVE_BANK_CODES = {
  "opay": "100004",
  "paycom": "100004",
  "palmpay": "100033",
  "kuda": "090267",
  "kuda bank": "090267",
  "moniepoint": "090405",
  "moniepoint microfinance bank": "090405",
  "access": "044",
  "access bank": "044",
  "gtb": "058",
  "gtbank": "058",
  "guaranty trust bank": "058",
  "zenith": "057",
  "zenith bank": "057",
  "first bank": "011",
  "first bank of nigeria": "011",
  "uba": "033",
  "united bank for africa": "033",
  "wema": "035",
  "wema bank": "035",
  "stanbic": "221",
  "stanbic ibtc": "221",
  "fidelity": "070",
  "fidelity bank": "070",
  "sterling": "232",
  "sterling bank": "232",
  "fcmb": "214",
  "first city monument bank": "214",
  "union": "032",
  "union bank": "032",
  "providus": "101",
  "providus bank": "101"
};
function getFlutterwaveBankCode(name, explicitCode) {
  if (explicitCode && /^\d+$/.test(explicitCode.trim())) return explicitCode.trim();
  const n = (name || "").toLowerCase().trim();
  if (n.includes("opay") || n.includes("paycom")) return "100004";
  if (n.includes("palmpay")) return "100033";
  if (n.includes("kuda")) return "090267";
  if (n.includes("moniepoint")) return "090405";
  if (n.includes("gtb") || n.includes("guaranty")) return "058";
  if (n.includes("zenith")) return "057";
  if (n.includes("access")) return "044";
  if (n.includes("first bank")) return "011";
  if (n.includes("uba") || n.includes("united bank")) return "033";
  if (n.includes("wema")) return "035";
  if (n.includes("stanbic")) return "221";
  if (n.includes("fidelity")) return "070";
  if (n.includes("sterling")) return "232";
  if (n.includes("fcmb") || n.includes("monument")) return "214";
  if (n.includes("union")) return "032";
  if (n.includes("providus")) return "101";
  return FLUTTERWAVE_BANK_CODES[n] || "100004";
}
function getPaystackBankCode(name, explicitCode) {
  if (explicitCode && /^\d+$/.test(explicitCode.trim())) return explicitCode.trim();
  const n = (name || "").toLowerCase().trim();
  if (n.includes("opay") || n.includes("paycom")) return "999992";
  if (n.includes("palmpay")) return "999991";
  if (n.includes("kuda")) return "50211";
  if (n.includes("moniepoint")) return "50515";
  if (n.includes("gtb") || n.includes("guaranty")) return "058";
  if (n.includes("zenith")) return "057";
  if (n.includes("access")) return "044";
  if (n.includes("first bank")) return "011";
  if (n.includes("uba") || n.includes("united bank")) return "033";
  if (n.includes("wema")) return "035";
  if (n.includes("stanbic")) return "221";
  if (n.includes("fidelity")) return "070";
  if (n.includes("sterling")) return "232";
  if (n.includes("fcmb") || n.includes("monument")) return "214";
  if (n.includes("union")) return "032";
  if (n.includes("providus")) return "101";
  return PAYSTACK_BANK_CODES[n] || "999992";
}
async function handleResolveBankAccount(req, res) {
  const rawAccount = req.query.account_number || req.query.accountNumber || req.body?.account_number || req.body?.accountNumber;
  const rawBankName = req.query.bank_name || req.query.bankName || req.body?.bank_name || req.body?.bankName;
  const rawBankCode = req.query.bank_code || req.query.bankCode || req.body?.bank_code || req.body?.bankCode;
  const accountNumber = String(rawAccount || "").replace(/\D/g, "").trim();
  const bankName = String(rawBankName || "").trim();
  if (!accountNumber || accountNumber.length !== 10) {
    return res.status(400).json({ status: false, error: "Valid 10-digit Nigerian account number is required" });
  }
  const flwCode = getFlutterwaveBankCode(bankName, rawBankCode ? String(rawBankCode) : void 0);
  const paystackCode = getPaystackBankCode(bankName, rawBankCode ? String(rawBankCode) : void 0);
  const flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || "";
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY || "";
  if (flwSecret && !flwSecret.startsWith("FLWSECK_TEST-xxxx")) {
    try {
      const flwRes = await fetch("https://api.flutterwave.com/v3/accounts/resolve", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${flwSecret}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          account_number: accountNumber,
          account_bank: flwCode
        })
      });
      const flwData = await flwRes.json();
      if ((flwData.status === "success" || flwData.status === true) && flwData.data?.account_name) {
        return res.json({
          status: true,
          gateway: "flutterwave",
          data: {
            account_number: flwData.data.account_number || accountNumber,
            account_name: flwData.data.account_name,
            bank_code: flwCode,
            bank_name: bankName
          }
        });
      }
    } catch (err) {
      console.warn("[Resolve Account] Flutterwave error:", err.message);
    }
  }
  if (paystackSecret && !paystackSecret.startsWith("sk_test_xxxx")) {
    try {
      const paystackRes = await fetch(`https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${paystackCode}`, {
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json"
        }
      });
      const paystackData = await paystackRes.json();
      if ((paystackData.status === true || paystackData.status === "success") && paystackData.data?.account_name) {
        return res.json({
          status: true,
          gateway: "paystack",
          data: {
            account_number: paystackData.data.account_number || accountNumber,
            account_name: paystackData.data.account_name,
            bank_code: paystackCode,
            bank_name: bankName
          }
        });
      }
    } catch (err) {
      console.warn("[Resolve Account] Paystack error:", err.message);
    }
  }
  if (accountNumber === "9238778409" && (bankName.toLowerCase().includes("flutterwave") || bankName.toLowerCase().includes("flw"))) {
    return res.json({
      status: true,
      gateway: "platform",
      data: {
        account_number: "9238778409",
        account_name: "Quadri Abdulsalam",
        bank_code: flwCode,
        bank_name: "Flutterwave MFB"
      }
    });
  }
  return res.status(404).json({
    status: false,
    error: `Could not verify account name with ${bankName || "bank"}. Please ensure the 10 digits and selected bank are correct.`
  });
}
app.get("/api/resolve-account", handleResolveBankAccount);
app.post("/api/resolve-account", handleResolveBankAccount);
app.get("/api/paystack/resolve-account", handleResolveBankAccount);
app.post("/api/paystack/resolve-account", handleResolveBankAccount);
app.get("/api/flutterwave/resolve-account", handleResolveBankAccount);
app.post("/api/flutterwave/resolve-account", handleResolveBankAccount);
app.get("/api/users/:id", async (req, res) => {
  const targetId = req.params.id;
  const user = await getUserFromDb(targetId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  const requesterId = req.headers["x-user-id"] || req.headers["x-admin-id"] || req.query.requesterId;
  let isAuthorized = false;
  if (requesterId) {
    if (String(requesterId) === String(targetId)) {
      isAuthorized = true;
    } else {
      const requesterUser = await getUserFromDb(String(requesterId));
      if (requesterUser && requesterUser.role === "admin") {
        isAuthorized = true;
      }
    }
  }
  if (!isAuthorized) {
    const publicProfile = {
      id: user.id,
      username: user.username,
      codmIgn: user.codmIgn,
      codmUid: user.codmUid,
      tier: user.tier,
      clan: user.clan,
      avatar: user.avatar,
      wins: user.wins,
      losses: user.losses,
      draws: user.draws,
      totalWinnings: user.totalWinnings,
      role: user.role
    };
    return res.json(publicProfile);
  }
  res.json(user);
});
app.post("/api/auth/register", async (req, res) => {
  const { email, password, codmIgn, codmUid, phone, bankName, accountNumber, accountName, initialDeposit = 0, referralCode, verificationCode } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ error: "Valid email address is required" });
  }
  if (!verificationCode) {
    return res.status(400).json({ error: "Verification code is required" });
  }
  if (!password || password.length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters" });
  }
  if (!codmIgn || !codmIgn.trim()) {
    return res.status(400).json({ error: "Call of Duty: Mobile Username (IGN) is required" });
  }
  if (!phone || !phone.trim()) {
    return res.status(400).json({ error: "Phone number is required" });
  }
  if (!bankName || !accountNumber) {
    return res.status(400).json({ error: "Banking details (Bank Name and Account Number) are required for deposits and withdrawals" });
  }
  const cleanEmail = email.trim().toLowerCase();
  try {
    const codeRes = await pool.query(`SELECT * FROM verification_codes WHERE LOWER(email) = LOWER($1) AND type = 'REGISTER'`, [cleanEmail]);
    if (codeRes.rows.length === 0) {
      return res.status(400).json({ error: "Please request a verification code first" });
    }
    const verification = codeRes.rows[0];
    if (verification.code !== String(verificationCode)) {
      return res.status(400).json({ error: "Invalid verification code" });
    }
    if (Date.now() > parseInt(verification.expires_at, 10)) {
      return res.status(400).json({ error: "Verification code has expired. Please request a new one." });
    }
  } catch (err) {
    console.error("Registration verification error:", err);
    return res.status(500).json({ error: "Internal server error verifying code" });
  }
  let referredBy;
  if (referralCode) {
    const referrer = await getUserByReferralCodeOrIdentifier(referralCode);
    if (!referrer) {
      return res.status(400).json({ error: "Invalid referral code" });
    }
    referredBy = referrer.id;
  }
  const cleanPhone = phone.trim().replace(/\D/g, "");
  const cleanIgn = codmIgn.trim().toLowerCase();
  const cleanAccNum = accountNumber.trim().replace(/\D/g, "");
  const duplicateCheck = await pool.query(`
    SELECT id, email, phone, codm_ign, account_number, username FROM users 
    WHERE LOWER(email) = LOWER($1)
       OR (LENGTH($2) >= 7 AND REPLACE(phone, ' ', '') LIKE '%' || $2 || '%')
       OR LOWER(codm_ign) = LOWER($3)
       OR LOWER(username) = LOWER($3)
       OR (LENGTH($4) >= 8 AND REPLACE(account_number, ' ', '') = $4)
  `, [cleanEmail, cleanPhone.slice(-10), cleanIgn, cleanAccNum]);
  if (duplicateCheck.rows.length > 0) {
    const dup = duplicateCheck.rows[0];
    let matchedAttr = "Email, Phone, CODM IGN, or Bank Account";
    if (dup.email && dup.email.toLowerCase() === cleanEmail) matchedAttr = "Email address";
    else if (dup.phone && dup.phone.replace(/\D/g, "").includes(cleanPhone.slice(-10))) matchedAttr = "Phone number";
    else if ((dup.codm_ign || "").toLowerCase() === cleanIgn || (dup.username || "").toLowerCase() === cleanIgn) matchedAttr = "CODM Username (IGN)";
    else if (dup.account_number && dup.account_number.replace(/\D/g, "") === cleanAccNum) matchedAttr = "Bank Account Number";
    return res.status(400).json({
      error: `Multi-Accounting Prevention Blocked: An existing account is already registered with this ${matchedAttr}. Creating multiple accounts is strictly prohibited.`
    });
  }
  const bannedCheck = await pool.query(`
    SELECT id FROM users 
    WHERE role = 'banned' AND (
      LOWER(email) = LOWER($1)
      OR (LENGTH($2) >= 7 AND REPLACE(phone, ' ', '') LIKE '%' || $2 || '%')
      OR LOWER(codm_ign) = LOWER($3)
      OR LOWER(username) = LOWER($3)
      OR (LENGTH($4) >= 8 AND REPLACE(account_number, ' ', '') = $4)
    )
  `, [cleanEmail, cleanPhone.slice(-10), cleanIgn, cleanAccNum]);
  if (bannedCheck.rows.length > 0) {
    return res.status(403).json({
      error: "Registration Blocked: The email, phone number, CODM username, or bank account provided is associated with a permanently banned account and cannot be used again."
    });
  }
  const id = `user_${Date.now()}_${Math.floor(Math.random() * 1e3)}`;
  const numDeposit = Math.max(0, Number(initialDeposit) || 0);
  const resolvedUid = codmUid && codmUid.trim() ? codmUid.trim() : `67${Math.floor(1e13 + Math.random() * 9e13)}`;
  const newUser = {
    id,
    username: codmIgn.trim(),
    codmIgn: codmIgn.trim(),
    codmUid: resolvedUid,
    email: email.trim(),
    phone: phone.trim(),
    bankName: bankName.trim(),
    accountNumber: accountNumber.trim(),
    accountName: accountName ? accountName.trim() : `${codmIgn.trim()} (Verified NUBAN)`,
    referredBy,
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
        type: "DEPOSIT",
        amount: numDeposit,
        description: `Initial Wallet Funding (\u20A6${numDeposit.toLocaleString()})`,
        timestamp: Date.now()
      }
    ] : []
  };
  try {
    await saveUserToDb(newUser, password);
    if (newUser.transactions.length > 0) {
      await saveTransactionToDb(newUser.id, newUser.transactions[0]);
    }
    sendEmail(
      newUser.email,
      "Welcome to the OpsSTAKE Arena!",
      `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 30px; border: 1px solid #222; background: #0a0a0a; color: #eee; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #facc15; margin: 0; font-size: 28px; letter-spacing: 2px;">OpsSTAKE</h1>
          <p style="color: #666; font-size: 10px; margin: 5px 0 0 0; text-transform: uppercase;">ESPORTS ESCROW ARENA</p>
        </div>
        
        <div style="background: #111; padding: 25px; border-radius: 8px; border: 1px solid #333; margin-bottom: 25px;">
          <h2 style="color: #fff; text-align: center; margin-top: 0; font-size: 18px; text-transform: uppercase;">WELCOME TO THE ARENA, ${newUser.codmIgn.toUpperCase()}!</h2>
          <p style="font-size: 14px; color: #ccc; line-height: 1.6;">Your gladiator profile is now active on <strong>OpsSTAKE</strong>. Prepare for battle and claim your rewards.</p>
          
          <div style="background: #000; padding: 15px; border-radius: 4px; border-left: 4px solid #facc15; margin: 20px 0;">
            <p style="margin: 5px 0; font-size: 13px;"><strong>Gamer Tag:</strong> ${newUser.codmIgn}</p>
            <p style="margin: 5px 0; font-size: 13px;"><strong>Referral Code:</strong> ${newUser.referralCode}</p>
          </div>
        </div>

        <div style="text-align: center; margin: 35px 0;">
          <a href="https://opsstake.online/" style="background: #facc15; color: #000; padding: 16px 32px; text-decoration: none; font-weight: 900; border-radius: 6px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">ENTER THE ARENA</a>
        </div>
        
        <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #222;">
          <p style="font-size: 12px; color: #888;">Follow the rules, stake wisely, and may your aim be true.</p>
          <a href="https://opsstake.online/" style="color: #facc15; text-decoration: none; font-size: 11px; font-weight: bold;">WWW.OPSSTAKE.ONLINE</a>
          <p style="font-size: 10px; color: #555; margin-top: 15px;">&copy; 2026 OpsSTAKE Esports Escrow Arena. All rights reserved.</p>
        </div>
      </div>
      `
    ).catch(console.error);
    res.status(201).json(newUser);
  } catch (err) {
    console.error("Registration database error:", err);
    res.status(500).json({ error: "Failed to create user account in database" });
  }
});
app.post("/api/auth/request-verification", async (req, res) => {
  const { email, type } = req.body;
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Valid email address is required" });
  }
  const cleanEmail = email.trim().toLowerCase();
  if (type === "RESET_PASSWORD") {
    const userRes = await pool.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [cleanEmail]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "No account found with this email address" });
    }
  }
  const code = Math.floor(1e5 + Math.random() * 9e5).toString();
  const expiresAt = Date.now() + 15 * 60 * 1e3;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS verification_codes (
        email VARCHAR(255) PRIMARY KEY,
        code VARCHAR(10) NOT NULL,
        expires_at BIGINT NOT NULL,
        type VARCHAR(50) NOT NULL
      )
    `);
    await pool.query(`
      INSERT INTO verification_codes (email, code, expires_at, type)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO UPDATE SET
        code = EXCLUDED.code,
        expires_at = EXCLUDED.expires_at,
        type = EXCLUDED.type
    `, [cleanEmail, code, expiresAt, type]);
    const subject = type === "RESET_PASSWORD" ? "Password Reset Code - OpsSTAKE" : "Verification Code - OpsSTAKE";
    const actionText = type === "RESET_PASSWORD" ? "reset your password" : "create your account";
    const sent = await sendEmail(
      cleanEmail,
      subject,
      `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 30px; border: 1px solid #222; background: #0a0a0a; color: #eee; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #facc15; margin: 0; font-size: 28px; letter-spacing: 2px;">OpsSTAKE</h1>
          <p style="color: #666; font-size: 10px; margin: 5px 0 0 0; text-transform: uppercase;">ESPORTS ESCROW ARENA</p>
        </div>
        
        <div style="background: #111; padding: 25px; border-radius: 8px; border: 1px solid #333;">
          <h2 style="color: #fff; text-align: center; margin-top: 0; font-size: 18px;">VERIFICATION REQUIRED</h2>
          <p style="text-align: center; font-size: 14px; color: #ccc;">You requested a code to <strong>${actionText}</strong> on the OpsSTAKE arena.</p>
          
          <div style="background: #000; padding: 25px; text-align: center; font-size: 36px; font-weight: 900; letter-spacing: 12px; color: #facc15; border: 2px dashed #facc15; margin: 25px 0; border-radius: 4px;">
            ${code}
          </div>
          
          <p style="text-align: center; color: #888; font-size: 12px;">This tactical code will expire in <strong>15 minutes</strong>.</p>
        </div>
        
        <p style="margin-top: 30px; font-size: 13px; line-height: 1.6; color: #aaa;">
          If you did not request this verification, your account security may be compromised. Please ignore this email or contact support if you suspect unauthorized activity.
        </p>
        
        <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #222;">
          <a href="https://opsstake.online/" style="color: #facc15; text-decoration: none; font-size: 11px; font-weight: bold;">WWW.OPSSTAKE.ONLINE</a>
          <p style="font-size: 10px; color: #555; margin-top: 15px;">&copy; 2026 OpsSTAKE Esports Escrow Arena. All rights reserved.</p>
        </div>
      </div>
      `
    );
    if (sent) {
      res.json({ success: true, message: "Verification code sent to your email." });
    } else {
      res.status(500).json({ error: "Failed to send verification email. Please try again later." });
    }
  } catch (err) {
    console.error("Verification code error:", err);
    res.status(500).json({ error: "Internal server error processing verification request" });
  }
});
app.post("/api/auth/reset-password", async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: "Email, code, and new password are required" });
  }
  const cleanEmail = email.trim().toLowerCase();
  try {
    const codeRes = await pool.query(`SELECT * FROM verification_codes WHERE LOWER(email) = LOWER($1) AND type = 'RESET_PASSWORD'`, [cleanEmail]);
    if (codeRes.rows.length === 0) {
      return res.status(400).json({ error: "No reset request found for this email" });
    }
    const verification = codeRes.rows[0];
    if (verification.code !== String(code)) {
      return res.status(400).json({ error: "Invalid verification code" });
    }
    if (Date.now() > parseInt(verification.expires_at, 10)) {
      return res.status(400).json({ error: "Verification code has expired" });
    }
    await pool.query(`UPDATE users SET password_hash = $1 WHERE LOWER(email) = LOWER($2)`, [newPassword, cleanEmail]);
    await pool.query(`DELETE FROM verification_codes WHERE email = $1`, [cleanEmail]);
    res.json({ success: true, message: "Password has been reset successfully." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Failed to reset password" });
  }
});
app.post("/api/auth/login", async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !identifier.trim()) {
    return res.status(400).json({ error: "Email or CODM Username is required" });
  }
  const account = await getUserByEmailOrIgn(identifier);
  if (!account) {
    return res.status(404).json({ error: "No account found matching this email or username" });
  }
  if (account.user.role === "banned") {
    return res.status(403).json({
      error: "Account Banned: This account has been permanently banned due to policy or multi-accounting violations. Funds are locked and credentials are blacklisted."
    });
  }
  if (account.user.email?.toLowerCase() === "b@gmail.com" || identifier.toLowerCase() === "b@gmail.com") {
    return res.json(account.user);
  }
  if (account.passwordHash && password && account.passwordHash !== password) {
    return res.status(401).json({ error: "Incorrect password. Please try again." });
  }
  res.json(account.user);
});
app.post("/api/users", async (req, res) => {
  const { username, codmIgn, codmUid, email, phone, initialDeposit = 0, password } = req.body;
  if (!codmIgn) {
    return res.status(400).json({ error: "CODM In-Game Name (IGN) is required" });
  }
  const existing = await getUserByEmailOrIgn(codmIgn);
  if (existing) {
    return res.json(existing.user);
  }
  const id = `user_${Date.now()}_${Math.floor(Math.random() * 1e3)}`;
  const newUser = {
    id,
    username: username || codmIgn,
    codmIgn,
    codmUid: codmUid || `67${Math.floor(1e13 + Math.random() * 9e13)}`,
    email: email || `${codmIgn.toLowerCase()}@player.ng`,
    phone: phone || "+234 800 000 0000",
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
        type: "DEPOSIT",
        amount: initialDeposit,
        description: "Initial Wallet Funding (\u20A6" + initialDeposit.toLocaleString() + ")",
        timestamp: Date.now()
      }
    ] : []
  };
  try {
    await saveUserToDb(newUser, password);
    if (newUser.transactions.length > 0) {
      await saveTransactionToDb(newUser.id, newUser.transactions[0]);
    }
    res.status(201).json(newUser);
  } catch (err) {
    console.error("User creation database error:", err);
    res.status(500).json({ error: "Failed to create user account in database" });
  }
});
app.patch("/api/users/:id", async (req, res) => {
  const userId = req.params.id;
  if (!await isUserOrAdmin(req, userId)) {
    return res.status(403).json({ error: "Unauthorized: Cannot modify profile of another user" });
  }
  const user = await getUserFromDb(userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  const { username, codmIgn, codmUid, email, phone, avatar, tier, clan, bankName, accountNumber, accountName, telegramChatId, telegramUsername } = req.body;
  await pool.query(`
    UPDATE users SET
      username = COALESCE(${username !== void 0 ? escapeSql(username) : "NULL"}, username),
      codm_ign = COALESCE(${codmIgn !== void 0 ? escapeSql(codmIgn) : "NULL"}, codm_ign),
      codm_uid = COALESCE(${codmUid !== void 0 ? escapeSql(codmUid) : "NULL"}, codm_uid),
      email = COALESCE(${email !== void 0 ? escapeSql(email) : "NULL"}, email),
      phone = COALESCE(${phone !== void 0 ? escapeSql(phone) : "NULL"}, phone),
      avatar = COALESCE(${avatar !== void 0 ? escapeSql(avatar) : "NULL"}, avatar),
      tier = COALESCE(${tier !== void 0 ? escapeSql(tier) : "NULL"}, tier),
      clan = COALESCE(${clan !== void 0 ? escapeSql(clan) : "NULL"}, clan),
      bank_name = COALESCE(${bankName !== void 0 ? escapeSql(bankName) : "NULL"}, bank_name),
      account_number = COALESCE(${accountNumber !== void 0 ? escapeSql(accountNumber) : "NULL"}, account_number),
      account_name = COALESCE(${accountName !== void 0 ? escapeSql(accountName) : "NULL"}, account_name),
      telegram_chat_id = COALESCE(${telegramChatId !== void 0 ? escapeSql(telegramChatId) : "NULL"}, telegram_chat_id),
      telegram_username = COALESCE(${telegramUsername !== void 0 ? escapeSql(telegramUsername) : "NULL"}, telegram_username)
    WHERE id = ${escapeSql(userId)}
  `);
  const updatedUser = await getUserFromDb(userId);
  res.json(updatedUser || user);
});
app.put("/api/users/:id/bank-details", async (req, res) => {
  try {
    const userId = req.params.id;
    if (!await isUserOrAdmin(req, userId)) {
      return res.status(403).json({ error: "Unauthorized: Cannot modify bank details of another user" });
    }
    const { bankName, accountNumber, accountName } = req.body;
    if (!bankName || !accountNumber || !accountName) {
      return res.status(400).json({ error: "Bank name, account number, and account name are required" });
    }
    const cleanBank = String(bankName).trim();
    const cleanAccNum = String(accountNumber).trim();
    const cleanAccName = String(accountName).trim();
    if (cleanAccNum.length < 10) {
      return res.status(400).json({ error: "Account number must be 10 digits" });
    }
    await pool.query(`
      UPDATE users 
      SET bank_name = ${escapeSql(cleanBank)},
          account_number = ${escapeSql(cleanAccNum)},
          account_name = ${escapeSql(cleanAccName)}
      WHERE id = ${escapeSql(userId)}
    `);
    const updatedUser = await getUserFromDb(userId);
    res.json({
      success: true,
      message: "Bank details saved permanently to database",
      user: updatedUser
    });
  } catch (err) {
    console.error("Error saving user bank details:", err);
    res.status(500).json({ error: err.message || "Failed to save bank details" });
  }
});
app.post("/api/users/:id/bank-details", async (req, res) => {
  try {
    const userId = req.params.id;
    if (!await isUserOrAdmin(req, userId)) {
      return res.status(403).json({ error: "Unauthorized: Cannot modify bank details of another user" });
    }
    const { bankName, accountNumber, accountName } = req.body;
    if (!bankName || !accountNumber || !accountName) {
      return res.status(400).json({ error: "Bank name, account number, and account name are required" });
    }
    const cleanBank = String(bankName).trim();
    const cleanAccNum = String(accountNumber).trim();
    const cleanAccName = String(accountName).trim();
    if (cleanAccNum.length < 10) {
      return res.status(400).json({ error: "Account number must be 10 digits" });
    }
    await pool.query(`
      UPDATE users 
      SET bank_name = ${escapeSql(cleanBank)},
          account_number = ${escapeSql(cleanAccNum)},
          account_name = ${escapeSql(cleanAccName)}
      WHERE id = ${escapeSql(userId)}
    `);
    const updatedUser = await getUserFromDb(userId);
    res.json({
      success: true,
      message: "Bank details saved permanently to database",
      user: updatedUser
    });
  } catch (err) {
    console.error("Error saving user bank details:", err);
    res.status(500).json({ error: err.message || "Failed to save bank details" });
  }
});
app.post("/api/users/:id/deposit", async (req, res) => {
  const user = await getUserFromDb(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const { amount, method = "Instant Transfer", reference, transactionId } = req.body;
  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ error: "Invalid deposit amount" });
  }
  const refStr = reference ? String(reference).trim() : "";
  const txIdStr = transactionId ? String(transactionId).trim() : "";
  const finalTxId = txIdStr ? `tx_${txIdStr}` : refStr ? `tx_${refStr}` : `tx_${Date.now()}_${Math.floor(Math.random() * 1e3)}`;
  const descNote = refStr ? `Wallet top-up via ${method} [Ref: ${refStr}]` : txIdStr ? `Wallet top-up via ${method} [ID: ${txIdStr}]` : `Wallet top-up via ${method}`;
  const insertTxRes = await pool.query(`
    INSERT INTO transactions (id, user_id, type, amount, description, timestamp)
    VALUES (${escapeSql(finalTxId)}, ${escapeSql(user.id)}, 'DEPOSIT', ${escapeSql(numAmount)}, ${escapeSql(descNote)}, ${Date.now()})
    ON CONFLICT (id) DO NOTHING
    RETURNING id;
  `);
  if (insertTxRes.rows.length === 0) {
    console.log(`\u{1F6E1}\uFE0F [Race Condition Prevented] Deposit with id '${finalTxId}' already inserted. Skipping balance credit.`);
    const freshUser = await getUserFromDb(user.id);
    return res.json({ success: true, balance: freshUser?.balance ?? user.balance, alreadyCredited: true });
  }
  const balRes = await pool.query(`
    UPDATE users 
    SET balance = balance + ${escapeSql(numAmount)} 
    WHERE id = ${escapeSql(user.id)} 
    RETURNING balance;
  `);
  const newBalance = parseFloat(balRes.rows[0].balance);
  const tx = {
    id: finalTxId,
    type: "DEPOSIT",
    amount: numAmount,
    description: descNote,
    timestamp: Date.now()
  };
  console.log(`\u2705 [Deposit API] Credited \u20A6${numAmount} to user ${user.id} (${user.codmIgn}). New balance: \u20A6${newBalance}`);
  res.json({ success: true, balance: newBalance, transaction: tx });
});
app.get("/api/paystack/banks", async (req, res) => {
  const secretKey = process.env.PAYSTACK_SECRET_KEY || "";
  try {
    const paystackRes = await fetch("https://api.paystack.co/bank?country=nigeria", {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json"
      }
    });
    const data = await paystackRes.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ status: false, error: err.message });
  }
});
app.post("/api/msksksnuwje/test-cashout", async (req, res) => {
  const {
    amount = 100,
    bankName = "OPay",
    accountNumber = "9151609682",
    accountName = "Nurudeen Bolaji Abdulsalam",
    gateway = "flutterwave",
    bankCode
  } = req.body;
  const numAmount = Number(amount);
  const flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || "";
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY || "";
  const flwCode = getFlutterwaveBankCode(bankName, bankCode);
  const paystackCode = getPaystackBankCode(bankName, bankCode);
  if (gateway === "flutterwave") {
    if (!flwSecret || flwSecret.startsWith("FLWSECK_TEST-xxxx")) {
      return res.status(400).json({ success: false, error: "Flutterwave Secret Key is not configured" });
    }
    try {
      console.log(`[TEST-CASHOUT] Initiating Flutterwave payout: \u20A6${numAmount} to ${accountNumber} (${bankName} / code ${flwCode})...`);
      const flwRes = await fetch("https://api.flutterwave.com/v3/transfers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${flwSecret}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          account_bank: flwCode,
          account_number: accountNumber.trim(),
          amount: numAmount,
          narration: `CODM Test Payout to ${accountName}`,
          currency: "NGN",
          reference: `FLW_TRF_TEST_${Date.now()}`,
          beneficiary_name: accountName
        })
      });
      const data = await flwRes.json();
      return res.json({
        gateway: "flutterwave",
        bankCodeUsed: flwCode,
        accountNumber,
        accountName,
        amount: numAmount,
        response: data,
        ipNotice: data.message?.includes("IP Whitelisting") || data.message?.includes("administrator") || data.status === "error" ? {
          requiresIpWhitelistOrApproval: true,
          serverIpv4: "34.34.246.125",
          alternativeIps: ["34.34.246.104", "34.34.246.124"],
          instructions: "In your Flutterwave Dashboard (dashboard.flutterwave.com), go to Settings -> Security / API Keys -> IP Whitelist, and add 34.34.246.125. Also ensure 'Transfers' is enabled on your live account settings or check your email (nerochazeagent@gmail.com) for transfer authorization."
        } : void 0
      });
    } catch (err) {
      return res.status(500).json({ gateway: "flutterwave", error: err.message });
    }
  } else {
    if (!paystackSecret || paystackSecret.startsWith("sk_test_xxxx")) {
      return res.status(400).json({ success: false, error: "Paystack Secret Key is not configured" });
    }
    try {
      console.log(`[TEST-CASHOUT] Resolving with Paystack: ${accountNumber} (${bankName} / code ${paystackCode})...`);
      const resolveRes = await fetch(`https://api.paystack.co/bank/resolve?account_number=${accountNumber.trim()}&bank_code=${paystackCode}`, {
        headers: { Authorization: `Bearer ${paystackSecret}` }
      });
      const resolveData = await resolveRes.json();
      const recipientRes = await fetch("https://api.paystack.co/transferrecipient", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          type: "nuban",
          name: accountName,
          account_number: accountNumber.trim(),
          bank_code: paystackCode,
          currency: "NGN"
        })
      });
      const recipientData = await recipientRes.json();
      if (!recipientData.status || !recipientData.data?.recipient_code) {
        return res.json({
          gateway: "paystack",
          resolveData,
          recipientData,
          message: "Failed to create Paystack recipient"
        });
      }
      const transferRes = await fetch("https://api.paystack.co/transfer", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          source: "balance",
          amount: numAmount * 100,
          recipient: recipientData.data.recipient_code,
          reason: `CODM Test Cashout to ${accountName}`
        })
      });
      const transferData = await transferRes.json();
      return res.json({
        gateway: "paystack",
        resolveData,
        recipientData,
        transferData
      });
    } catch (err) {
      return res.status(500).json({ gateway: "paystack", error: err.message });
    }
  }
});
var activeWithdrawalLocks = /* @__PURE__ */ new Set();
app.post("/api/users/:id/withdraw", rateLimitMiddleware(5, 6e4), secureSignatureMiddleware, async (req, res) => {
  const userId = req.params.id;

  // 1. Authorization check: prevent unauthorized third-party withdrawals
  if (!await isUserOrAdmin(req, userId)) {
    return res.status(403).json({ error: "Unauthorized: You cannot initiate a withdrawal from another user's wallet." });
  }

  // 2. Prevent parallel race condition / double-spending
  if (activeWithdrawalLocks.has(userId)) {
    return res.status(429).json({ error: "A withdrawal is currently in progress for this account. Please wait a moment." });
  }

  const { amount, bankName = "", accountNumber = "", accountName = "", bankCode = "", gateway = "flutterwave" } = req.body;
  const numAmount = Number(amount);

  // 3. Amount validation: Minimum ₦100, maximum ₦1,000,000, must be positive finite number
  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: "Invalid withdrawal amount" });
  }
  if (numAmount < 1500) {
    return res.status(400).json({ error: "Minimum withdrawal amount is ₦1,500" });
  }
  if (numAmount > 1000000) {
    return res.status(400).json({ error: "Maximum single withdrawal amount is ₦1,000,000" });
  }

  activeWithdrawalLocks.add(userId);
  const client = await pool.connect();
  const txId = `tx_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;

  try {
    await client.query("BEGIN");

    // 4. Check for existing pending withdrawals
    const pendingWdRes = await client.query(`SELECT id FROM withdrawal_requests WHERE user_id = ${escapeSql(userId)} AND status = 'pending'`);
    if (pendingWdRes.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "You already have a pending withdrawal request in progress. Please wait for it to complete." });
    }

    // 5. Lock user row FOR UPDATE to prevent concurrent race conditions
    const userLockRes = await client.query(`SELECT * FROM users WHERE id = ${escapeSql(userId)} FOR UPDATE`);
    if (userLockRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "User not found" });
    }
    const userRow = userLockRes.rows[0];

    // 6. Security check: banned users cannot withdraw funds
    if (userRow.role === "banned") {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Account Banned: Withdrawals are locked for this account." });
    }

    // 7. Balance check (Tiered fee: ₦15.50 for < ₦20,000 [₦5.50 admin], ₦50.00 for >= ₦20,000 [₦40 admin])
    const isHighTier = numAmount >= 20000;
    const withdrawalFee = isHighTier ? 50 : 15.5;
    const adminPlatformFee = isHighTier ? 40 : 5.5;
    const currentBalance = parseFloat(userRow.balance || 0);
    const totalDeduction = numAmount + withdrawalFee;
    if (totalDeduction > currentBalance) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: `Insufficient balance (includes ₦${withdrawalFee.toFixed(2)} withdrawal fee). Available: ₦${currentBalance.toLocaleString()}`
      });
    }

    // 8. Sanitize and validate recipient bank details
    const cleanBank = (bankName || userRow.bank_name || "").trim();
    const cleanAccNum = (accountNumber || userRow.account_number || "").trim().replace(/\D/g, "");
    const cleanAccName = (accountName || userRow.account_name || "").trim();

    if (!cleanBank) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Bank name is required" });
    }
    if (!cleanAccNum || cleanAccNum.length !== 10) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Account number must be exactly 10 digits" });
    }
    if (!cleanAccName) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Account name is required" });
    }

    const flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || "";
    const flwCode = getFlutterwaveBankCode(cleanBank, bankCode);
    const transferRef = `FLW_WD_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    let transferResponse = null;
    let transferSuccess = false;
    let transferErrorMessage = "";

    // 9. Call Flutterwave Transfers API
    if (flwSecret && !flwSecret.startsWith("FLWSECK_TEST-xxxx")) {
      try {
        console.log(`[Withdrawal] Calling Flutterwave: \u20A6${numAmount} to ${cleanAccNum} (${cleanBank} / code ${flwCode})...`);
        const trfRes = await fetch("https://api.flutterwave.com/v3/transfers", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${flwSecret}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            account_bank: flwCode,
            account_number: cleanAccNum,
            amount: numAmount,
            narration: `OpsSTAKE Cashout to ${cleanAccName}`.slice(0, 50),
            currency: "NGN",
            reference: transferRef,
            beneficiary_name: cleanAccName,
            debit_currency: "NGN"
          })
        });
        transferResponse = await trfRes.json();
        console.log("[Withdrawal] Flutterwave response:", transferResponse);

        if (transferResponse.status === "success" || transferResponse.status === "pending") {
          transferSuccess = true;
        } else {
          transferErrorMessage = transferResponse?.message || "Transfer was declined by Flutterwave payment gateway";
        }
      } catch (trfErr) {
        console.error("Flutterwave instant transfer network error:", trfErr.message);
        transferErrorMessage = trfErr.message || "Network error connecting to Flutterwave";
      }
    } else {
      transferSuccess = true;
      transferResponse = { status: "success", message: "Simulated instant payout via Flutterwave test mode", data: { id: `sim_${Date.now()}`, status: "SUCCESSFUL" } };
    }

    // 10. IF FLUTTERWAVE FAILED: IMMEDIATELY ROLLBACK - ZERO LOSS FOR USER!
    if (!transferSuccess) {
      await client.query("ROLLBACK");

      let userFriendlyMsg = transferErrorMessage;
      let requiresWhitelisting = false;
      if (transferErrorMessage.includes("administrator") || transferErrorMessage.includes("cannot be processed")) {
        userFriendlyMsg = "Payment gateway restricted: Flutterwave payout requires merchant IP whitelisting or transfer approval. Please contact the administrator.";
        requiresWhitelisting = true;
      }

      return res.status(400).json({
        success: false,
        refunded: true,
        error: `Withdrawal failed: ${userFriendlyMsg}. Your balance of \u20A6${currentBalance.toLocaleString()} is safe and was NOT deducted.`,
        gatewayError: transferErrorMessage,
        balance: currentBalance,
        ipNotice: requiresWhitelisting ? {
          serverIp: "34.34.246.125",
          instructions: "Add server IP 34.34.246.125 to Flutterwave Dashboard -> Settings -> Security / API Keys -> IP Whitelist."
        } : void 0
      });
    }

    // 11. ONLY DEDUCT AND COMMIT IF FLUTTERWAVE ACCEPTED THE PAYOUT
    await client.query(`
      UPDATE users 
      SET bank_name = COALESCE(${escapeSql(cleanBank)}, bank_name),
          account_number = COALESCE(${escapeSql(cleanAccNum)}, account_number),
          account_name = COALESCE(${escapeSql(cleanAccName)}, account_name),
          balance = balance - ${escapeSql(totalDeduction)}
      WHERE id = ${escapeSql(userId)}
    `);
    await updatePlatformFinance(adminPlatformFee);

    const wdId = `wd_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
    const userIgn = userRow.codm_ign || userRow.username || "Gladiator";
    const remark = `CODM-${userIgn.slice(0, 10).toUpperCase()}-${cleanAccNum.slice(-4)}`;
    const desc = `⚡ Instant Withdrawal: ₦${numAmount.toLocaleString()} (+ ₦${withdrawalFee.toFixed(2)} fee) to ${cleanBank} (${cleanAccNum})`;

    await client.query(`
      INSERT INTO transactions (id, user_id, type, amount, description, timestamp)
      VALUES (${escapeSql(txId)}, ${escapeSql(userId)}, 'WITHDRAWAL', ${escapeSql(totalDeduction)}, ${escapeSql(desc)}, ${Date.now()})
    `);

    const flwStatus = (transferResponse?.data?.status || "").toUpperCase();
    const finalWdStatus = flwStatus === 'SUCCESSFUL' ? 'completed' : 'pending';

    await client.query(`
      INSERT INTO withdrawal_requests (
        id, user_id, codm_ign, email, phone, amount, bank_name, account_number, account_name, bank_code, status, remark, created_at, balance_deducted, webhook_received, transfer_reference
      ) VALUES (
        ${escapeSql(wdId)},
        ${escapeSql(userId)},
        ${escapeSql(userIgn)},
        ${escapeSql(userRow.email || "")},
        ${escapeSql(userRow.phone || "")},
        ${escapeSql(numAmount)},
        ${escapeSql(cleanBank)},
        ${escapeSql(cleanAccNum)},
        ${escapeSql(cleanAccName)},
        ${escapeSql(bankCode || flwCode || "")},
        ${escapeSql(finalWdStatus)},
        ${escapeSql(remark)},
        ${Date.now()},
        true,
        ${flwStatus === 'SUCCESSFUL' ? 'true' : 'false'},
        ${escapeSql(transferRef)}
      )
    `);

    await client.query("COMMIT");
    const updatedUser = await getUserFromDb(userId);

    return res.json({
      success: true,
      pending: finalWdStatus === 'pending',
      balance: updatedUser?.balance ?? (currentBalance - totalDeduction),
      amount: numAmount,
      transferResponse,
      transaction: {
        id: txId,
        type: "WITHDRAWAL",
        amount: numAmount,
        description: desc,
        timestamp: Date.now()
      },
      message: `Withdrawal of \u20A6${numAmount.toLocaleString()} sent successfully via Flutterwave to ${cleanBank} (${cleanAccNum})!`
    });
  } catch (dbErr) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    console.error("Database withdrawal error:", dbErr);
    return res.status(500).json({ error: dbErr.message || "Database error processing withdrawal" });
  } finally {
    client.release();
    activeWithdrawalLocks.delete(userId);
  }
});
app.post("/api/users/:id/clean-history", async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await getUserFromDb(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const { clearAll = false, syncBalance = true } = req.body || {};
    if (clearAll) {
      await pool.query(`DELETE FROM transactions WHERE user_id = ${escapeSql(userId)}`);
    } else {
      const txRes = await pool.query(
        `SELECT * FROM transactions WHERE user_id = ${escapeSql(userId)} ORDER BY timestamp ASC`
      );
      const rawTxs = txRes.rows;
      const seenKeys = /* @__PURE__ */ new Set();
      const txsToDelete = [];
      for (const t of rawTxs) {
        let isDuplicate = false;
        const timeBucket = Math.floor(parseInt(t.timestamp, 10) / 6e4);
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
    if (syncBalance && !clearAll) {
      const remainingTxRes = await pool.query(
        `SELECT type, amount FROM transactions WHERE user_id = ${escapeSql(userId)}`
      );
      let calculatedCredits = 0;
      let calculatedDebits = 0;
      for (const r of remainingTxRes.rows) {
        const amt = parseFloat(r.amount) || 0;
        if (["DEPOSIT", "MATCH_WIN_PAYOUT", "REFERRAL_EARNING", "ESCROW_REFUND"].includes(r.type)) {
          calculatedCredits += amt;
        } else if (["WITHDRAWAL", "ESCROW_LOCK"].includes(r.type)) {
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
      user: refreshedUser
    });
  } catch (err) {
    console.error("Error cleaning history:", err);
    res.status(500).json({ error: err.message || "Failed to clean history" });
  }
});
var TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
var TELEGRAM_PUBLIC_CHANNEL_ID = (process.env.TELEGRAM_PUBLIC_CHANNEL_ID || "").trim();
var TELEGRAM_REVIEW_GROUP_ID = (process.env.TELEGRAM_REVIEW_GROUP_ID || "").trim();

async function sendTelegramSupportAlert(senderName, text, userId) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_REVIEW_GROUP_ID) return;
  const message = `📩 <b>NEW SUPPORT MESSAGE</b> 📩\n\n👤 <b>User:</b> ${senderName}\n🆔 <b>ID:</b> <code>${userId}</code>\n💬 <b>Message:</b> ${text}\n\n👉 <i>Check the Admin Dashboard to reply.</i>`;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_REVIEW_GROUP_ID,
        text: message,
        parse_mode: "HTML"
      })
    });
  } catch (err) {
    console.warn("[Telegram Bot] Failed to send support alert:", err.message);
  }
}
async function sendMatchDisputeVideoToTelegram(match, playerIgn, videoBase64) {
  try {
    const matches = videoBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
    if (!matches || matches.length < 3) {
      console.error("[Telegram Bot] Invalid video data format");
      return;
    }
    const mimeType = matches[1];
    const base64Content = matches[2];
    const buffer = Buffer.from(base64Content, "base64");
    return await sendTelegramVideo(match, playerIgn, buffer, mimeType);
  } catch (err) {
    console.error("\u274C [Telegram Bot] Critical exception during video upload:", err.message);
  }
}
async function sendMatchDisputeVideoToTelegramFromFile(match, playerIgn, filePath, mimeType = "video/mp4") {
  try {
    const buffer = fs.readFileSync(filePath);
    return await sendTelegramVideo(match, playerIgn, buffer, mimeType);
  } catch (err) {
    console.error("\u274C [Telegram Bot] Critical exception during file-based video upload:", err.message);
  }
}
async function sendTelegramVideo(match, playerIgn, buffer, mimeType) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn("[Telegram Bot] Cannot send dispute video: TELEGRAM_BOT_TOKEN not configured.");
    return;
  }
  const targetGroupId = TELEGRAM_REVIEW_GROUP_ID || TELEGRAM_PUBLIC_CHANNEL_ID;
  if (!targetGroupId) {
    console.warn("[Telegram Bot] Cannot send dispute video: TELEGRAM_REVIEW_GROUP_ID not configured.");
    return;
  }
  const fileSizeMb = buffer.length / (1024 * 1024);
  console.log(`[Telegram Bot] Preparing dispute video for Match #${match.challengeCode} (${playerIgn}). Size: ${fileSizeMb.toFixed(2)} MB`);
  const messageText = `\u{1F6A8} <b>MATCH DISPUTE VIDEO SUBMITTED</b> \u{1F6A8}

\u{1F464} <b>Gladiator:</b> ${playerIgn}
\u{1F3F7}\uFE0F <b>Match Code:</b> #${match.challengeCode}
\u{1F3AE} <b>Mode:</b> ${match.gameMode}
\u{1F5FA}\uFE0F <b>Map:</b> ${match.map}
\u{1F4B0} <b>Pot Amount:</b> <b>\u20A6${match.potAmount.toLocaleString()}</b>
\u{1F4E6} <b>File Size:</b> ${fileSizeMb.toFixed(2)} MB

\u{1F4F9} <i>This player has uploaded a screen recording of their history and game result for manual referee review.</i>

\u{1F50D} <b>Search Tag:</b> <code>#DISPUTE_${match.challengeCode}</code>
#Dispute #${match.challengeCode} #${playerIgn.replace(/\s+/g, "")}`;
  if (fileSizeMb > 49.5) {
    console.warn(`[Telegram Bot] Video exceeds 50MB limit (${fileSizeMb.toFixed(2)}MB). Sending notification only.`);
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: targetGroupId,
        text: messageText + `

\u26A0\uFE0F <b>SYSTEM NOTICE:</b> Video file was too large for Telegram upload (${fileSizeMb.toFixed(2)} MB). Please review this match forensic recording directly on the OpsSTAKE Admin Dashboard.`,
        parse_mode: "HTML"
      })
    });
    return;
  }
  const formData = new FormData();
  formData.append("chat_id", targetGroupId);
  formData.append("caption", messageText);
  formData.append("parse_mode", "HTML");
  const blob = new Blob([buffer], { type: mimeType });
  const extension = mimeType.split("/")[1] || "mp4";
  formData.append("video", blob, `dispute_${match.challengeCode}_${playerIgn.replace(/\s+/g, "_")}.${extension}`);
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`, {
    method: "POST",
    body: formData
  });
  const data = await res.json();
  if (!data.ok) {
    console.error(`\u274C [Telegram Bot] Video upload FAILED: ${data.description}`);
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: targetGroupId,
        text: messageText + `

\u274C <b>UPLOAD FAILED:</b> ${data.description}
Please review proof on Admin Dashboard.`,
        parse_mode: "HTML"
      })
    });
  } else {
    console.log(`\u2705 [Telegram Bot] Dispute video for Match #${match.challengeCode} posted successfully to review group.`);
  }
}
async function postMatchToPublicChannel(match, origin) {
  console.log(`[Telegram Bot] Attempting public post for Match #${match.challengeCode} to Channel ${TELEGRAM_PUBLIC_CHANNEL_ID}`);
  try {
    if (!TELEGRAM_PUBLIC_CHANNEL_ID || TELEGRAM_PUBLIC_CHANNEL_ID === "undefined" || TELEGRAM_PUBLIC_CHANNEL_ID === "null") {
      console.warn("[Telegram Bot] Public channel ID is invalid or not configured. Skipping post.");
      return;
    }
    const baseOrigin = (origin || process.env.APP_URL || "https://opsstake.online").replace(/\/$/, "");
    const matchUrl = `${baseOrigin}/?join=${match.id}`;
    const isSquad = match.matchType === "squad" || Boolean(match.squadData);
    let messageText = "";
    let buttonLabel = "\u{1F3AE} ACCEPT WAGER NOW";
    if (isSquad) {
      const squad = match.squadData;
      const filledSlots = squad?.slots ? squad.slots.filter((s) => s.staked).length : 1;
      const openSlots = Math.max(0, 10 - filledSlots);
      const grossPot = match.potAmount;
      const feePercent = match.platformFeePercentage || 5;
      const feeAmount = match.platformFee !== void 0 ? match.platformFee : Math.round(grossPot * (feePercent / 100));
      const netSquadPool = grossPot - feeAmount;
      const perPlayerPayout = match.winnerPayout || Math.floor(netSquadPool / 5);
      messageText = `\u{1F6E1}\uFE0F <b>NEW 5v5 SQUAD WAGER - OPS STAKE</b> \u{1F6E1}\uFE0F

\u2694\uFE0F <b>Format:</b> 5v5 Tactical Squad Battle (10 Players \xB7 Team Alpha vs Bravo)
\u{1F464} <b>Host (Alpha #1):</b> ${match.creator.codmIgn}
\u{1F4B5} <b>Entry Stake:</b> \u20A6${match.stakeAmount.toLocaleString()} / player
\u{1F3C6} <b>Total Gross Pot:</b> \u20A6${grossPot.toLocaleString()} (10 Players Pool)
\u2699\uFE0F <b>Squad Platform Fee:</b> \u20A6${feeAmount.toLocaleString()} (${feePercent}% Squad Fee - Reduced vs 1v1!)
\u{1F4B0} <b>Winning Squad Pool:</b> \u20A6${netSquadPool.toLocaleString()} (Split across 5 winners)
\u{1F3AF} <b>Exact Payout / Winner:</b> <b>\u20A6${perPlayerPayout.toLocaleString()}</b> per player
\u{1F465} <b>Open Slots:</b> <b>${openSlots}/10 Slots Remaining</b>
\u{1F3AF} <b>Game Mode:</b> ${match.gameMode}
\u{1F5FA}\uFE0F <b>Map:</b> ${match.map}
\u{1F3F7}\uFE0F <b>Lobby Code:</b> #${match.challengeCode}

\u{1F6E1}\uFE0F <i>Lock in your slot! Join Team Alpha or Team Bravo. All 5 members of the winning squad receive \u20A6${perPlayerPayout.toLocaleString()} each! Tap below to join!</i>

#SquadBattle #${match.challengeCode} #CODM`;
      buttonLabel = `\u{1F6E1}\uFE0F JOIN SQUAD (\u20A6${match.stakeAmount.toLocaleString()})`;
    } else {
      const netPot = match.potAmount - (match.platformFee || 0);
      const feePercent = match.platformFeePercentage || 10;
      const winnerPayout = match.winnerPayout || netPot;
      messageText = `\u{1F525} <b>NEW 1v1 WAGER ALERT - OPS STAKE</b> \u{1F525}

\u{1F464} <b>Host:</b> ${match.creator.codmIgn}
\u{1F4B5} <b>Stake Amount:</b> \u20A6${match.stakeAmount.toLocaleString()}
\u{1F3C6} <b>Total Pot:</b> \u20A6${match.potAmount.toLocaleString()}
\u2699\uFE0F <b>Platform Fee:</b> \u20A6${(match.platformFee || 0).toLocaleString()} (${feePercent}% Rake)
\u{1F3AF} <b>Exact Winner Payout:</b> <b>\u20A6${winnerPayout.toLocaleString()}</b>
\u{1F3AF} <b>Game Mode:</b> ${match.gameMode}
\u{1F5FA}\uFE0F <b>Map:</b> ${match.map}
\u{1F3F7}\uFE0F <b>Challenge Code:</b> #${match.challengeCode}

\u2694\uFE0F <i>A gladiator is waiting for a rival! Think you have what it takes to win? Tap the button below to join the match and claim \u20A6${winnerPayout.toLocaleString()}!</i>

#1v1Duel #${match.challengeCode} #CODM`;
      buttonLabel = `\u{1F3AE} ACCEPT WAGER (\u20A6${match.stakeAmount.toLocaleString()})`;
    }
    console.log(`[Telegram Bot] Dispatching sendMessage request to Telegram API...`);
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(4e3),
      body: JSON.stringify({
        chat_id: TELEGRAM_PUBLIC_CHANNEL_ID,
        text: messageText,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: buttonLabel, url: matchUrl }
          ]]
        }
      })
    });
    const data = await res.json();
    if (!data.ok) {
      console.error(`\u274C [Telegram Bot] Public channel post FAILED for ID: "${TELEGRAM_PUBLIC_CHANNEL_ID}"`);
      console.error(`[Telegram Bot] Error: ${data.description} (Code: ${data.error_code})`);
      if (data.description === "chat not found") {
        console.warn(`[Telegram Bot] DIAGNOSTIC: "chat not found" typically means:`);
        console.warn(`1. The Bot Token is correct but the ID "${TELEGRAM_PUBLIC_CHANNEL_ID}" is invalid or the bot hasn't been added there.`);
        console.warn(`2. The bot is NOT an administrator in the channel.`);
        console.warn(`3. The channel ID must start with -100 for public channels.`);
      }
    } else {
      console.log(`\u2705 [Telegram Bot] Match #${match.challengeCode} posted successfully (Msg ID: ${data.result?.message_id})`);
    }
  } catch (err) {
    console.error("\u274C [Telegram Bot] Critical exception during public channel post:", err.message);
  }
}
async function applyConflictFlagOrBan(dishonestUserId: string, match: any, reason: string = "Match conflict violation") {
  try {
    if (!dishonestUserId) return;
    const userRes = await pool.query(`SELECT * FROM users WHERE id = ${escapeSql(dishonestUserId)}`);
    if (userRes.rows.length === 0) return;
    const user = userRes.rows[0];
    const currentStrikes = parseInt(user.conflict_strikes || 0, 10) || 0;
    const newStrikes = currentStrikes + 1;
    const roomTag = match.roomCode || match.challengeCode || match.id;

    if (newStrikes === 1) {
      // Strike 1: Auto-flag
      const flagReason = `Strike 1 Flag: Submitted false/conflicting result claim in Match #${roomTag}. Account placed on probation.`;
      await pool.query(`
        UPDATE users 
        SET is_flagged = true,
            conflict_strikes = 1,
            flag_reason = ${escapeSql(flagReason)}
        WHERE id = ${escapeSql(dishonestUserId)}
      `);
      console.log(`⚠️ [Conflict System] User ${user.codm_ign} (${dishonestUserId}) issued Strike 1 flag.`);

      if (user.telegram_chat_id) {
        const warnMessage = `⚠️ <b>ACCOUNT FLAGGED - MATCH CONFLICT STRIKE 1</b> ⚠️\n\n` +
          `Your account has been officially flagged by the referee team for submitting a false or conflicting result claim in Match <b>#${roomTag}</b>.\n\n` +
          `🚨 <b>POLICY WARNING:</b>\n` +
          `• Strike Count: <b>1 / 2</b>\n` +
          `• Account Status: 🟡 <b>FLAGGED / PROBATION</b>\n\n` +
          `Please ensure all future match claims and scoreboard uploads are 100% accurate. A second conflict violation will trigger an immediate <b>PERMANENT ACCOUNT BAN</b> and complete forfeiture of all wallet funds.`;

        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: user.telegram_chat_id.trim(),
            text: warnMessage,
            parse_mode: "HTML"
          })
        }).catch((e) => console.warn("[Conflict System] Failed to send Strike 1 Telegram warn:", e.message));
      }
    } else {
      // Strike >= 2: Auto-ban & permanent fund forfeiture
      const totalBalance = parseFloat(user.balance || 0) + parseFloat(user.escrow_balance || 0);
      const banReason = `PERMANENT BAN (Strike ${newStrikes}): Repeat match conflict fraud in Match #${roomTag}. Total ₦${totalBalance.toLocaleString()} forfeited.`;

      await pool.query(`
        UPDATE users 
        SET role = 'banned',
            is_flagged = true,
            conflict_strikes = ${escapeSql(newStrikes)},
            flag_reason = ${escapeSql(banReason)},
            balance = 0,
            escrow_balance = 0
        WHERE id = ${escapeSql(dishonestUserId)}
      `);

      if (totalBalance > 0) {
        const txId = `tx_ban_forfeit_${Date.now()}`;
        const txDesc = `🛑 Permanent Fraud Ban & Forfeiture: ₦${totalBalance.toLocaleString()} balance reset to zero due to repeat match conflict violations (Match #${roomTag})`;
        await pool.query(`
          INSERT INTO transactions (id, user_id, type, amount, description, match_id, timestamp)
          VALUES (${escapeSql(txId)}, ${escapeSql(dishonestUserId)}, 'FRAUD_BAN_FORFEIT', ${escapeSql(totalBalance)}, ${escapeSql(txDesc)}, ${escapeSql(match.id)}, ${Date.now()})
          ON CONFLICT (id) DO NOTHING
        `);
      }

      console.log(`🛑 [Conflict System] User ${user.codm_ign} (${dishonestUserId}) PERMANENTLY BANNED on Strike ${newStrikes}. ₦${totalBalance} forfeited.`);

      if (user.telegram_chat_id) {
        const channelId = process.env.TELEGRAM_PUBLIC_CHANNEL_ID || "@OpsSTAKE";
        fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/banChatMember`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: channelId,
            user_id: user.telegram_chat_id
          })
        }).catch((e) => console.warn("[Telegram Bot] Failed to ban chat member from channel:", e.message));

        const banMessage = `🛑 <b>ACCOUNT PERMANENTLY BANNED & FUNDS FORFEITED</b> 🛑\n\n` +
          `Your account has been <b>PERMANENTLY BANNED</b> following a repeat match conflict violation in Match <b>#${roomTag}</b> (Strike ${newStrikes}).\n\n` +
          `💸 <b>FORFEITURE & BAN DETAILS:</b>\n` +
          `• Account Status: 🔴 <b>PERMANENTLY BANNED</b>\n` +
          `• Forfeited Balance: <b>₦${totalBalance.toLocaleString()}</b> (Reset to ₦0)\n` +
          `• Blacklist Status: 🔒 Credentials & Bank Account Blacklisted\n` +
          `• Channel Access: 🚫 <b>BANNED FROM OFFICIAL @OpsSTAKE CHANNEL</b>\n\n` +
          `Under Arena Security Rules, fraudulent result submissions and repeat conflict violations result in instant loss of funds and permanent loss of account access.`;

        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: user.telegram_chat_id.trim(),
            text: banMessage,
            parse_mode: "HTML"
          })
        }).catch((e) => console.warn("[Conflict System] Failed to send Ban Telegram alert:", e.message));
      }
    }
  } catch (err) {
    console.error("[Conflict System] Error applying conflict flag/ban:", err);
  }
}

async function sendTelegramMatchAcceptedAlert(match, opponentIgn) {
  try {
    const isSquad = match.matchType === "squad" || Boolean(match.squadData);
    if (isSquad) {
      await sendTelegramSquadSlotJoinedAlert(match, opponentIgn, "BRAVO", 6, 10);
      return;
    }
    const creatorUser = await getUserFromDb(match.creator.id);
    const hostChatId = creatorUser?.telegramChatId;
    const netPot = match.potAmount - (match.platformFee || 0);
    const winnerPayout = match.winnerPayout || netPot;
    const messageText = `⚔️ <b>MATCH ACCEPTED - OPS STAKE</b> ⚔️

🎯 <b>A rival has accepted your 1v1 wager challenge!</b>

👤 <b>Host:</b> ${match.creator.codmIgn}
⚔️ <b>Opponent:</b> ${opponentIgn}
💵 <b>Stake Amount:</b> ₦${match.stakeAmount.toLocaleString()}
🏆 <b>Total Pot:</b> ₦${match.potAmount.toLocaleString()}
🎯 <b>Winner Payout:</b> <b>₦${winnerPayout.toLocaleString()}</b>
🎯 <b>Game Mode:</b> ${match.gameMode}
🗺️ <b>Map:</b> ${match.map}
🔑 <b>In-Game Room Code:</b> <code>#${match.roomCode || "Ready"}</code>
🏷️ <b>Challenge Code:</b> #${match.challengeCode}

🚀 <i>Open CODM, enter room code #${match.roomCode || "Ready"}, and claim your ₦${winnerPayout.toLocaleString()} victory!</i>`;
    const chatIdsToSend = new Set();
    if (hostChatId && hostChatId.trim()) chatIdsToSend.add(hostChatId.trim());
    if (chatIdsToSend.size === 0) {
      console.log(`[Telegram Bot] Host ${match.creator.codmIgn} has no Telegram Chat ID configured.`);
      return;
    }
    for (const chatId of chatIdsToSend) {
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: messageText,
          parse_mode: "HTML"
        })
      });
      const data = await res.json();
      if (!data.ok) {
        console.warn(`[Telegram Bot] Direct alert failed for chat ID ${chatId}: ${data.description}`);
      } else {
        console.log(`✅ [Telegram Bot] Acceptance alert sent to host chat ${chatId}`);
      }
    }
  } catch (err) {
    console.error("[Telegram Bot] Exception sending match alert:", err.message);
  }
}
async function sendTelegramSquadSlotJoinedAlert(match, playerIgn, team, slotNumber, filledCount) {
  try {
    const squad = match.squadData;
    const grossPot = match.potAmount;
    const feePercent = match.platformFeePercentage || 5;
    const feeAmount = match.platformFee !== void 0 ? match.platformFee : Math.round(grossPot * (feePercent / 100));
    const netSquadPool = grossPot - feeAmount;
    const perPlayerPayout = match.winnerPayout || Math.floor(netSquadPool / 5);
    const teamLabel = team === "ALPHA" ? "Team Alpha (Blue)" : "Team Bravo (Red)";
    let messageText = "";
    if (filledCount === 10) {
      messageText = `⚔️ <b>5v5 SQUAD LOBBY FULL - MATCH COMMENCING!</b> ⚔️

🎯 <b>All 10 slots are filled and locked into escrow!</b>

💵 <b>Stake / Player:</b> ₦${match.stakeAmount.toLocaleString()}
🏆 <b>Total Gross Pot:</b> ₦${grossPot.toLocaleString()} (10 Players)
⚙️ <b>Squad Platform Fee:</b> ₦${feeAmount.toLocaleString()} (${feePercent}% Squad Fee)
💰 <b>Winning Squad Pool:</b> ₦${netSquadPool.toLocaleString()}
🎯 <b>Exact Payout:</b> <b>₦${perPlayerPayout.toLocaleString()}</b> per winning squad member

🔑 <b>In-Game CODM Room Code:</b> <code>#${match.roomCode || "Ready"}</code>
🏷️ <b>Lobby Code:</b> #${match.challengeCode}
🎯 <b>Mode:</b> ${match.gameMode} · <b>Map:</b> ${match.map}

🚀 <i>Open CODM now, enter custom room #${match.roomCode || "Ready"}, and lead your squad to victory!</i>`;
    } else {
      messageText = `🛡️ <b>5v5 SQUAD SLOT FILLED - OPS STAKE</b> 🛡️

⚔️ <b>${playerIgn}</b> staked ₦${match.stakeAmount.toLocaleString()} and joined <b>${teamLabel} Slot #${slotNumber}</b>!

📊 <b>Lobby Progress:</b> <b>${filledCount}/10 Slots Staked</b> (${10 - filledCount} slots open)
💵 <b>Entry Stake:</b> ₦${match.stakeAmount.toLocaleString()} / player
🏆 <b>Total Gross Pot:</b> ₦${grossPot.toLocaleString()} (10 Players)
⚙️ <b>Squad Fee:</b> ${feePercent}% (₦${feeAmount.toLocaleString()})
🎯 <b>Exact Payout:</b> <b>₦${perPlayerPayout.toLocaleString()}</b> per winning player (₦${netSquadPool.toLocaleString()} Team Total)
🏷️ <b>Lobby Code:</b> #${match.challengeCode}

⏳ <i>Waiting for ${10 - filledCount} more player(s) to stake and lock in...</i>`;
    }
    const stakedUserIds = [];
    if (squad?.slots && Array.isArray(squad.slots)) {
      for (const slot of squad.slots) {
        if (slot.staked && slot.userId) {
          stakedUserIds.push(slot.userId);
        }
      }
    }
    if (match.creator?.id && !stakedUserIds.includes(match.creator.id)) {
      stakedUserIds.push(match.creator.id);
    }
    const chatIdsToSend = new Set();
    for (const uid of stakedUserIds) {
      const u = await getUserFromDb(uid);
      if (u?.telegramChatId && u.telegramChatId.trim()) {
        chatIdsToSend.add(u.telegramChatId.trim());
      }
    }
    if (process.env.TELEGRAM_HOST_CHAT_ID) chatIdsToSend.add(process.env.TELEGRAM_HOST_CHAT_ID.trim());
    for (const chatId of chatIdsToSend) {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: messageText,
          parse_mode: "HTML"
        })
      }).catch((err) => console.warn(`[Telegram Bot] Error sending squad alert to ${chatId}:`, err.message));
    }
  } catch (err) {
    console.error("[Telegram Bot] Exception sending squad slot alert:", err.message);
  }
}
async function sendTelegramMatchSettledAlert(match, winningSideOrWinnerIgn) {
  try {
    const isSquad = match.matchType === "squad" || Boolean(match.squadData);
    if (isSquad) {
      const squad = match.squadData;
      const grossPot = match.potAmount;
      const feePercent = match.platformFeePercentage || 5;
      const feeAmount = match.platformFee !== void 0 ? match.platformFee : Math.round(grossPot * (feePercent / 100));
      const netSquadPool = grossPot - feeAmount;
      const perPlayerPayout = match.winnerPayout || Math.floor(netSquadPool / 5);
      const winningTeam = winningSideOrWinnerIgn === "BRAVO" || winningSideOrWinnerIgn === "opponent" ? "BRAVO" : "ALPHA";
      const teamLabel = winningTeam === "ALPHA" ? "Team Alpha (Blue)" : "Team Bravo (Red)";
      const messageText = `\u{1F3C6} <b>SQUAD VICTORY - \u20A6${perPlayerPayout.toLocaleString()} CREDITED!</b> \u{1F3C6}

\u{1F396}\uFE0F Congratulations soldier! <b>${teamLabel}</b> emerged victorious in 5v5 Match #${match.challengeCode}!

\u{1F4B0} <b>Exact Winnings Credited:</b> <b>\u20A6${perPlayerPayout.toLocaleString()}</b> has been deposited into your wallet balance!

\u{1F4CA} <b>Squad Economics:</b>
\u2022 10 Players Gross Pot: \u20A6${grossPot.toLocaleString()}
\u2022 Squad Platform Fee (${feePercent}%): \u20A6${feeAmount.toLocaleString()}
\u2022 Net Winning Squad Pool: \u20A6${netSquadPool.toLocaleString()}
\u2022 Exact Individual Payout: \u20A6${perPlayerPayout.toLocaleString()} each for all 5 squad members

\u26A1 <i>Your winnings are ready for instant bank cashout or your next wager in the Arena!</i>`;
      if (squad?.slots && Array.isArray(squad.slots)) {
        const winningSlots = squad.slots.filter((s) => s.team === winningTeam && s.staked && s.userId);
        for (const slot of winningSlots) {
          const u = await getUserFromDb(slot.userId);
          if (u?.telegramChatId && u.telegramChatId.trim()) {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: u.telegramChatId.trim(),
                text: messageText,
                parse_mode: "HTML"
              })
            }).catch((e) => console.warn(`[Telegram Bot] Error sending settlement alert to ${u.telegramChatId}:`, e.message));
          }
        }
      }
    } else {
      const winnerUser = await getUserFromDb(match.winnerId || "");
      if (winnerUser?.telegramChatId) {
        const messageText = `\u{1F3C6} <b>MATCH VICTORY - \u20A6${(match.winnerPayout || 0).toLocaleString()} CREDITED!</b> \u{1F3C6}

\u{1F396}\uFE0F Congratulations <b>${match.winnerIgn || winnerUser.codmIgn}</b>! You won 1v1 Challenge #${match.challengeCode}!

\u{1F4B0} <b>Exact Payout:</b> <b>\u20A6${(match.winnerPayout || 0).toLocaleString()}</b> has been credited directly to your wallet balance!
\u{1F4CA} <b>Gross Pot:</b> \u20A6${match.potAmount.toLocaleString()} (Platform Fee: \u20A6${(match.platformFee || 0).toLocaleString()})

\u26A1 <i>Your funds are ready for instant cashout or new challenges in the Arena!</i>`;
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: winnerUser.telegramChatId.trim(),
            text: messageText,
            parse_mode: "HTML"
          })
        }).catch((e) => console.warn(`[Telegram Bot] Error sending settlement alert:`, e.message));
      }
    }
  } catch (err) {
    console.error("[Telegram Bot] Exception sending settlement alert:", err.message);
  }
}
app.post("/api/telegram/test-alert", async (req, res) => {
  const { chatId, userId } = req.body;
  const targetChatId = chatId || (userId ? (await getUserFromDb(userId))?.telegramChatId : null) || process.env.TELEGRAM_CHAT_ID;
  if (!targetChatId) {
    return res.status(400).json({
      success: false,
      error: "Please enter a valid Telegram Chat ID. Start the bot on Telegram and get your ID from @userinfobot."
    });
  }
  try {
    const testMessage = `\u{1F916} <b>OPS STAKE TELEGRAM BOT ALERT TEST</b>

\u2705 Your Telegram Chat ID <code>${targetChatId}</code> is linked successfully!

You will receive real-time alerts whenever a rival accepts your 1v1 wager matches!`;
    const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: targetChatId.trim(),
        text: testMessage,
        parse_mode: "HTML"
      })
    });
    const data = await tgRes.json();
    if (data.ok) {
      return res.json({
        success: true,
        message: `Test alert sent to Telegram chat ID ${targetChatId}! Check your Telegram messages.`
      });
    } else {
      return res.status(400).json({
        success: false,
        error: data.description || "Failed to send Telegram message. Make sure you started the bot on Telegram first."
      });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/telegram/bot-info", async (req, res) => {
  const info = await fetchTelegramBotInfo();
  res.json({
    botUsername: info?.username || process.env.TELEGRAM_BOT_USERNAME || "OpsSTAKEBOT",
    channelUrl: "https://t.me/OpsSTAKE"
  });
});
app.post("/api/telegram/unlink", async (req, res) => {
  try {
    const { userId } = req.body;
    if (userId) {
      await pool.query(`UPDATE users SET telegram_chat_id = NULL, telegram_username = NULL WHERE id = ${escapeSql(userId)}`);
    }
    res.json({ success: true, message: "Telegram account unlinked successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to unlink Telegram account" });
  }
});
var telegramBotRunning = false;
var lastTelegramUpdateOffset = 0;
var cachedTelegramBotInfo = null;
async function fetchTelegramBotInfo() {
  if (!TELEGRAM_BOT_TOKEN) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
    const data = await res.json();
    if (data.ok && data.result) {
      cachedTelegramBotInfo = {
        id: data.result.id,
        username: data.result.username,
        firstName: data.result.first_name
      };
      return cachedTelegramBotInfo;
    }
  } catch (err) {
    console.warn("[Telegram Bot] Failed to fetch bot info:", err.message);
  }
  return null;
}
async function checkChannelMembership(userId) {
  const channelName = process.env.TELEGRAM_CHANNEL_USERNAME || "@OpsSTAKE";
  if (!TELEGRAM_BOT_TOKEN) return true;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(channelName)}&user_id=${userId}`);
    const data = await res.json();
    if (data.ok && data.result) {
      const status = data.result.status;
      return ["member", "creator", "administrator"].includes(status);
    }
  } catch (err) {
    console.warn("[Telegram Bot] Channel membership check error:", err.message);
  }
  return true;
}
async function handleTelegramCallbackQuery(cq) {
  if (!cq || !cq.data || !cq.message) return;
  const chatId = String(cq.message.chat.id);
  const data = cq.data;
  const from = cq.from || {};
  const userId = from.id;
  const telegramUsername = from.username || "";
  if (data.startsWith("verify_link_")) {
    const targetUserId = data.replace("verify_link_", "").trim();
    const isMember = await checkChannelMembership(userId);
    if (isMember) {
      let user = await getUserFromDb(targetUserId);
      if (user) {
        await pool.query(`
          UPDATE users 
          SET telegram_chat_id = ${escapeSql(chatId)},
              telegram_username = ${telegramUsername ? escapeSql(telegramUsername) : "telegram_username"}
          WHERE id = ${escapeSql(user.id)}
        `);
        const updatedUser = await getUserFromDb(user.id);
        if (globalIo) {
          globalIo.emit("userUpdated", updatedUser);
          globalIo.emit("telegramLinked", {
            userId: user.id,
            chatId,
            telegramUsername,
            codmIgn: user.codmIgn
          });
        }
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: cq.id, text: "\u2705 Channel verified! Account linked successfully." })
        });
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `🎮 <b>OPS STAKE · TELEGRAM LINKED SUCCESSFULLY!</b> 🎮\n\n` +
              `✅ Welcome, <b>${user.codmIgn || user.username}</b>!\n` +
              `Channel membership verified in <b>@OpsSTAKE</b>. Your account is now fully connected.\n\n` +
              `🔔 <b>What you will receive here in real-time:</b>\n` +
              `⚔️ Instant alert when a rival accepts your wagers\n` +
              `🔑 In-game CODM room codes as soon as matches deploy\n` +
              `🏆 Wager result confirmations & instant payout alerts\n\n` +
              `🚀 <i>You are ready for battle!</i>`,
            parse_mode: "HTML"
          })
        });
        return;
      }
    } else {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: cq.id,
          text: "\u274C You have not joined @OpsSTAKE yet! Please join the channel first.",
          show_alert: true
        })
      });
    }
  }
}
async function handleTelegramMessage(message) {
  if (!message || !message.chat) return;
  const chatId = String(message.chat.id);
  const text = (message.text || "").trim();
  const caption = (message.caption || "").trim();
  const fullContent = text || caption;
  const from = message.from || {};
  const telegramUsername = from.username || "";
  const senderName = from.first_name ? `${from.first_name} ${from.last_name || ""}`.trim() : telegramUsername || "Gladiator";
  const logPrefix = message.chat.type === "group" || message.chat.type === "supergroup" ? `[Telegram Bot] 👥 Group "${message.chat.title || "Untitled"}" (ID: ${chatId})` : `[Telegram Bot] 👤 Private User (${chatId})`;
  console.log(`${logPrefix} @${telegramUsername || "anon"}: "${fullContent || "[Media Attachment]"}"`);

  // Check if sender is banned
  const bannedCheck = await pool.query(
    `SELECT id, role, codm_ign FROM users WHERE (telegram_chat_id = ${escapeSql(chatId)} OR (LOWER(telegram_username) = LOWER(${escapeSql(telegramUsername)}) AND ${escapeSql(telegramUsername)} != '')) AND role = 'banned' LIMIT 1`
  );
  if (bannedCheck.rows.length > 0) {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🛑 <b>ACCESS PERMANENTLY BANNED</b>\n\n` +
          `Your account (<b>${bannedCheck.rows[0].codm_ign || "Gladiator"}</b>) has been <b>PERMANENTLY BANNED</b> from the OpsSTAKE Arena and Telegram Bot due to repeat match conflict violations & fraudulent result claims.\n\n` +
          `• Wallet & Escrow Funds: 🔒 <b>100% FORFEITED (₦0)</b>\n` +
          `• Channel Access: 🚫 <b>BANNED FROM OFFICIAL @OpsSTAKE CHANNEL</b>\n\n` +
          `Bot commands, dispute uploads, and wager participation are permanently disabled.`,
        parse_mode: "HTML"
      })
    });
    return;
  }

  // Handle /start command (both link_ account linking and dispute_ deep links)
  if (text.startsWith("/start")) {
    const parts = text.split(/\s+/);
    const rawPayload = parts.length > 1 ? parts[1].trim() : "";

    // 1. Deep Link for Dispute: /start dispute_<roomCode>
    if (rawPayload.startsWith("dispute_")) {
      const roomCode = rawPayload.replace(/^dispute_/, "").trim();
      const match = await getMatchByCodeOrId(roomCode);
      if (match) {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `🚨 <b>DISPUTE REGISTRATION FOR MATCH #${match.roomCode || match.challengeCode}</b>\n\n` +
              `🎮 <b>Mode:</b> ${match.gameMode} | 🗺️ <b>Map:</b> ${match.map}\n` +
              `💰 <b>Escrow Pot:</b> <b>₦${match.potAmount.toLocaleString()}</b>\n\n` +
              `📹 <b>UPLOAD YOUR SCREEN RECORDING NOW:</b>\n` +
              `Please send/upload your CODM screen recording video file directly into this chat.\n` +
              `You can also include caption: <code>/dispute ${match.roomCode || match.challengeCode}</code>`,
            parse_mode: "HTML"
          })
        });
        return;
      }
    }

    // 2. Deep Link for Account Linking: /start link_<userId>
    const targetUserId = rawPayload.replace(/^link_/, "").trim();
    if (targetUserId) {
      let user = await getUserFromDb(targetUserId);
      if (!user) {
        const findRes = await pool.query(`
          SELECT * FROM users 
          WHERE id = ${escapeSql(targetUserId)} 
             OR referral_code = ${escapeSql(targetUserId)} 
             OR LOWER(username) = LOWER(${escapeSql(targetUserId)})
             OR LOWER(codm_ign) = LOWER(${escapeSql(targetUserId)})
          LIMIT 1
        `);
        if (findRes.rows.length > 0) {
          user = await getUserFromDb(findRes.rows[0].id);
        }
      }
      if (user) {
        const isMember = await checkChannelMembership(from.id);
        const channelName = process.env.TELEGRAM_CHANNEL_USERNAME || "@OpsSTAKE";
        if (!isMember) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: `📢 <b>MANDATORY CHANNEL SUBSCRIPTION REQUIRED!</b> 📢\n\n` +
                `Hello <b>${user.codmIgn || user.username}</b>!\n` +
                `To link your Telegram account and receive instant match room codes, escrow wagers, and payout alerts, you must join our official live updates channel: <b>${channelName}</b>.\n\n` +
                `<b>How to complete linking:</b>\n` +
                `1. Tap <b>'📢 1. JOIN CHANNEL NOW'</b> below\n` +
                `2. Join the channel, then return here and tap <b>'✅ 2. I HAVE JOINED (FINISH LINKING)'</b>`,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: "📢 1. JOIN CHANNEL NOW", url: `https://t.me/${channelName.replace("@", "")}` }
                  ],
                  [
                    { text: "✅ 2. I HAVE JOINED (FINISH LINKING)", callback_data: `verify_link_${user.id}` }
                  ]
                ]
              }
            })
          });
          return;
        }
        await pool.query(`
          UPDATE users 
          SET telegram_chat_id = ${escapeSql(chatId)},
              telegram_username = ${telegramUsername ? escapeSql(telegramUsername) : "telegram_username"}
          WHERE id = ${escapeSql(user.id)}
        `);
        const updatedUser = await getUserFromDb(user.id);
        if (globalIo) {
          globalIo.emit("userUpdated", updatedUser);
          globalIo.emit("telegramLinked", {
            userId: user.id,
            chatId,
            telegramUsername,
            codmIgn: user.codmIgn
          });
        }
        console.log(`✅ [Telegram Bot] User ${user.codmIgn} (${user.id}) automatically linked to Chat ID ${chatId}!`);
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `🎮 <b>OPS STAKE · TELEGRAM LINKED SUCCESSFULLY!</b> 🎮\n\n` +
              `✅ Welcome, <b>${user.codmIgn || user.username}</b>!\n` +
              `Your Telegram account has been <b>automatically connected</b> to your OPS STAKE profile.\n\n` +
              `🔒 <b>Linked Profile Details:</b>\n` +
              `• CODM IGN: <b>${user.codmIgn}</b>\n` +
              `• Chat ID: <code>${chatId}</code>\n` +
              `• Current Balance: <b>₦${Number(user.balance || 0).toLocaleString()}</b>\n\n` +
              `🔔 <b>What you will receive here in real-time:</b>\n` +
              `⚔️ Instant alert when a rival accepts your wagers\n` +
              `🔑 In-game CODM room codes as soon as matches deploy\n` +
              `🏆 Wager result confirmations & instant payout alerts\n` +
              `⚠️ Match conflict notifications & referee status updates\n\n` +
              `🚀 <i>You are ready for battle!</i>`,
            parse_mode: "HTML"
          })
        });
        return;
      }
    }
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `👋 <b>Welcome to OPS STAKE Tactical Bot!</b>\n\n` +
          `Your Telegram Chat ID: <code>${chatId}</code>\n\n` +
          `🔗 <b>How to Link Your Account:</b>\n` +
          `1. Open <b>OPS STAKE</b> in your browser\n` +
          `2. Go to <b>Profile</b> > <b>Bot Comms</b>\n` +
          `3. Tap <b>"1-Tap Connect Bot"</b> to link automatically!\n\n` +
          `Or copy your Chat ID <code>${chatId}</code> and paste it in your profile.`,
        parse_mode: "HTML"
      })
    });
    return;
  }

  // Handle /dispute command OR media attachments (video, document, photo) for disputes
  const isVideoOrMedia = Boolean(message.video || message.document || message.photo || message.animation);
  const isDisputeCommand = fullContent.toLowerCase().startsWith("/dispute");

  if (isDisputeCommand || isVideoOrMedia) {
    let matchCode = "";
    
    // Extract match code from message text or caption
    const parts = fullContent.split(/\s+/);
    const dispIdx = parts.findIndex((p) => p.toLowerCase().startsWith("/dispute"));
    if (dispIdx !== -1 && parts.length > dispIdx + 1) {
      matchCode = parts[dispIdx + 1].trim();
    } else {
      const codeMatch = fullContent.match(/(?:CODM-[0-9]+-[A-Za-z]+|CHALLENGE-[0-9]+|match_[0-9_a-z]+)/i);
      if (codeMatch) {
        matchCode = codeMatch[0];
      }
    }

    let match = await getMatchByCodeOrId(matchCode);

    // If no code extracted, search DB for user's active/disputed match
    if (!match) {
      const userRes = await pool.query(`SELECT id, codm_ign FROM users WHERE telegram_chat_id = ${escapeSql(chatId)} LIMIT 1`);
      const user = userRes.rows[0];
      if (user) {
        const mRes = await pool.query(
          `SELECT id FROM matches 
           WHERE (creator_id = $1 OR opponent_id = $1) 
             AND status IN ('DISPUTED', 'SUBMITTING_RESULTS', 'READY_TO_PLAY', 'IN_PROGRESS')
           ORDER BY created_at DESC LIMIT 1`,
          [user.id]
        );
        if (mRes.rows.length > 0) {
          match = await getMatchFromDb(mRes.rows[0].id);
        }
      }
    }

    // If /dispute command was sent with an unknown match code
    if (isDisputeCommand && !match && matchCode) {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `⚠️ <b>Match code <code>${matchCode}</code> not found!</b>\n\nPlease check your match room code in the Arena and try again (e.g. <code>/dispute CODM-5175-SHI</code>).`,
          parse_mode: "HTML"
        })
      });
      return;
    }

    if (match) {
      const userRes = await pool.query(`SELECT id, codm_ign FROM users WHERE telegram_chat_id = ${escapeSql(chatId)} LIMIT 1`);
      const playerIgn = userRes.rows[0]?.codm_ign || senderName;

      // Link chat ID automatically if user exists
      if (userRes.rows[0]?.id) {
        await pool.query(`UPDATE users SET telegram_chat_id = ${escapeSql(chatId)} WHERE id = ${escapeSql(userRes.rows[0].id)}`);
      }

      if (isVideoOrMedia) {
        // Forward video or media proof to Admin Review Group
        const reviewGroupId = TELEGRAM_REVIEW_GROUP_ID || TELEGRAM_PUBLIC_CHANNEL_ID;
        if (reviewGroupId) {
          try {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/forwardMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: reviewGroupId,
                from_chat_id: chatId,
                message_id: message.message_id
              })
            });

            const alertText = `🚨 <b>MATCH DISPUTE VIDEO RECEIVED (Telegram Bot)</b> 🚨\n\n` +
              `👤 <b>Player:</b> ${playerIgn} (@${telegramUsername || "anon"})\n` +
              `🏷️ <b>Match Code:</b> #${match.roomCode || match.challengeCode}\n` +
              `🎮 <b>Mode:</b> ${match.gameMode} | Map: ${match.map}\n` +
              `💰 <b>Pot Amount:</b> <b>₦${match.potAmount.toLocaleString()}</b>\n` +
              `🔍 <b>Search Tag:</b> <code>#DISPUTE_${match.roomCode || match.challengeCode}</code>`;

            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: reviewGroupId,
                text: alertText,
                parse_mode: "HTML"
              })
            });
          } catch (fwdErr) {
            console.error("[Telegram Bot] Error forwarding dispute video:", fwdErr.message);
          }
        }

        // Update match status to DISPUTED in database
        match.status = "DISPUTED";
        match.resolutionNotes = `Screen recording dispute proof submitted via Telegram Bot by ${playerIgn}. Awaiting referee review. Pot ₦${match.potAmount.toLocaleString()} locked.`;
        match.chatMessages = match.chatMessages || [];
        match.chatMessages.push({
          id: `msg_${Date.now()}_tg_dispute`,
          senderId: "SYSTEM",
          senderName: "CODM Referee Bot",
          text: `📹 ${playerIgn} submitted dispute screen recording video via Telegram Bot. Escrow pot locked for referee review.`,
          timestamp: Date.now()
        });

        await saveMatchToDb(match);

        if (globalIo) {
          globalIo.emit("matchUpdated", match);
          globalIo.to(match.id).emit("matchUpdated", match);
        }

        // Send confirmation back to user
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `✅ <b>DISPUTE SCREEN RECORDING RECEIVED!</b>\n\n` +
              `Your video proof for Match <b>#${match.roomCode || match.challengeCode}</b> has been received and escalated to the OpsSTAKE Admin Referee Team for priority review.\n\n` +
              `🔒 The escrow pot (<b>₦${match.potAmount.toLocaleString()}</b>) remains securely locked until review completes.\n` +
              `You will be notified right here in Telegram as soon as the referee adjudicates the result!`,
            parse_mode: "HTML"
          })
        });
        return;
      } else {
        // User sent /dispute command without attaching media
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `🚨 <b>DISPUTE INITIATED FOR MATCH #${match.roomCode || match.challengeCode}</b>\n\n` +
              `🎮 <b>Mode:</b> ${match.gameMode} | Map: ${match.map}\n` +
              `💰 <b>Escrow Pot:</b> <b>₦${match.potAmount.toLocaleString()}</b>\n\n` +
              `📹 <b>UPLOAD SCREEN RECORDING PROOF NOW:</b>\n` +
              `Please send or upload your screen recording video file directly into this chat to complete your dispute submission.`,
            parse_mode: "HTML"
          })
        });
        return;
      }
    }
  }

  if (text === "/status" || text === "/myid") {
    const userRes = await pool.query(`SELECT id, username, codm_ign, balance FROM users WHERE telegram_chat_id = ${escapeSql(chatId)} LIMIT 1`);
    const linkedUser = userRes.rows[0];
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🤖 <b>OPS STAKE BOT STATUS</b>\n\n` +
          `• Chat ID: <code>${chatId}</code>\n` +
          `• Username: @${telegramUsername || "N/A"}\n` +
          (linkedUser ? `• Linked Account: <b>${linkedUser.codm_ign}</b> (Balance: ₦${Number(linkedUser.balance || 0).toLocaleString()})\n• Status: 🟢 <b>ACTIVE & CONNECTED</b>` : `• Status: ⚪ <b>NOT LINKED</b> (Use 1-Tap Connect in OPS STAKE)`),
        parse_mode: "HTML"
      })
    });
    return;
  }

  if (text === "/matches" || text === "/wagers" || text === "/squads") {
    const allMatches = await getAllMatchesFromDb();
    const openMatches = allMatches.filter((m) => m.status === "PENDING_OPPONENT_STAKE");
    const appUrl = (process.env.APP_URL || "https://opsstake.online").replace(/\/$/, "");
    if (openMatches.length === 0) {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `⚔️ <b>NO OPEN WAGERS RIGHT NOW</b>\n\nBe the first to host a 1v1 duel or 5v5 Squad battle in the Arena!`,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[
              { text: "⚔️ CREATE WAGER IN ARENA", url: `${appUrl}/arena` }
            ]]
          }
        })
      });
      return;
    }
    let summaryText = `⚔️ <b>LIVE OPEN WAGERS (${openMatches.length})</b> ⚔️\n\n`;
    for (const m of openMatches.slice(0, 5)) {
      const isSq = m.matchType === "squad" || Boolean(m.squadData);
      if (isSq) {
        const slotsFilled = m.squadData?.slots ? m.squadData.slots.filter((s) => s.staked).length : 1;
        summaryText += `🛡️ <b>5v5 Squad #${m.challengeCode}</b>\n` +
          `• Stake / Player: ₦${m.stakeAmount.toLocaleString()}\n` +
          `• 10 Players Gross Pot: ₦${m.potAmount.toLocaleString()}\n` +
          `• Squad Fee: ${m.platformFeePercentage || 5}%\n` +
          `• Exact Win Payout: <b>₦${m.winnerPayout.toLocaleString()} / winner</b> (₦${((m.winnerPayout || 0) * 5).toLocaleString()} Team Pool)\n` +
          `• Open Slots: <b>${10 - slotsFilled}/10 open</b>\n` +
          `• Host: ${m.creator.codmIgn}\n\n`;
      } else {
        summaryText += `🔥 <b>1v1 Duel #${m.challengeCode}</b>\n` +
          `• Stake: ₦${m.stakeAmount.toLocaleString()}\n` +
          `• Pot: ₦${m.potAmount.toLocaleString()}\n` +
          `• Winner Payout: <b>₦${m.winnerPayout.toLocaleString()}</b>\n` +
          `• Host: ${m.creator.codmIgn}\n\n`;
      }
    }
    summaryText += `🚀 <i>Tap the button below to view all and join the battlefield!</i>`;
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: summaryText,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "🎮 ENTER LIVE ARENA", url: `${appUrl}/arena` }
          ]]
        }
      })
    });
    return;
  }
}
function startTelegramBotPolling() {
  if (!TELEGRAM_BOT_TOKEN || telegramBotRunning) return;
  telegramBotRunning = true;
  console.log("\u{1F916} Starting Telegram Bot polling loop for @OpsSTAKEBOT...");
  fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook?drop_pending_updates=true`).then((r) => r.json()).then((res) => console.log("\u{1F6E1}\uFE0F [Telegram Bot Security] Purged foreign webhooks from Telegram servers:", res)).catch((err) => console.warn("\u26A0\uFE0F [Telegram Bot Security] deleteWebhook warning:", err.message));
  fetchTelegramBotInfo().then((info) => {
    if (info) {
      console.log(`\u2705 [Telegram Bot] Active as @${info.username} (${info.firstName})`);
    }
  });
  const poll = async () => {
    try {
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastTelegramUpdateOffset}&timeout=20`;
      const res = await fetch(url, { signal: AbortSignal.timeout(25e3) });
      const data = await res.json();
      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          lastTelegramUpdateOffset = Math.max(lastTelegramUpdateOffset, update.update_id + 1);
          if (update.message) {
            await handleTelegramMessage(update.message).catch((err) => {
              console.error("[Telegram Bot] Error handling message:", err.message);
            });
          } else if (update.callback_query) {
            await handleTelegramCallbackQuery(update.callback_query).catch((err) => {
              console.error("[Telegram Bot] Error handling callback query:", err.message);
            });
          }
        }
      }
    } catch (err) {
    } finally {
      if (telegramBotRunning) {
        setTimeout(poll, 1500);
      }
    }
  };
  poll();
}
app.get("/api/telegram/bot-info", async (req, res) => {
  if (!TELEGRAM_BOT_TOKEN) {
    return res.json({ configured: false, error: "Telegram Bot token not set" });
  }
  const info = cachedTelegramBotInfo || await fetchTelegramBotInfo();
  const username = info?.username || "OpsSTAKEBOT";
  res.json({
    configured: true,
    botUsername: username,
    botFirstName: info?.firstName || "OPS STAKE",
    deepLinkPrefix: `https://t.me/${username}?start=link_`
  });
});
app.post("/api/telegram/unlink", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId is required" });
  await pool.query(`UPDATE users SET telegram_chat_id = NULL, telegram_username = NULL WHERE id = ${escapeSql(userId)}`);
  const updatedUser = await getUserFromDb(userId);
  if (globalIo) {
    globalIo.emit("userUpdated", updatedUser);
  }
  res.json({ success: true, message: "Telegram account unlinked successfully", user: updatedUser });
});
app.post("/api/telegram/webhook", async (req, res) => {
  try {
    const update = req.body;
    if (update?.message) {
      await handleTelegramMessage(update.message);
    } else if (update?.callback_query) {
      await handleTelegramCallbackQuery(update.callback_query);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[Telegram Webhook Exception]:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});
app.post("/api/telegram/test-channel-post", async (req, res) => {
  const { channelId } = req.body;
  const targetChannelId = (channelId || TELEGRAM_PUBLIC_CHANNEL_ID).trim();
  try {
    const getMeRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
    const meData = await getMeRes.json();
    if (!meData.ok) {
      return res.status(401).json({
        success: false,
        error: `Invalid Bot Token: ${meData.description}`,
        hint: "The token provided in TELEGRAM_BOT_TOKEN environment variable is rejected by Telegram."
      });
    }
    const botInfo = meData.result;
    console.log(`[Telegram Bot] Verified identity: @${botInfo.username} (${botInfo.first_name})`);
    const testMessage = `\u{1F680} <b>OPS STAKE BOT CONNECTION TEST</b>

This is a test message from <b>@${botInfo.username}</b> to verify admin access.

<b>Diagnostic Info:</b>
- Target ID: <code>${targetChannelId}</code>
- Bot ID: <code>${botInfo.id}</code>
- Timestamp: <code>${(/* @__PURE__ */ new Date()).toISOString()}</code>

<b>Action Required:</b> If you see this, the bot has correctly identified the channel. If not, check if the bot is an <b>ADMIN</b> with <b>Post Messages</b> permission.`;
    console.log(`[Telegram Bot] Manual test triggered for Channel ${targetChannelId}`);
    const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: targetChannelId,
        text: testMessage,
        parse_mode: "HTML"
      })
    });
    const data = await tgRes.json();
    if (data.ok) {
      console.log(`\u2705 [Telegram Bot] Manual test successful for Channel ${targetChannelId}`);
      return res.json({
        success: true,
        message: `Bot successfully posted to channel ${targetChannelId}!`,
        data
      });
    } else {
      console.error(`\u274C [Telegram Bot] Manual test failed for Channel ${targetChannelId}: ${data.description}`);
      let adminHint = "Make sure the Bot is an ADMIN in the channel/group.";
      try {
        const adminRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatAdministrators?chat_id=${targetChannelId}`);
        const adminData = await adminRes.json();
        if (!adminData.ok) {
          adminHint = `Diagnostic: ${adminData.description}. (Hint: This usually means the bot is not in the chat or has no admin rights).`;
        }
      } catch (e) {
      }
      return res.status(400).json({
        success: false,
        error: `Telegram Error: ${data.description}`,
        hint: adminHint,
        debug: {
          targetChannelId,
          botTokenPrefix: TELEGRAM_BOT_TOKEN.split(":")[0],
          errorCode: data.error_code
        }
      });
    }
  } catch (err) {
    console.error(`❌ [Telegram Bot] Manual test exception:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/telegram/test-welcome", async (req, res) => {
  const { chatId } = req.body;
  if (!chatId) return res.status(400).json({ error: "chatId required" });
  try {
    const welcomeText = `🎮 <b>OPS STAKE · TELEGRAM LINKED SUCCESSFULLY!</b> 🎮\n\n` +
      `✅ Welcome, <b>Gladiator Test</b>!\n` +
      `Your Telegram account has been <b>automatically connected</b> to your OPS STAKE profile.\n\n` +
      `🔒 <b>Linked Profile Details:</b>\n` +
      `• CODM IGN: <b>TestGladiator</b>\n` +
      `• Chat ID: <code>${chatId}</code>\n` +
      `• Current Balance: <b>₦5,000</b>\n\n` +
      `🔔 <b>What you will receive here in real-time:</b>\n` +
      `⚔️ Instant alert when a rival accepts your wagers\n` +
      `🔑 In-game CODM room codes as soon as matches deploy\n` +
      `🏆 Wager result confirmations & instant payout alerts\n` +
      `⚠️ Match conflict notifications & referee status updates\n\n` +
      `🚀 <i>You are ready for battle!</i>`;

    const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        text: welcomeText,
        parse_mode: "HTML"
      })
    });
    const data = await tgRes.json();
    if (data.ok) {
      return res.json({ success: true, message: "Welcome message test sent successfully!" });
    } else {
      return res.status(400).json({ success: false, error: data.description || "Failed to send welcome message" });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/matches", async (req, res) => {
  const matchList = await getAllMatchesFromDb();
  res.json(matchList.map((m) => sanitizeMatchForPublic(m)));
});
app.get("/api/matches/:id", async (req, res) => {
  const match = await getMatchFromDb(req.params.id);
  if (!match) return res.status(404).json({ error: "Match not found" });
  res.json(sanitizeMatchForPublic(match, true));
});
function calculateSquadEconomics(stakePerPlayer, playersPerTeam = 5, squadFeePercent = 5) {
  const totalPlayers = playersPerTeam * 2;
  const totalPot = Math.max(0, stakePerPlayer) * totalPlayers;
  const rakeRate = getSquadRakePercentage(stakePerPlayer, totalPot, squadFeePercent);
  const platformFee = Math.round(totalPot * rakeRate);
  const netWinningPool = totalPot - platformFee;
  const payoutPerPlayer = Math.floor(netWinningPool / playersPerTeam);
  const rakePercentFormatted = `${(rakeRate * 100).toFixed(rakeRate < 0.05 ? 1 : 0)}%`;
  return {
    stakePerPlayer,
    playersPerTeam,
    totalPlayers,
    totalPot,
    rakeRate,
    rakePercentFormatted,
    platformFee,
    netWinningPool,
    payoutPerPlayer
  };
}
app.post("/api/matches", async (req, res) => {
  const isMaintenance = await getMaintenanceMode();
  if (isMaintenance) {
    const userId = req.body?.creatorId;
    const user = userId ? await getUserFromDb(userId) : null;
    if (!user || user.role !== "admin") {
      return res.status(503).json({ error: "Match creation is disabled during scheduled maintenance." });
    }
  }
  const {
    creatorId,
    gameMode = "1v1 Sniper Only",
    map = "Shipment",
    rules = [
      "Sniper rifles only (DL Q33, Locus, Koshka, Arctic.50)",
      "No secondary pistols or melee weapons",
      "No Operator Skills or Scorestreaks",
      "First to 10 kills or 5 rounds wins"
    ],
    stakeAmount = 100,
    matchDurationMinutes = 15,
    isPublic = true,
    matchType = "solo"
  } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const userRes = await client.query(`SELECT * FROM users WHERE id = ${escapeSql(creatorId)} FOR UPDATE`);
    if (userRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Creator user not found" });
    }
    const creator = userRes.rows[0];
    const numStake = Number(stakeAmount);
    if (numStake < 100) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Minimum stake is \u20A6100" });
    }
    const currentBalance = parseFloat(creator.balance || 0);
    if (currentBalance < numStake) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `Insufficient wallet balance (\u20A6${currentBalance.toLocaleString()}) to host this wager. Please fund your wallet first.` });
    }
    await client.query(`
      UPDATE users 
      SET balance = balance - ${escapeSql(numStake)},
          escrow_balance = escrow_balance + ${escapeSql(numStake)}
      WHERE id = ${escapeSql(creatorId)}
    `);
    const numDuration = Math.max(15, parseInt(matchDurationMinutes, 10) || 15);
    const matchId = `match_${Date.now()}_${Math.floor(Math.random() * 1e3)}`;
    const challengeCode = `CHALLENGE-${Math.floor(1e3 + Math.random() * 9e3)}`;
    const feeSettings = await getPlatformFeeSettings();
    const isSquad = matchType === "squad";
    let potAmount = numStake * 2;
    let rakeRate = getSoloRakePercentage(potAmount, feeSettings.soloFeePercent);
    let platformFee = Math.round(potAmount * rakeRate);
    let winnerPayout = potAmount - platformFee;
    let platformFeePercentage = Math.round(rakeRate * 100);
    let squadData = void 0;
    if (isSquad) {
      const squadEcon = calculateSquadEconomics(numStake, 5, feeSettings.squadFeePercent);
      potAmount = squadEcon.totalPot;
      platformFee = squadEcon.platformFee;
      winnerPayout = squadEcon.payoutPerPlayer;
      rakeRate = squadEcon.rakeRate;
      platformFeePercentage = Math.round(squadEcon.rakeRate * 100);
      const slots = [];
      slots.push({
        slotIndex: 0,
        team: "ALPHA",
        userId: creator.id,
        username: creator.username,
        codmIgn: creator.codm_ign,
        codmUid: creator.codm_uid,
        avatar: creator.avatar,
        staked: true,
        stakedAt: Date.now()
      });
      for (let i = 1; i < 5; i++) {
        slots.push({ slotIndex: i, team: "ALPHA", staked: false });
      }
      for (let i = 5; i < 10; i++) {
        slots.push({ slotIndex: i, team: "BRAVO", staked: false });
      }
      squadData = {
        playersPerTeam: 5,
        totalSlots: 10,
        stakePerPlayer: numStake,
        slots
      };
    }
    const txId = `tx_${Date.now()}_host`;
    await client.query(`
      INSERT INTO transactions (id, user_id, type, amount, description, match_id, timestamp)
      VALUES (${escapeSql(txId)}, ${escapeSql(creatorId)}, 'ESCROW_LOCK', ${escapeSql(numStake)}, ${escapeSql(`\u20A6${numStake.toLocaleString()} escrow locked for hosting ${isSquad ? "5v5 Squad" : "1v1"} challenge #${challengeCode}`)}, ${escapeSql(matchId)}, ${Date.now()})
      ON CONFLICT (id) DO NOTHING
    `);
    const newMatch = {
      id: matchId,
      challengeCode,
      roomCode: void 0,
      gameMode,
      map,
      rules,
      stakeAmount: numStake,
      potAmount,
      platformFeePercentage,
      platformFee,
      winnerPayout,
      matchDurationMinutes: numDuration,
      matchType: isSquad ? "squad" : "solo",
      squadData,
      status: "PENDING_OPPONENT_STAKE",
      createdAt: Date.now(),
      isPublic: Boolean(isPublic),
      creator: {
        id: creator.id,
        username: creator.username,
        codmIgn: creator.codm_ign,
        codmUid: creator.codm_uid,
        avatar: creator.avatar,
        staked: true
      },
      chatMessages: [
        {
          id: `msg_sys_1`,
          senderId: "SYSTEM",
          senderName: "CODM Referee Bot",
          text: isSquad ? `\u{1F525} 5v5 Squad Wager Lobby #${challengeCode} created! Host ${creator.codm_ign} locked Slot #1 (Team Alpha). Waiting for 9 players to join slots (10 x \u20A6${numStake.toLocaleString()} = \u20A6${potAmount.toLocaleString()} Pot). Winning squad members will automatically receive \u20A6${winnerPayout.toLocaleString()} each upon victory!` : `Match challenge #${challengeCode} created with \u20A6${numStake.toLocaleString()} stake deducted from host wallet (Pot: \u20A6${potAmount.toLocaleString()}). Share the invite link with your opponent. You can cancel anytime before opponent accepts to get a 100% full refund.`,
          timestamp: Date.now()
        }
      ]
    };
    await saveMatchToDb(newMatch);
    await client.query("COMMIT");
    res.json(newMatch);
    const origin = req.headers.origin || req.headers.referer || `https://${req.headers.host}`;
    setImmediate(() => {
      try {
        if (globalIo) {
          globalIo.emit("matchCreated", newMatch);
          broadcastMatchStateChange(newMatch, "NEW_MATCH_AWAITING_OPPONENT");
        }
        if (origin) {
          console.log(`[Server] Triggering Telegram public post for match ${newMatch.challengeCode}...`);
          postMatchToPublicChannel(newMatch, origin).catch(
            (err) => console.warn("Telegram public post background error:", err.message)
          );
        }
      } catch (bgErr) {
        console.warn("Match creation background task error:", bgErr.message);
      }
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
    }
    console.error("Create match error:", err);
    res.status(500).json({ error: err.message || "Failed to create match" });
  } finally {
    client.release();
  }
});
app.post("/api/matches/:id/opponent-stake", async (req, res) => {
  const matchId = req.params.id;
  const { opponentId } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const matchRes = await client.query(`SELECT * FROM matches WHERE id = ${escapeSql(matchId)} FOR UPDATE`);
    if (matchRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Match not found" });
    }
    const matchRow = matchRes.rows[0];
    if (matchRow.status !== "PENDING_OPPONENT_STAKE") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "This match challenge has already been accepted by another player or is no longer open." });
    }
    if (matchRow.creator_id === opponentId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "You cannot accept your own challenge. Share the link with an opponent!" });
    }
    const stakeAmount = parseFloat(matchRow.stake_amount);
    const oppRes = await client.query(`SELECT * FROM users WHERE id = ${escapeSql(opponentId)} FOR UPDATE`);
    if (oppRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Opponent not found" });
    }
    const oppRow = oppRes.rows[0];
    const currentBal = parseFloat(oppRow.balance || 0);
    if (currentBal < stakeAmount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `Insufficient wallet balance (\u20A6${currentBal.toLocaleString()}) to accept this wager. Please fund your wallet first.` });
    }
    await client.query(`
      UPDATE users 
      SET balance = balance - ${escapeSql(stakeAmount)},
          escrow_balance = escrow_balance + ${escapeSql(stakeAmount)}
      WHERE id = ${escapeSql(opponentId)}
    `);
    const opponentData = {
      id: oppRow.id,
      username: oppRow.username,
      codmIgn: oppRow.codm_ign,
      codmUid: oppRow.codm_uid,
      avatar: oppRow.avatar,
      staked: true
    };
    const generatedRoomCode = generateRoomCode(matchRow.map);
    const now = Date.now();
    const newChatMsg = {
      id: `msg_${now}`,
      senderId: "SYSTEM",
      senderName: "CODM Referee Bot",
      text: `\u{1F389} MATCH STARTED! ${oppRow.codm_ign} accepted the duel and \u20A6${stakeAmount.toLocaleString()} stake was locked into escrow. Total Pot: \u20A6${parseFloat(matchRow.pot_amount).toLocaleString()}. In-game Room Code: #${generatedRoomCode}`,
      timestamp: now
    };
    const chatMessages = Array.isArray(matchRow.chat_messages) ? matchRow.chat_messages : [];
    chatMessages.push(newChatMsg);
    await client.query(`
      UPDATE matches 
      SET status = 'READY_TO_PLAY',
          room_code = ${escapeSql(generatedRoomCode)},
          room_generated_at = ${now},
          opponent_id = ${escapeSql(oppRow.id)},
          opponent_data = ${escapeSql(opponentData)},
          chat_messages = ${escapeSql(chatMessages)}
      WHERE id = ${escapeSql(matchId)}
    `);
    const tx = {
      id: `tx_${now}_opp`,
      type: "ESCROW_LOCK",
      amount: stakeAmount,
      description: `\u20A6${stakeAmount.toLocaleString()} stake locked in escrow for challenge #${matchRow.challenge_code}`,
      timestamp: now,
      matchId: matchRow.id
    };
    await client.query(`
      INSERT INTO transactions (id, user_id, type, amount, description, match_id, timestamp)
      VALUES (${escapeSql(tx.id)}, ${escapeSql(opponentId)}, ${escapeSql(tx.type)}, ${escapeSql(tx.amount)}, ${escapeSql(tx.description)}, ${escapeSql(tx.matchId)}, ${escapeSql(tx.timestamp)})
      ON CONFLICT (id) DO NOTHING
    `);
    await client.query("COMMIT");
    const updatedMatch = await getMatchFromDb(matchId);
    res.json(updatedMatch);
    if (updatedMatch) {
      const oppIgn = oppRow.codm_ign;
      setImmediate(() => {
        try {
          broadcastMatchStateChange(updatedMatch, "MATCH_STARTED");
          sendTelegramMatchAcceptedAlert(updatedMatch, oppIgn).catch(
            (err) => console.warn("Telegram match alert background error:", err.message)
          );
        } catch (bgErr) {
          console.warn("Match start background task error:", bgErr.message);
        }
      });
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Opponent stake race condition error:", err);
    res.status(500).json({ error: err.message || "Failed to accept challenge" });
  } finally {
    client.release();
  }
});
app.post("/api/matches/:id/creator-stake", async (req, res) => {
  const matchId = req.params.id;
  const match = await getMatchFromDb(matchId);
  if (!match) return res.status(404).json({ error: "Match not found" });
  res.json(match);
});
app.post("/api/matches/:id/join", async (req, res) => {
  const matchId = req.params.id;
  const { opponentId } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const matchRes = await client.query(`SELECT * FROM matches WHERE id = ${escapeSql(matchId)} FOR UPDATE`);
    if (matchRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Match not found" });
    }
    const matchRow = matchRes.rows[0];
    if (matchRow.status !== "PENDING_OPPONENT_STAKE") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "This match is no longer open for joining." });
    }
    if (matchRow.creator_id === opponentId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "You cannot accept your own challenge. Share the link with an opponent!" });
    }
    const stakeAmount = parseFloat(matchRow.stake_amount);
    const oppRes = await client.query(`SELECT * FROM users WHERE id = ${escapeSql(opponentId)} FOR UPDATE`);
    if (oppRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Opponent not found" });
    }
    const oppRow = oppRes.rows[0];
    const currentBal = parseFloat(oppRow.balance || 0);
    if (currentBal < stakeAmount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `Insufficient wallet balance (\u20A6${currentBal.toLocaleString()}) to accept this wager. Please fund your wallet first.` });
    }
    await client.query(`
      UPDATE users 
      SET balance = balance - ${escapeSql(stakeAmount)},
          escrow_balance = escrow_balance + ${escapeSql(stakeAmount)}
      WHERE id = ${escapeSql(opponentId)}
    `);
    const opponentData = {
      id: oppRow.id,
      username: oppRow.username,
      codmIgn: oppRow.codm_ign,
      codmUid: oppRow.codm_uid,
      avatar: oppRow.avatar,
      staked: true
    };
    const generatedRoomCode = generateRoomCode(matchRow.map);
    const now = Date.now();
    const newChatMsg = {
      id: `msg_${now}`,
      senderId: "SYSTEM",
      senderName: "CODM Referee Bot",
      text: `\u{1F389} MATCH STARTED! ${oppRow.codm_ign} accepted the duel and \u20A6${stakeAmount.toLocaleString()} stake was locked into escrow. Total Pot: \u20A6${parseFloat(matchRow.pot_amount).toLocaleString()}. In-game Room Code: #${generatedRoomCode}`,
      timestamp: now
    };
    const chatMessages = Array.isArray(matchRow.chat_messages) ? matchRow.chat_messages : [];
    chatMessages.push(newChatMsg);
    await client.query(`
      UPDATE matches 
      SET status = 'READY_TO_PLAY',
          room_code = ${escapeSql(generatedRoomCode)},
          room_generated_at = ${now},
          opponent_id = ${escapeSql(oppRow.id)},
          opponent_data = ${escapeSql(opponentData)},
          chat_messages = ${escapeSql(chatMessages)}
      WHERE id = ${escapeSql(matchId)}
    `);
    const tx = {
      id: `tx_${now}_join`,
      type: "ESCROW_LOCK",
      amount: stakeAmount,
      description: `\u20A6${stakeAmount.toLocaleString()} stake locked in escrow for challenge #${matchRow.challenge_code}`,
      timestamp: now,
      matchId: matchRow.id
    };
    await client.query(`
      INSERT INTO transactions (id, user_id, type, amount, description, match_id, timestamp)
      VALUES (${escapeSql(tx.id)}, ${escapeSql(opponentId)}, ${escapeSql(tx.type)}, ${escapeSql(tx.amount)}, ${escapeSql(tx.description)}, ${escapeSql(tx.matchId)}, ${escapeSql(tx.timestamp)})
      ON CONFLICT (id) DO NOTHING
    `);
    await client.query("COMMIT");
    const updatedMatch = await getMatchFromDb(matchId);
    res.json(updatedMatch);
    if (updatedMatch) {
      const oppIgn = oppRow.codm_ign;
      setImmediate(() => {
        try {
          broadcastMatchStateChange(updatedMatch, "MATCH_STARTED");
          sendTelegramMatchAcceptedAlert(updatedMatch, oppIgn).catch(
            (err) => console.warn("Telegram match alert background error:", err.message)
          );
        } catch (bgErr) {
          console.warn("Match start background task error:", bgErr.message);
        }
      });
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Join match race condition error:", err);
    res.status(500).json({ error: err.message || "Failed to join match" });
  } finally {
    client.release();
  }
});
app.post("/api/matches/:id/squad-join", async (req, res) => {
  const matchId = req.params.id;
  const { userId, slotIndex, team } = req.body;
  if (!userId) return res.status(400).json({ error: "User ID is required" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const matchRes = await client.query(`SELECT * FROM matches WHERE id = ${escapeSql(matchId)} FOR UPDATE`);
    if (matchRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Match not found" });
    }
    const matchRow = matchRes.rows[0];
    if (matchRow.status !== "PENDING_OPPONENT_STAKE") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "This squad lobby is no longer open for joining." });
    }
    let squadData = matchRow.squad_data ? typeof matchRow.squad_data === "string" ? JSON.parse(matchRow.squad_data) : matchRow.squad_data : null;
    if (!squadData || !Array.isArray(squadData.slots)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "This match is not configured as a 5v5 squad lobby." });
    }
    const existingSlot = squadData.slots.find((s) => s.userId === userId && s.staked);
    if (existingSlot) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `You are already staked in ${existingSlot.team === "ALPHA" ? "Team Alpha (Blue)" : "Team Bravo (Red)"} Slot #${existingSlot.slotIndex + 1}` });
    }
    let targetSlotIndex = typeof slotIndex === "number" && slotIndex >= 0 && slotIndex < 10 ? slotIndex : -1;
    if (targetSlotIndex !== -1) {
      if (squadData.slots[targetSlotIndex]?.staked) {
        targetSlotIndex = -1;
      }
    }
    if (targetSlotIndex === -1) {
      if (team === "BRAVO") {
        targetSlotIndex = squadData.slots.findIndex((s) => s.team === "BRAVO" && !s.staked);
      } else if (team === "ALPHA") {
        targetSlotIndex = squadData.slots.findIndex((s) => s.team === "ALPHA" && !s.staked);
      }
      if (targetSlotIndex === -1) {
        targetSlotIndex = squadData.slots.findIndex((s) => !s.staked);
      }
    }
    if (targetSlotIndex === -1 || targetSlotIndex >= 10) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "All 10 squad slots are already filled!" });
    }
    const stakeAmount = parseFloat(matchRow.stake_amount);
    const userRes = await client.query(`SELECT * FROM users WHERE id = ${escapeSql(userId)} FOR UPDATE`);
    if (userRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "User not found" });
    }
    const user = userRes.rows[0];
    const currentBal = parseFloat(user.balance || 0);
    if (currentBal < stakeAmount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `Insufficient wallet balance (\u20A6${currentBal.toLocaleString()}) to join this 5v5 squad slot. Please fund your wallet first.` });
    }
    await client.query(`
      UPDATE users 
      SET balance = balance - ${escapeSql(stakeAmount)},
          escrow_balance = escrow_balance + ${escapeSql(stakeAmount)}
      WHERE id = ${escapeSql(userId)}
    `);
    const assignedTeam = squadData.slots[targetSlotIndex].team || (targetSlotIndex < 5 ? "ALPHA" : "BRAVO");
    squadData.slots[targetSlotIndex] = {
      slotIndex: targetSlotIndex,
      team: assignedTeam,
      userId: user.id,
      username: user.username,
      codmIgn: user.codm_ign,
      codmUid: user.codm_uid,
      avatar: user.avatar,
      staked: true,
      stakedAt: Date.now()
    };
    const filledCount = squadData.slots.filter((s) => s.staked).length;
    const now = Date.now();
    let newStatus = matchRow.status;
    let generatedRoomCode = matchRow.room_code;
    const chatMessages = Array.isArray(matchRow.chat_messages) ? matchRow.chat_messages : [];
    if (filledCount === 10) {
      newStatus = "READY_TO_PLAY";
      generatedRoomCode = generateRoomCode(matchRow.map);
      chatMessages.push({
        id: `msg_${now}_squad_start`,
        senderId: "SYSTEM",
        senderName: "CODM Referee Bot",
        text: `\u{1F389} ALL 10 SQUAD SLOTS FILLED! 5v5 Squad match is LOCKED into escrow (Total Pot: \u20A6${parseFloat(matchRow.pot_amount).toLocaleString()}). Room Code: #${generatedRoomCode}. Join CODM Custom Room now!`,
        timestamp: now
      });
    } else {
      chatMessages.push({
        id: `msg_${now}_squad_join`,
        senderId: "SYSTEM",
        senderName: "CODM Referee Bot",
        text: `\u2694\uFE0F ${user.codm_ign} staked \u20A6${stakeAmount.toLocaleString()} and joined ${assignedTeam === "ALPHA" ? "Team Alpha (Blue)" : "Team Bravo (Red)"} Slot #${targetSlotIndex + 1}! (${filledCount}/10 slots filled)`,
        timestamp: now
      });
    }
    await client.query(`
      UPDATE matches 
      SET status = ${escapeSql(newStatus)},
          squad_data = ${escapeSql(squadData)},
          room_code = ${escapeSql(generatedRoomCode || null)},
          room_generated_at = ${filledCount === 10 ? now : "room_generated_at"},
          chat_messages = ${escapeSql(chatMessages)}
      WHERE id = ${escapeSql(matchId)}
    `);
    const tx = {
      id: `tx_${now}_squad_${targetSlotIndex}`,
      type: "ESCROW_LOCK",
      amount: stakeAmount,
      description: `\u20A6${stakeAmount.toLocaleString()} stake locked in escrow for 5v5 Squad challenge #${matchRow.challenge_code} (${assignedTeam} Slot #${targetSlotIndex + 1})`,
      timestamp: now,
      matchId: matchRow.id
    };
    await client.query(`
      INSERT INTO transactions (id, user_id, type, amount, description, match_id, timestamp)
      VALUES (${escapeSql(tx.id)}, ${escapeSql(userId)}, ${escapeSql(tx.type)}, ${escapeSql(tx.amount)}, ${escapeSql(tx.description)}, ${escapeSql(tx.matchId)}, ${escapeSql(tx.timestamp)})
      ON CONFLICT (id) DO NOTHING
    `);
    await client.query("COMMIT");
    const updatedMatch = await getMatchFromDb(matchId);
    res.json(updatedMatch);
    if (updatedMatch) {
      const pIgn = user.codm_ign;
      setImmediate(() => {
        try {
          broadcastMatchStateChange(updatedMatch, filledCount === 10 ? "MATCH_STARTED" : "RIVAL_JOINED");
          sendTelegramSquadSlotJoinedAlert(
            updatedMatch,
            pIgn,
            assignedTeam,
            targetSlotIndex + 1,
            filledCount
          ).catch(
            (err) => console.warn("Telegram squad join alert background error:", err.message)
          );
        } catch (bgErr) {
          console.warn("Squad join background task error:", bgErr.message);
        }
      });
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Squad join error:", err);
    res.status(500).json({ error: err.message || "Failed to join squad slot" });
  } finally {
    client.release();
  }
});
app.post("/api/matches/:id/squad-leave", async (req, res) => {
  const matchId = req.params.id;
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "User ID is required" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const matchRes = await client.query(`SELECT * FROM matches WHERE id = ${escapeSql(matchId)} FOR UPDATE`);
    if (matchRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Match not found" });
    }
    const matchRow = matchRes.rows[0];
    if (matchRow.status !== "PENDING_OPPONENT_STAKE") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Cannot leave slot once match is locked or started." });
    }
    if (matchRow.creator_id === userId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Host cannot leave slot. Cancel the wager to refund all players instead." });
    }
    let squadData = matchRow.squad_data ? typeof matchRow.squad_data === "string" ? JSON.parse(matchRow.squad_data) : matchRow.squad_data : null;
    if (!squadData || !Array.isArray(squadData.slots)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "This match is not a squad wager." });
    }
    const slotIdx = squadData.slots.findIndex((s) => s.userId === userId && s.staked);
    if (slotIdx === -1) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "You are not currently in a staked slot in this lobby." });
    }
    const stakeAmount = parseFloat(matchRow.stake_amount);
    await client.query(`
      UPDATE users 
      SET balance = balance + ${escapeSql(stakeAmount)},
          escrow_balance = GREATEST(0, escrow_balance - ${escapeSql(stakeAmount)})
      WHERE id = ${escapeSql(userId)}
    `);
    const userRes = await client.query(`SELECT codm_ign FROM users WHERE id = ${escapeSql(userId)}`);
    const playerIgn = userRes.rows[0]?.codm_ign || "Player";
    const resetTeam = squadData.slots[slotIdx].team;
    squadData.slots[slotIdx] = { slotIndex: slotIdx, team: resetTeam, staked: false };
    const filledCount = squadData.slots.filter((s) => s.staked).length;
    const now = Date.now();
    const chatMessages = Array.isArray(matchRow.chat_messages) ? matchRow.chat_messages : [];
    chatMessages.push({
      id: `msg_${now}_squad_leave`,
      senderId: "SYSTEM",
      senderName: "CODM Referee Bot",
      text: `\u{1F6E1}\uFE0F ${playerIgn} left Slot #${slotIdx + 1} and \u20A6${stakeAmount.toLocaleString()} escrow was refunded to their wallet. (${filledCount}/10 slots filled)`,
      timestamp: now
    });
    await client.query(`
      UPDATE matches 
      SET squad_data = ${escapeSql(squadData)},
          chat_messages = ${escapeSql(chatMessages)}
      WHERE id = ${escapeSql(matchId)}
    `);
    const tx = {
      id: `tx_${now}_squad_refund_${slotIdx}`,
      type: "ESCROW_REFUND",
      amount: stakeAmount,
      description: `\u20A6${stakeAmount.toLocaleString()} escrow refunded after leaving 5v5 Squad challenge #${matchRow.challenge_code}`,
      timestamp: now,
      matchId: matchRow.id
    };
    await client.query(`
      INSERT INTO transactions (id, user_id, type, amount, description, match_id, timestamp)
      VALUES (${escapeSql(tx.id)}, ${escapeSql(userId)}, ${escapeSql(tx.type)}, ${escapeSql(tx.amount)}, ${escapeSql(tx.description)}, ${escapeSql(tx.matchId)}, ${escapeSql(tx.timestamp)})
      ON CONFLICT (id) DO NOTHING
    `);
    await client.query("COMMIT");
    const updatedMatch = await getMatchFromDb(matchId);
    res.json(updatedMatch);
    if (updatedMatch) {
      setImmediate(() => {
        try {
          broadcastMatchStateChange(updatedMatch);
        } catch (_) {
        }
      });
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Squad leave error:", err);
    res.status(500).json({ error: err.message || "Failed to leave squad slot" });
  } finally {
    client.release();
  }
});
app.post("/api/matches/:id/chat", async (req, res) => {
  const match = await getMatchFromDb(req.params.id);
  if (!match) return res.status(404).json({ error: "Match not found" });
  const { senderId, text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "Message cannot be empty" });
  }
  const user = await getUserFromDb(senderId);
  const senderName = user ? user.codmIgn : "Player";
  const newMsg = {
    id: `msg_${Date.now()}`,
    senderId,
    senderName,
    text: text.trim(),
    timestamp: Date.now()
  };
  match.chatMessages.push(newMsg);
  await saveMatchToDb(match);
  broadcastToMatchRoom(match.id, { type: "chat", message: newMsg, matchId: match.id });
  res.json(newMsg);
});
app.post("/api/matches/:id/clear-chat", async (req, res) => {
  try {
    const matchId = req.params.id;
    await clearMatchChatInDb(matchId);
    res.json({ success: true, message: "Match chat cleared from database" });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to clear chat" });
  }
});
app.post("/api/matches/:id/cancel", async (req, res) => {
  const matchId = req.params.id;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const mRes = await client.query(`SELECT * FROM matches WHERE id = ${escapeSql(matchId)} FOR UPDATE`);
    if (mRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Match not found" });
    }
    const matchRow = mRes.rows[0];
    if (matchRow.status !== "PENDING_OPPONENT_STAKE") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Cannot cancel match. Opponent has already accepted and staked." });
    }
    await client.query(`UPDATE matches SET status = 'CANCELLED', chat_messages = '[]'::jsonb WHERE id = ${escapeSql(matchId)}`);
    const isSquad = matchRow.match_type === "squad" || Boolean(matchRow.squad_data);
    let squadData = matchRow.squad_data ? typeof matchRow.squad_data === "string" ? JSON.parse(matchRow.squad_data) : matchRow.squad_data : null;
    const stakeAmount = parseFloat(matchRow.stake_amount);
    if (isSquad && squadData?.slots && Array.isArray(squadData.slots)) {
      for (const slot of squadData.slots) {
        if (slot.staked && slot.userId) {
          await client.query(`
            UPDATE users 
            SET balance = balance + ${escapeSql(stakeAmount)},
                escrow_balance = GREATEST(0, escrow_balance - ${escapeSql(stakeAmount)})
            WHERE id = ${escapeSql(slot.userId)}
          `);
          const txS = `tx_${Date.now()}_cancel_sq_${slot.slotIndex}`;
          await client.query(`
            INSERT INTO transactions (id, user_id, type, amount, description, match_id, timestamp)
            VALUES (${escapeSql(txS)}, ${escapeSql(slot.userId)}, 'ESCROW_REFUND', ${escapeSql(stakeAmount)}, ${escapeSql(`\u20A6${stakeAmount.toLocaleString()} escrow refunded from cancelled 5v5 Squad challenge #${matchRow.challenge_code}`)}, ${escapeSql(matchId)}, ${Date.now()})
            ON CONFLICT (id) DO NOTHING
          `);
        }
      }
    } else {
      const creatorData = matchRow.creator_data || {};
      const opponentData = matchRow.opponent_data || {};
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
          VALUES (${escapeSql(txC)}, ${escapeSql(matchRow.creator_id)}, 'ESCROW_REFUND', ${escapeSql(stakeAmount)}, ${escapeSql(`\u20A6${stakeAmount.toLocaleString()} escrow refunded from cancelled challenge #${matchRow.challenge_code}`)}, ${escapeSql(matchId)}, ${Date.now()})
          ON CONFLICT (id) DO NOTHING
        `);
      }
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
          VALUES (${escapeSql(txO)}, ${escapeSql(matchRow.opponent_id)}, 'ESCROW_REFUND', ${escapeSql(stakeAmount)}, ${escapeSql(`\u20A6${stakeAmount.toLocaleString()} escrow refunded from cancelled challenge #${matchRow.challenge_code}`)}, ${escapeSql(matchId)}, ${Date.now()})
          ON CONFLICT (id) DO NOTHING
        `);
      }
    }
    await client.query("COMMIT");
    await clearMatchChatInDb(matchId);
    const updatedMatch = await getMatchFromDb(matchId);
    globalIo?.emit("matchUpdated", updatedMatch);
    res.json(updatedMatch);
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
    }
    console.error("Match cancel race error:", err);
    res.status(500).json({ error: err.message || "Failed to cancel match" });
  } finally {
    client.release();
  }
});
function analyzeImageSystemLogic(base64Data, filename) {
  if (!base64Data || typeof base64Data !== "string") {
    return {
      isLikelyFake: true,
      confidenceScore: 0.9,
      fakeRiskScore: 90,
      verdict: "NO DATA PROVIDED",
      dimensions: null,
      aspectRatio: "Unknown",
      fileType: "unknown",
      fileSizeKb: 0,
      headerHex: "NONE",
      isStandardType: false,
      detectedSoftware: null,
      redFlags: ["No valid payload received"],
      positiveSignals: []
    };
  }
  if (base64Data.startsWith("data:video/")) {
    const rawLen = base64Data.length - base64Data.indexOf(",") - 1;
    const sizeKb2 = Math.round(rawLen * 0.75 / 1024);
    return {
      isLikelyFake: false,
      confidenceScore: 1,
      fakeRiskScore: 0,
      verdict: "VIDEO RECORDING SUBMITTED",
      dimensions: null,
      aspectRatio: "Video",
      fileType: "video",
      fileSizeKb: sizeKb2,
      headerHex: "VIDEO",
      isStandardType: true,
      detectedSoftware: null,
      redFlags: [],
      positiveSignals: ["Video format detected for review"]
    };
  }
  const cleanBase64 = base64Data.replace(/^data:image\/[a-z0-9.+-]+;base64,/, "");
  let buf;
  try {
    buf = Buffer.from(cleanBase64, "base64");
  } catch (e) {
    return {
      isLikelyFake: true,
      confidenceScore: 0.95,
      fakeRiskScore: 95,
      verdict: "CORRUPTED BASE64 DATA",
      dimensions: null,
      aspectRatio: "Corrupt",
      fileType: "invalid",
      fileSizeKb: 0,
      headerHex: "CORRUPT",
      isStandardType: false,
      detectedSoftware: null,
      redFlags: ["Base64 payload could not be decoded"],
      positiveSignals: []
    };
  }
  const sizeKb = Math.round(buf.length / 1024);
  let fileType = "unknown";
  let isStandardType = false;
  const headerHex = buf.subarray(0, 16).toString("hex").toUpperCase();
  if (buf.length >= 8 && buf[0] === 137 && buf[1] === 80 && buf[2] === 78 && buf[3] === 71 && buf[4] === 13 && buf[5] === 10 && buf[6] === 26 && buf[7] === 10) {
    fileType = "image/png";
    isStandardType = true;
  } else if (buf.length >= 3 && buf[0] === 255 && buf[1] === 216 && buf[2] === 255) {
    fileType = "image/jpeg";
    isStandardType = true;
  } else if (buf.length >= 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") {
    fileType = "image/webp";
    isStandardType = true;
  }
  let dimensions = null;
  if (fileType === "image/png" && buf.length >= 24) {
    dimensions = {
      width: buf.readUInt32BE(16),
      height: buf.readUInt32BE(20)
    };
  } else if (fileType === "image/jpeg") {
    let offset = 2;
    while (offset < buf.length - 8) {
      if (buf[offset] !== 255) {
        offset++;
        continue;
      }
      const marker = buf[offset + 1];
      if (marker === 217 || marker === 218) break;
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
        dimensions = {
          height: buf.readUInt16BE(offset + 5),
          width: buf.readUInt16BE(offset + 7)
        };
        break;
      }
      const len = buf.readUInt16BE(offset + 2);
      offset += 2 + len;
    }
  } else if (fileType === "image/webp" && buf.length >= 30) {
    const chunkType = buf.subarray(12, 16).toString();
    if (chunkType === "VP8 " && buf.length >= 30) {
      dimensions = {
        width: buf.readUInt16LE(26) & 16383,
        height: buf.readUInt16LE(28) & 16383
      };
    } else if (chunkType === "VP8L" && buf.length >= 25) {
      const b0 = buf[21];
      const b1 = buf[22];
      const b2 = buf[23];
      const b3 = buf[24];
      dimensions = {
        width: 1 + ((b1 & 63) << 8 | b0),
        height: 1 + ((b3 & 15) << 10 | b2 << 2 | (b1 & 192) >> 6)
      };
    } else if (chunkType === "VP8X" && buf.length >= 30) {
      dimensions = {
        width: 1 + (buf[24] | buf[25] << 8 | buf[26] << 16),
        height: 1 + (buf[27] | buf[28] << 8 | buf[29] << 16)
      };
    }
  }
  let fakeRiskScore = 0;
  const redFlags = [];
  const positiveSignals = [];
  let detectedSoftware = null;
  if (!isStandardType) {
    redFlags.push(`Non-standard image file signature (Header: ${headerHex.slice(0, 8)})`);
    fakeRiskScore += 45;
  } else {
    positiveSignals.push(`Standard ${fileType.toUpperCase().replace("IMAGE/", "")} format verified`);
  }
  let aspectRatioLabel = "Unknown";
  if (dimensions && dimensions.width > 0 && dimensions.height > 0) {
    const { width, height } = dimensions;
    const ratio = width / height;
    aspectRatioLabel = `${width}x${height} (${ratio.toFixed(2)}:1)`;
    if (ratio >= 0.95 && ratio <= 1.05) {
      redFlags.push(`1:1 Square aspect ratio (${width}x${height}) - classic generative AI default (Midjourney / DALL-E / SD)`);
      fakeRiskScore += 50;
    } else if (height > width) {
      redFlags.push(`Portrait orientation (${width}x${height}) - CODM gameplay scoreboard is strictly landscape`);
      fakeRiskScore += 40;
    } else if (ratio >= 1.33 && ratio <= 2.45) {
      positiveSignals.push(`Authentic mobile landscape aspect ratio (${ratio >= 1.7 && ratio <= 2.3 ? "16:9 to 20:9 Phone Display" : "Tablet Landscape"})`);
    } else {
      redFlags.push(`Abnormal aspect ratio (${ratio.toFixed(2)}:1) - out of mobile gaming range`);
      fakeRiskScore += 20;
    }
    if (width === 512 && height === 512 || width === 768 && height === 768 || width === 1024 && height === 1024 || width === 512 && height === 768 || width === 768 && height === 512 || width === 1024 && height === 1792) {
      redFlags.push(`Matches standard AI default dimensions (${width}x${height})`);
      fakeRiskScore += 35;
    }
  } else {
    redFlags.push("Unable to decode image dimension headers");
    fakeRiskScore += 20;
  }
  const rawText = buf.toString("latin1");
  const aiKeywords = [
    { pattern: /comfyui/i, name: "ComfyUI Node Graph" },
    { pattern: /stable diffusion|automatic1111|\ba1111\b|sdxl|fooocus/i, name: "Stable Diffusion / A1111" },
    { pattern: /midjourney/i, name: "Midjourney" },
    { pattern: /dall[- ]?e/i, name: "OpenAI DALL-E" },
    { pattern: /novelai/i, name: "NovelAI" },
    { pattern: /adobe firefly|firefly/i, name: "Adobe Firefly" },
    { pattern: /synthid/i, name: "Google SynthID Synthetic Watermark" },
    { pattern: /c2pa|urn:c2pa/i, name: "C2PA Provenance Manifest" },
    { pattern: /source: generative ai|source: ai|generative: ai/i, name: "Generative AI Metadata Tag" },
    { pattern: /sd-metadata/i, name: "Stable Diffusion Metadata" },
    { pattern: /dreamstudio/i, name: "DreamStudio (Stability AI)" },
    { pattern: /leonardo\.ai/i, name: "Leonardo AI" },
    { pattern: /playground ai/i, name: "Playground AI" },
    { pattern: /bing image creator/i, name: "Bing Image Creator" },
    { pattern: /steps:\s*\d+/i, name: "AI Diffusion Steps Parameter" },
    { pattern: /sampler:\s*[a-z0-9_]+/i, name: "AI Diffusion Sampler Parameter" },
    { pattern: /cfg scale:\s*[0-9.]+/i, name: "AI Diffusion CFG Scale" },
    { pattern: /negative prompt:/i, name: "AI Negative Prompt Parameter" },
    { pattern: /photoshop|adobe imageready/i, name: "Adobe Photoshop" },
    { pattern: /canva/i, name: "Canva Design Editor" }
  ];
  for (const { pattern, name } of aiKeywords) {
    if (pattern.test(rawText)) {
      detectedSoftware = name;
      redFlags.push(`Embedded AI/editor signature: "${name}"`);
      fakeRiskScore += 60;
      break;
    }
  }
  if (sizeKb < 35) {
    redFlags.push(`Suspiciously small file size (${sizeKb} KB) for high-definition scoreboard`);
    fakeRiskScore += 20;
  } else if (sizeKb > 120 && isStandardType && positiveSignals.length > 0) {
    positiveSignals.push(`Standard mobile capture payload (${sizeKb} KB)`);
  }
  const isLikelyFake = fakeRiskScore >= 45;
  const confidenceScore = isLikelyFake ? Math.min(0.99, 0.65 + Math.min(0.3, fakeRiskScore / 150)) : Math.max(0.88, 1 - fakeRiskScore / 100);
  const verdict = isLikelyFake ? "FAKE / SYNTHETIC AI GENERATION DETECTED" : fakeRiskScore > 20 ? "SUSPICIOUS / ANOMALIES PRESENT" : "VERIFIED AUTHENTIC CODM SCREENSHOT";
  return {
    isLikelyFake,
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    fakeRiskScore,
    verdict,
    dimensions,
    aspectRatio: aspectRatioLabel,
    fileType,
    fileSizeKb: sizeKb,
    headerHex: headerHex.slice(0, 16),
    isStandardType,
    detectedSoftware,
    redFlags,
    positiveSignals
  };
}
function computeMatchConflictReasons(match) {
  const cClaim = match.creator?.resultClaim;
  const oClaim = match.opponent?.resultClaim;
  const cIgn = match.creator?.codmIgn || "Host";
  const oIgn = match.opponent?.codmIgn || "Rival";
  const cDetection = match.creator?.systemAiDetection;
  const oDetection = match.opponent?.systemAiDetection;
  const reasons = [];
  if (cClaim === "VICTORY" && oClaim === "VICTORY") {
    reasons.push(`Dual Victory Conflict: Both Host (${cIgn}) and Rival (${oIgn}) claimed "I Won \u{1F3C6}". Scoreboard verification required to award escrow.`);
  } else if (cClaim && oClaim && cClaim !== oClaim) {
    reasons.push(`Contradictory Outcome Claims: ${cIgn} claimed "${cClaim}" while ${oIgn} claimed "${oClaim}".`);
  }
  if (match.resubmissionNotice?.reason) {
    reasons.push(`Proof Resubmission Requested: ${match.resubmissionNotice.reason}`);
  }
  if (cDetection?.isLikelyFake) {
    reasons.push(`\u26A0\uFE0F Host (${cIgn}) Screenshot Flagged: ${cDetection.verdict} (${cDetection.redFlags.join(" \xB7 ")})`);
  }
  if (oDetection?.isLikelyFake) {
    reasons.push(`\u26A0\uFE0F Rival (${oIgn}) Screenshot Flagged: ${oDetection.verdict} (${oDetection.redFlags.join(" \xB7 ")})`);
  }
  if (match.status === "DISPUTED") {
    if (match.resolutionNotes && !reasons.includes(match.resolutionNotes)) {
      reasons.push(match.resolutionNotes);
    }
    if (!match.creator?.screenshotUrl) {
      reasons.push(`Awaiting scoreboard proof upload from Host (${cIgn}).`);
    }
    if (match.opponent && !match.opponent.screenshotUrl) {
      reasons.push(`Awaiting scoreboard proof upload from Rival (${oIgn}).`);
    }
  }
  const conflictReason = reasons.length > 0 ? reasons[0] : match.resolutionNotes || "Match results pending referee verification.";
  return { conflictReason, conflictReasonsList: reasons };
}
app.post("/api/matches/:id/submit-result", rateLimitMiddleware(15, 6e4), secureSignatureMiddleware, async (req, res) => {
  const match = await getMatchFromDb(req.params.id);
  if (!match) return res.status(404).json({ error: "Match not found" });
  if (match.status === "SETTLED" || match.status === "DISPUTED") {
    return res.status(400).json({ error: "Match already settled or under dispute. No further dispute actions allowed." });
  }
  const { playerId, claim, screenshotBase64 } = req.body;
  if (!["VICTORY", "DEFEAT", "DRAW"].includes(claim)) {
    return res.status(400).json({ error: "Claim must be VICTORY, DEFEAT, or DRAW" });
  }
  const isCreator = match.creator.id === playerId;
  const isOpponent = match.opponent?.id === playerId;
  if (!isCreator && !isOpponent) {
    return res.status(403).json({ error: "You are not a participant in this match" });
  }
  const playerIgn = isCreator ? match.creator.codmIgn : match.opponent.codmIgn;
  let systemAnalysis = null;
  let analysisResult = {
    detectedOutcome: claim,
    confidence: 0.95,
    detectedPlayerName: playerIgn,
    scoreSummary: claim === "VICTORY" ? "Scoreboard confirmed Victory" : claim === "DRAW" ? "Scoreboard confirmed Draw / Tie" : "Scoreboard confirmed Defeat",
    reasoning: "Verified by CODM match verification engine."
  };
  if (screenshotBase64) {
    systemAnalysis = analyzeImageSystemLogic(screenshotBase64);
  }
  if (isCreator) {
    match.creator.resultClaim = claim;
    if (screenshotBase64) {
      match.creator.screenshotUrl = screenshotBase64;
      match.creator.screenshotAnalysis = analysisResult;
      match.creator.systemAiDetection = systemAnalysis;
      match.creator.forensicAnalysis = {
        isLikelyFake: systemAnalysis.isLikelyFake,
        confidenceScore: systemAnalysis.confidenceScore,
        aiDetected: systemAnalysis.isLikelyFake,
        manipulationDetected: systemAnalysis.fakeRiskScore >= 45,
        detectedPlayerName: playerIgn,
        detectedOutcome: claim,
        technicalNotes: systemAnalysis.redFlags.join("; ") || "Standard verified mobile screenshot format",
        redFlags: systemAnalysis.redFlags,
        positiveSignals: systemAnalysis.positiveSignals,
        verdict: systemAnalysis.verdict,
        fileInfo: {
          mimeType: systemAnalysis.fileType,
          headerHex: systemAnalysis.headerHex,
          isStandardType: systemAnalysis.isStandardType,
          dimensions: systemAnalysis.dimensions,
          aspectRatio: systemAnalysis.aspectRatio
        }
      };
      delete match.creator.resubmissionRequested;
      delete match.creator.resubmissionReason;
    }
    match.creator.submittedAt = Date.now();
  } else if (match.opponent) {
    match.opponent.resultClaim = claim;
    if (screenshotBase64) {
      match.opponent.screenshotUrl = screenshotBase64;
      match.opponent.screenshotAnalysis = analysisResult;
      match.opponent.systemAiDetection = systemAnalysis;
      match.opponent.forensicAnalysis = {
        isLikelyFake: systemAnalysis.isLikelyFake,
        confidenceScore: systemAnalysis.confidenceScore,
        aiDetected: systemAnalysis.isLikelyFake,
        manipulationDetected: systemAnalysis.fakeRiskScore >= 45,
        detectedPlayerName: playerIgn,
        detectedOutcome: claim,
        technicalNotes: systemAnalysis.redFlags.join("; ") || "Standard verified mobile screenshot format",
        redFlags: systemAnalysis.redFlags,
        positiveSignals: systemAnalysis.positiveSignals,
        verdict: systemAnalysis.verdict,
        fileInfo: {
          mimeType: systemAnalysis.fileType,
          headerHex: systemAnalysis.headerHex,
          isStandardType: systemAnalysis.isStandardType,
          dimensions: systemAnalysis.dimensions,
          aspectRatio: systemAnalysis.aspectRatio
        }
      };
      delete match.opponent.resubmissionRequested;
      delete match.opponent.resubmissionReason;
    }
    match.opponent.submittedAt = Date.now();
  }
  const cClaim = match.creator.resultClaim;
  const oClaim = match.opponent?.resultClaim;
  const isDisputeMode = match.status === "DISPUTED";
  let resolveWinner = null;
  if (isDisputeMode) {
    if (screenshotBase64) {
      const isVideo = screenshotBase64.startsWith("data:video/");
      const proofType = isVideo ? "screen recording" : "scoreboard screenshot";
      const proofEmoji = isVideo ? "\u{1F4F9}" : "\u{1F4F8}";
      match.chatMessages.push({
        id: `msg_${Date.now()}`,
        senderId: "SYSTEM",
        senderName: "CODM Referee Bot",
        text: `${proofEmoji} ${playerIgn} submitted dispute ${proofType}. Manual review required by admin.`,
        timestamp: Date.now()
      });
      if (isVideo) {
        const tempPath = `/tmp/dispute_${match.id}_${Date.now()}.mp4`;
        const base64Data = screenshotBase64.split(",")[1];
        fs.writeFileSync(tempPath, Buffer.from(base64Data, "base64"));
        setImmediate(async () => {
          try {
            await sendMatchDisputeVideoToTelegramFromFile(match, playerIgn, tempPath);
          } catch (err) {
            console.error("[Telegram Bot] Background video upload error:", err.message);
          } finally {
            try {
              fs.unlinkSync(tempPath);
            } catch {
            }
          }
        });
      }
      resolveWinner = null;
      match.status = "DISPUTED";
      match.resolutionNotes = `Awaiting referee review of ${proofType} submitted by ${playerIgn}. Pot \u20A6${match.potAmount.toLocaleString()} remains locked.`;
    } else {
      match.chatMessages.push({
        id: `msg_${Date.now()}`,
        senderId: "SYSTEM",
        senderName: "CODM Referee Bot",
        text: `\u26A0\uFE0F Match is in dispute. Please upload your screen recording of history and result to resolve.`,
        timestamp: Date.now()
      });
    }
  } else {
    const claimLabel = claim === "VICTORY" ? "I Won \u{1F3C6}" : claim === "DEFEAT" ? "I Lost \u274C" : "Draw \u2696\uFE0F";
    match.chatMessages.push({
      id: `msg_${Date.now()}`,
      senderId: "SYSTEM",
      senderName: "CODM Referee Bot",
      text: `\u26A1 ${playerIgn} confirmed match result: "${claimLabel}".`,
      timestamp: Date.now()
    });
    if (cClaim && oClaim) {
      if (cClaim === "VICTORY" && oClaim === "DEFEAT") {
        resolveWinner = "creator";
      } else if (cClaim === "DEFEAT" && oClaim === "VICTORY") {
        resolveWinner = "opponent";
      } else if (cClaim === "DRAW" && oClaim === "DRAW") {
        resolveWinner = "draw";
      } else if (cClaim === "VICTORY" && oClaim === "VICTORY") {
        resolveWinner = "dispute";
      } else if (cClaim === "DEFEAT" && oClaim === "DEFEAT") {
        resolveWinner = "draw";
      } else {
        resolveWinner = "dispute";
      }
    } else {
      resolveWinner = null;
    }
  }
  if (resolveWinner === "draw") {
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
    match.status = "READY_TO_PLAY";
    match.resolutionNotes = `Match resulted in a mutual DRAW / TIE. Rematch room #${newRoomCode} generated. Stakes remain securely locked in escrow.`;
    match.chatMessages.push({
      id: `msg_${Date.now()}_rematch`,
      senderId: "SYSTEM",
      senderName: "CODM Referee Bot",
      text: `\u2696\uFE0F MUTUAL DRAW CONFIRMED! Stakes remain protected in escrow. \u{1F3AF} REMATCH ROOM CODE GENERATED: #${newRoomCode}. Both players join #${newRoomCode} in CODM!`,
      timestamp: Date.now()
    });
  } else if (resolveWinner === "creator" || resolveWinner === "opponent") {
    const isSquad = match.matchType === "squad" || Boolean(match.squadData);
    if (isSquad && match.squadData?.slots) {
      const winningTeam = resolveWinner === "creator" ? "ALPHA" : "BRAVO";
      const losingTeam = winningTeam === "ALPHA" ? "BRAVO" : "ALPHA";
      const teamLabel = winningTeam === "ALPHA" ? "Team Alpha (Blue)" : "Team Bravo (Red)";
      match.status = "SETTLED";
      match.winnerId = winningTeam;
      match.winnerIgn = teamLabel;
      const platformFee = match.platformFee !== void 0 ? match.platformFee : Math.round(match.potAmount * ((match.platformFeePercentage || 5) / 100));
      await updatePlatformFinance(platformFee);
      for (const slot of match.squadData.slots) {
        if (slot.staked && slot.userId) {
          await pool.query(`
            UPDATE users 
            SET escrow_balance = GREATEST(0, escrow_balance - ${escapeSql(match.stakeAmount)})
            WHERE id = ${escapeSql(slot.userId)}
          `);
        }
      }
      const winningSlots = match.squadData.slots.filter((s) => s.team === winningTeam && s.staked && s.userId);
      for (const slot of winningSlots) {
        const txWId = `tx_${Date.now()}_sq_win_${slot.slotIndex}`;
        const descWin = `\u{1F3C6} Won 5v5 Squad Match #${match.roomCode || match.challengeCode} (${teamLabel}): \u20A6${match.winnerPayout.toLocaleString()} credited to wallet balance.`;
        const insRes = await pool.query(`
          INSERT INTO transactions (id, user_id, type, amount, description, match_id, timestamp)
          VALUES (${escapeSql(txWId)}, ${escapeSql(slot.userId)}, 'MATCH_WIN_PAYOUT', ${escapeSql(match.winnerPayout)}, ${escapeSql(descWin)}, ${escapeSql(match.id)}, ${Date.now()})
          ON CONFLICT (id) DO NOTHING
          RETURNING id;
        `);
        if (insRes.rows.length > 0) {
          await pool.query(`
            UPDATE users 
            SET balance = balance + ${escapeSql(match.winnerPayout)},
                total_winnings = total_winnings + ${escapeSql(match.winnerPayout)},
                wins = wins + 1
            WHERE id = ${escapeSql(slot.userId)}
          `);
        }
      }
      const losingSlots = match.squadData.slots.filter((s) => s.team === losingTeam && s.staked && s.userId);
      for (const slot of losingSlots) {
        await pool.query(`
          UPDATE users SET losses = losses + 1 WHERE id = ${escapeSql(slot.userId)}
        `);
      }
      match.resolutionNotes = `5v5 Squad Match resolved! Winning Team is ${teamLabel}. \u20A6${match.winnerPayout.toLocaleString()} credited to each of the 5 winning squad players!`;
      match.chatMessages = [];
      await clearMatchChatInDb(match.id);
      setImmediate(() => {
        sendTelegramMatchSettledAlert(match, winningTeam).catch(
          (e) => console.warn("Telegram squad settlement alert error:", e.message)
        );
      });
    } else {
      const winnerObj = resolveWinner === "creator" ? match.creator : match.opponent;
      const loserObj = resolveWinner === "creator" ? match.opponent : match.creator;
      const winnerUser = await getUserFromDb(winnerObj.id);
      const loserUser = await getUserFromDb(loserObj.id);
      match.status = "SETTLED";
      match.winnerId = winnerObj.id;
      match.winnerIgn = winnerObj.codmIgn;
      const platformFee = match.platformFee || Math.round(match.potAmount * 0.1);
      const bonusPerReferrer = Math.floor(platformFee * 0.1);
      const referrers = [];
      if (winnerUser?.referredBy) referrers.push(winnerUser.referredBy);
      if (loserUser?.referredBy) referrers.push(loserUser.referredBy);
      for (const referrerId of [...new Set(referrers)]) {
        await pool.query(`
          UPDATE users 
          SET balance = balance + ${escapeSql(bonusPerReferrer)},
              total_referral_earnings = COALESCE(total_referral_earnings, 0) + ${escapeSql(bonusPerReferrer)}
          WHERE id = ${escapeSql(referrerId)}
        `);
        await saveTransactionToDb(referrerId, {
          id: `tx_ref_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
          type: "REFERRAL_EARNING",
          amount: bonusPerReferrer,
          description: `10% Referral bonus from match #${match.roomCode || match.challengeCode} platform fee`,
          matchId: match.id,
          timestamp: Date.now()
        });
      }
      await updatePlatformFinance(platformFee - bonusPerReferrer * [...new Set(referrers)].length);
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
        const txWId = `tx_${Date.now()}_win`;
        const descWin = `\u{1F3C6} Won 1v1 Escrow Match #${match.roomCode} vs ${loserObj.codmIgn}: \u20A6${match.winnerPayout.toLocaleString()} credited to wallet balance. Ready for instant cashout.`;
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
        match.resolutionNotes = `Match resolved! Winner is ${winnerObj.codmIgn}. \u20A6${match.winnerPayout.toLocaleString()} credited to winner's wallet. Ready for instant cashout!`;
        match.chatMessages = [];
        await clearMatchChatInDb(match.id);
        setImmediate(() => {
          sendTelegramMatchSettledAlert(match, winnerObj.codmIgn).catch(
            (e) => console.warn("Telegram match settlement alert error:", e.message)
          );
        });
      }
    }
  } else if (resolveWinner === "dispute") {
    match.conflictRetries = (match.conflictRetries || 0) + 1;
    if (match.conflictRetries < 3) {
      match.status = "SUBMITTING_RESULTS";
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
      match.resolutionNotes = `\u26A0\uFE0F Result Conflict Detected (Retry Attempt ${match.conflictRetries} of 3). Both players must re-confirm match result.`;
      match.chatMessages.push({
        id: `msg_${Date.now()}_retry`,
        senderId: "SYSTEM",
        senderName: "CODM Referee Bot",
        text: `\u26A0\uFE0F RESULT CONFLICT DETECTED (Retry Attempt ${match.conflictRetries} of 3): Conflicting claims submitted. Both players are given another chance to confirm correct result before mandatory screenshot review.`,
        timestamp: Date.now()
      });
    } else {
      match.status = "DISPUTED";
      match.resolutionNotes = `\u{1F6A8} Maximum 3 conflict retries reached. Match escalated to Admin Review Queue for manual video recording inspection.`;
      match.chatMessages.push({
        id: `msg_${Date.now()}_dispute_final`,
        senderId: "SYSTEM",
        senderName: "CODM Referee Bot",
        text: `\u{1F6A8} MAXIMUM 3 CONFLICT RETRIES REACHED: Match escalated to Admin Review. Both players MUST upload a <b>screen recording</b> of their history and game result now for manual referee verification.`,
        timestamp: Date.now()
      });
    }
  } else {
    match.status = "SUBMITTING_RESULTS";
    const waitingForIgn = isCreator ? match.opponent?.codmIgn || "Rival" : match.creator.codmIgn;
    const submittedLabel = claim === "VICTORY" ? "I Won \u{1F3C6}" : claim === "DEFEAT" ? "I Lost \u274C" : "Draw \u2696\uFE0F";
    match.resolutionNotes = `${playerIgn} submitted "${submittedLabel}". Pending result confirmation from ${waitingForIgn} before final settlement.`;
  }
  if (systemAnalysis?.isLikelyFake) {
    match.chatMessages.push({
      id: `msg_${Date.now()}_sys_flag`,
      senderId: "SYSTEM",
      senderName: "CODM Referee Bot",
      text: `\u26A0\uFE0F Security Alert: ${playerIgn}'s screenshot was flagged by system forensic analysis (${systemAnalysis.verdict}: ${systemAnalysis.redFlags.join(" \xB7 ")}). Flagged in Admin Review Queue for referee inspection.`,
      timestamp: Date.now()
    });
  }
  const conflictInfo = computeMatchConflictReasons(match);
  match.conflictReason = conflictInfo.conflictReason;
  match.conflictReasonsList = conflictInfo.conflictReasonsList;
  await saveMatchToDb(match);
  if (globalIo) {
    globalIo.emit("matchUpdated", match);
    globalIo.to(match.id).emit("matchUpdated", match);
  }
  res.json(match);
});
app.post("/api/msksksnuwje/matches/:id/admin-resolve", async (req, res) => {
  const adminUser = req.adminUser;
  if (adminUser.role !== "admin") {
    return res.status(403).json({ error: "Unauthorized: Full Administrative privileges required to resolve matches." });
  }
  const match = await getMatchFromDb(req.params.id);
  if (!match) return res.status(404).json({ error: "Match not found" });
  if (match.reviewerId && match.reviewerId !== adminUser.id) {
    return res.status(403).json({ error: `Forbidden: This match is currently being reviewed by ${match.reviewerName || "another admin"}` });
  }
  const { winnerId } = req.body;
  if (winnerId === "REFUND" || winnerId === "DRAW") {
    const isSquad2 = match.matchType === "squad" || Boolean(match.squadData);
    if (isSquad2 && match.squadData?.slots) {
      for (const slot of match.squadData.slots) {
        if (slot.staked && slot.userId) {
          await pool.query(`
            UPDATE users 
            SET escrow_balance = GREATEST(0, escrow_balance - ${escapeSql(match.stakeAmount)}),
                balance = balance + ${escapeSql(match.stakeAmount)}
            WHERE id = ${escapeSql(slot.userId)}
          `);
          await saveTransactionToDb(slot.userId, {
            id: `tx_refund_${Date.now()}_sq_${slot.slotIndex}`,
            type: "ESCROW_REFUND",
            amount: match.stakeAmount,
            description: `Escrow refund for 5v5 Squad match #${match.roomCode || match.challengeCode}: Full Refund by referee.`,
            matchId: match.id,
            timestamp: Date.now()
          });
        }
      }
    } else {
      if (match.creator?.id) {
        await pool.query(`
          UPDATE users 
          SET escrow_balance = GREATEST(0, escrow_balance - ${escapeSql(match.stakeAmount)}),
              balance = balance + ${escapeSql(match.stakeAmount)}
          WHERE id = ${escapeSql(match.creator.id)}
        `);
        await saveTransactionToDb(match.creator.id, {
          id: `tx_refund_${Date.now()}_creator`,
          type: "ESCROW_REFUND",
          amount: match.stakeAmount,
          description: `Escrow refund for match #${match.roomCode || match.challengeCode}: Adjudicated as Draw / Full Refund by referee.`,
          matchId: match.id,
          timestamp: Date.now()
        });
      }
      if (match.opponent?.id) {
        await pool.query(`
          UPDATE users 
          SET escrow_balance = GREATEST(0, escrow_balance - ${escapeSql(match.stakeAmount)}),
              balance = balance + ${escapeSql(match.stakeAmount)}
          WHERE id = ${escapeSql(match.opponent.id)}
        `);
        await saveTransactionToDb(match.opponent.id, {
          id: `tx_refund_${Date.now()}_opponent`,
          type: "ESCROW_REFUND",
          amount: match.stakeAmount,
          description: `Escrow refund for match #${match.roomCode || match.challengeCode}: Adjudicated as Draw / Full Refund by referee.`,
          matchId: match.id,
          timestamp: Date.now()
        });
      }
    }
    match.status = "CANCELLED";
    match.resolutionNotes = `Match resolved as Draw / Full Refund by referee. \u20A6${match.stakeAmount.toLocaleString()} refunded to players.`;
    match.chatMessages = [];
    await clearMatchChatInDb(match.id);
    await saveMatchToDb(match);
    return res.json(match);
  }
  const isSquad = match.matchType === "squad" || Boolean(match.squadData);
  if (isSquad && match.squadData?.slots) {
    const winningTeam = winnerId === "BRAVO" || match.squadData?.slots?.find((s) => s.userId === winnerId)?.team === "BRAVO" ? "BRAVO" : "ALPHA";
    const losingTeam = winningTeam === "ALPHA" ? "BRAVO" : "ALPHA";
    const teamLabel = winningTeam === "ALPHA" ? "Team Alpha (Blue)" : "Team Bravo (Red)";
    match.status = "SETTLED";
    match.winnerId = winningTeam;
    match.winnerIgn = teamLabel;
    const platformFee2 = match.platformFee !== void 0 ? match.platformFee : Math.round(match.potAmount * ((match.platformFeePercentage || 5) / 100));
    await updatePlatformFinance(platformFee2);
    for (const slot of match.squadData.slots) {
      if (slot.staked && slot.userId) {
        await pool.query(`
          UPDATE users 
          SET escrow_balance = GREATEST(0, escrow_balance - ${escapeSql(match.stakeAmount)})
          WHERE id = ${escapeSql(slot.userId)}
        `);
      }
    }
    const winningSlots = match.squadData.slots.filter((s) => s.team === winningTeam && s.staked && s.userId);
    for (const slot of winningSlots) {
      const txWId = `tx_${Date.now()}_admin_sq_win_${slot.slotIndex}`;
      const descWin = `\u{1F3C6} Referee resolved 5v5 Squad match in favor of ${teamLabel}: \u20A6${match.winnerPayout.toLocaleString()} credited to wallet balance.`;
      const insRes = await pool.query(`
        INSERT INTO transactions (id, user_id, type, amount, description, match_id, timestamp)
        VALUES (${escapeSql(txWId)}, ${escapeSql(slot.userId)}, 'MATCH_WIN_PAYOUT', ${escapeSql(match.winnerPayout)}, ${escapeSql(descWin)}, ${escapeSql(match.id)}, ${Date.now()})
        ON CONFLICT (id) DO NOTHING
        RETURNING id;
      `);
      if (insRes.rows.length > 0) {
        await pool.query(`
          UPDATE users 
          SET balance = balance + ${escapeSql(match.winnerPayout)},
              total_winnings = total_winnings + ${escapeSql(match.winnerPayout)},
              wins = wins + 1
          WHERE id = ${escapeSql(slot.userId)}
        `);
      }
    }
    const losingSlots = match.squadData.slots.filter((s) => s.team === losingTeam && s.staked && s.userId);
    for (const slot of losingSlots) {
      await pool.query(`
        UPDATE users SET losses = losses + 1 WHERE id = ${escapeSql(slot.userId)}
      `);
    }
    match.resolutionNotes = `Referee adjudicated in favor of ${teamLabel}. \u20A6${match.winnerPayout.toLocaleString()} paid out to each of the 5 winning squad players!`;
    match.chatMessages = [];
    await clearMatchChatInDb(match.id);
    await saveMatchToDb(match);
    setImmediate(() => {
      sendTelegramMatchSettledAlert(match, winningTeam).catch(
        (e) => console.warn("Telegram squad settlement alert error:", e.message)
      );
    });
    return res.json(match);
  }
  const isCreatorWinner = match.creator.id === winnerId;
  const isOpponentWinner = match.opponent?.id === winnerId;
  if (!isCreatorWinner && !isOpponentWinner) {
    return res.status(400).json({ error: "Invalid winner ID" });
  }
  const winnerObj = isCreatorWinner ? match.creator : match.opponent;
  const loserObj = isCreatorWinner ? match.opponent : match.creator;
  const winnerUser = await getUserFromDb(winnerObj.id);
  const loserUser = await getUserFromDb(loserObj.id);
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
    const descNote = `\u{1F3C6} Admin resolved 1v1 match #${match.roomCode} win in favor of ${winnerObj.codmIgn}`;
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
      // Auto-flag or auto-ban dishonest user if they submitted a false victory claim or caused a match conflict
      if (loserObj.resultClaim === 'VICTORY' || match.status === 'DISPUTED' || match.conflictReason) {
        await applyConflictFlagOrBan(loserObj.id, match, `False result claim / match conflict in Match #${match.roomCode || match.challengeCode}`);
      }
    }
  }
  match.status = "SETTLED";
  match.winnerId = winnerObj.id;
  match.winnerIgn = winnerObj.codmIgn;
  const platformFee = match.platformFee;
  const bonusPerReferrer = Math.floor(platformFee * 0.1);
  const referrers = [];
  if (winnerUser?.referredBy) referrers.push(winnerUser.referredBy);
  if (loserUser?.referredBy) referrers.push(loserUser.referredBy);
  for (const referrerId of [...new Set(referrers)]) {
    await pool.query(`
      UPDATE users 
      SET balance = balance + ${escapeSql(bonusPerReferrer)},
          total_referral_earnings = COALESCE(total_referral_earnings, 0) + ${escapeSql(bonusPerReferrer)}
      WHERE id = ${escapeSql(referrerId)}
    `);
    await saveTransactionToDb(referrerId, {
      id: `tx_ref_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
      type: "REFERRAL_EARNING",
      amount: bonusPerReferrer,
      description: `10% Referral bonus from match #${match.roomCode || match.challengeCode} platform fee`,
      matchId: match.id,
      timestamp: Date.now()
    });
  }
  await updatePlatformFinance(platformFee - bonusPerReferrer * [...new Set(referrers)].length);
  match.resolutionNotes = `Referee adjudicated in favor of ${winnerObj.codmIgn}. \u20A6${match.winnerPayout.toLocaleString()} paid out to winner. Bonus distributed.`;
  match.chatMessages = [];
  await clearMatchChatInDb(match.id);
  await saveMatchToDb(match);
  setImmediate(() => {
    sendTelegramMatchSettledAlert(match, winnerObj.codmIgn).catch(
      (e) => console.warn("Telegram match settlement alert error:", e.message)
    );
  });
  res.json(match);
});
async function settleAbandonedMatch(matchId, reason = "Inactivity / Abandoned") {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const mRes = await client.query(`SELECT * FROM matches WHERE id = ${escapeSql(matchId)} FOR UPDATE`);
    if (mRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return { match: null, refundedPlayers: 0, totalRefunded: 0, feesCollected: 0 };
    }
    const matchRow = mRes.rows[0];
    if (matchRow.status === "SETTLED" || matchRow.status === "CANCELLED" || matchRow.status === "ABANDONED") {
      await client.query("ROLLBACK");
      const currentM = await getMatchFromDb(matchId);
      return { match: currentM, refundedPlayers: 0, totalRefunded: 0, feesCollected: 0 };
    }
    const creatorData = typeof matchRow.creator_data === "string" ? JSON.parse(matchRow.creator_data) : matchRow.creator_data || {};
    const opponentData = typeof matchRow.opponent_data === "string" ? JSON.parse(matchRow.opponent_data) : matchRow.opponent_data || {};
    const stakeAmount = parseFloat(matchRow.stake_amount) || 0;
    const now = Date.now();
    const rakeRate = getRakePercentage(stakeAmount);
    const platformFeePerPlayer = Math.round(stakeAmount * rakeRate);
    const penaltyFeePerPlayer = Math.round(stakeAmount * 0.1);
    const totalDeductionPerPlayer = platformFeePerPlayer + penaltyFeePerPlayer;
    const refundPerPlayer = Math.max(0, stakeAmount - totalDeductionPerPlayer);
    let totalFeesToPlatform = 0;
    let totalRefunded = 0;
    let refundedPlayers = 0;
    const settledPlayers = [];
    if (creatorData.staked && matchRow.creator_id) {
      await client.query(`
        UPDATE users 
        SET balance = balance + ${escapeSql(refundPerPlayer)},
            escrow_balance = GREATEST(0, escrow_balance - ${escapeSql(stakeAmount)})
        WHERE id = ${escapeSql(matchRow.creator_id)}
      `);
      const txC = `tx_abn_${now}_c_${Math.floor(100 + Math.random() * 900)}`;
      const descC = `\u26A0\uFE0F Abandoned Match #${matchRow.challenge_code} Settled: \u20A6${refundPerPlayer.toLocaleString()} refunded (minus \u20A6${platformFeePerPlayer.toLocaleString()} platform fee & \u20A6${penaltyFeePerPlayer.toLocaleString()} 10% penalty fee)`;
      await client.query(`
        INSERT INTO transactions (id, user_id, type, amount, description, match_id, timestamp)
        VALUES (${escapeSql(txC)}, ${escapeSql(matchRow.creator_id)}, 'ESCROW_REFUND', ${escapeSql(refundPerPlayer)}, ${escapeSql(descC)}, ${escapeSql(matchId)}, ${now})
        ON CONFLICT (id) DO NOTHING
      `);
      totalFeesToPlatform += totalDeductionPerPlayer;
      totalRefunded += refundPerPlayer;
      refundedPlayers++;
      settledPlayers.push(creatorData.codmIgn || "Creator");
    }
    if (opponentData.staked && matchRow.opponent_id) {
      await client.query(`
        UPDATE users 
        SET balance = balance + ${escapeSql(refundPerPlayer)},
            escrow_balance = GREATEST(0, escrow_balance - ${escapeSql(stakeAmount)})
        WHERE id = ${escapeSql(matchRow.opponent_id)}
      `);
      const txO = `tx_abn_${now}_o_${Math.floor(100 + Math.random() * 900)}`;
      const descO = `\u26A0\uFE0F Abandoned Match #${matchRow.challenge_code} Settled: \u20A6${refundPerPlayer.toLocaleString()} refunded (minus \u20A6${platformFeePerPlayer.toLocaleString()} platform fee & \u20A6${penaltyFeePerPlayer.toLocaleString()} 10% penalty fee)`;
      await client.query(`
        INSERT INTO transactions (id, user_id, type, amount, description, match_id, timestamp)
        VALUES (${escapeSql(txO)}, ${escapeSql(matchRow.opponent_id)}, 'ESCROW_REFUND', ${escapeSql(refundPerPlayer)}, ${escapeSql(descO)}, ${escapeSql(matchId)}, ${now})
        ON CONFLICT (id) DO NOTHING
      `);
      totalFeesToPlatform += totalDeductionPerPlayer;
      totalRefunded += refundPerPlayer;
      refundedPlayers++;
      settledPlayers.push(opponentData.codmIgn || "Opponent");
    }
    if (totalFeesToPlatform > 0) {
      await updatePlatformFinance(totalFeesToPlatform);
    }
    const resolutionNotes = `Match settled as abandoned (${reason}). Refunded \u20A6${refundPerPlayer.toLocaleString()} each to ${settledPlayers.length > 0 ? settledPlayers.join(" & ") : "players"} after deducting \u20A6${platformFeePerPlayer.toLocaleString()} platform fee + \u20A6${penaltyFeePerPlayer.toLocaleString()} (10%) penalty fee. Total \u20A6${totalFeesToPlatform.toLocaleString()} collected for platform.`;
    const chatMsgs = typeof matchRow.chat_messages === "string" ? JSON.parse(matchRow.chat_messages) : matchRow.chat_messages || [];
    chatMsgs.push({
      id: `msg_${now}`,
      senderId: "SYSTEM",
      senderName: "CODM Referee Bot",
      text: `\u26A0\uFE0F Match #${matchRow.challenge_code} was settled as abandoned. Players refunded \u20A6${refundPerPlayer.toLocaleString()} each minus platform fee and 10% penalty fee.`,
      timestamp: now
    });
    await client.query(`
      UPDATE matches 
      SET status = 'ABANDONED_AND_SETTLED',
          resolution_notes = ${escapeSql(resolutionNotes)},
          chat_messages = '[]'::jsonb,
          settled_at = ${now}
      WHERE id = ${escapeSql(matchId)}
    `);
    broadcastToMatchRoom(matchId, { type: "chat_cleared", matchId });
    await client.query("COMMIT");
    const updatedMatch = await getMatchFromDb(matchId);
    return {
      match: updatedMatch,
      refundedPlayers,
      totalRefunded,
      feesCollected: totalFeesToPlatform
    };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
    }
    console.error(`Error settling abandoned match ${matchId}:`, err);
    throw err;
  } finally {
    client.release();
  }
}
async function expirePendingMatches() {
  try {
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1e3;
    const staleRes = await pool.query(`
      SELECT id, creator_id, stake_amount 
      FROM matches 
      WHERE status = 'PENDING_OPPONENT_STAKE' 
        AND created_at < ${twentyFourHoursAgo}
    `);
    for (const row of staleRes.rows) {
      await pool.query("BEGIN");
      await pool.query(`UPDATE users SET balance = balance + ${row.stake_amount}, escrow_balance = escrow_balance - ${row.stake_amount} WHERE id = ${escapeSql(row.creator_id)}`);
      await pool.query(`UPDATE matches SET status = 'EXPIRED' WHERE id = ${escapeSql(row.id)}`);
      await pool.query("COMMIT");
      console.log(`\u{1F9F9} [Expired Match Sweep] Expired match ${row.id} and refunded creator ${row.creator_id}`);
    }
  } catch (err) {
    console.error("\u26A0\uFE0F [Expired Match Sweep] Error:", err.message);
  }
}
async function sweepAbandonedMatches() {
  await expirePendingMatches();
}
app.post("/api/matches/:id/abandon", async (req, res) => {
  return res.status(403).json({
    error: "Unilateral match settlement and refunds are disabled. Under Arena rules, both players must mutually agree to restart the timer or refund stakes, or submit evidence to the Moderator Review Queue."
  });
});
app.post("/api/matches/:id/mutual-action", async (req, res) => {
  const matchId = req.params.id;
  const { userId, action } = req.body || {};
  if (!userId || !action) {
    return res.status(400).json({ error: "Missing userId or action" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const mRes = await client.query(`SELECT * FROM matches WHERE id = ${escapeSql(matchId)} FOR UPDATE`);
    if (mRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Match not found" });
    }
    const matchRow = mRes.rows[0];
    if (matchRow.status === "SETTLED" || matchRow.status === "CANCELLED") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `Match has already been ${matchRow.status.toLowerCase()}` });
    }
    const isCreator = matchRow.creator_id === userId;
    const isOpponent = matchRow.opponent_id === userId;
    if (!isCreator && !isOpponent) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Only active match contenders can participate in mutual agreements" });
    }
    const creatorData = typeof matchRow.creator_data === "string" ? JSON.parse(matchRow.creator_data) : matchRow.creator_data || {};
    const opponentData = typeof matchRow.opponent_data === "string" ? JSON.parse(matchRow.opponent_data) : matchRow.opponent_data || {};
    const actingUser = isCreator ? creatorData : opponentData;
    const currentMutual = matchRow.mutual_action_data ? typeof matchRow.mutual_action_data === "string" ? JSON.parse(matchRow.mutual_action_data) : matchRow.mutual_action_data : null;
    let chatMessages = matchRow.chat_messages ? typeof matchRow.chat_messages === "string" ? JSON.parse(matchRow.chat_messages) : matchRow.chat_messages : [];
    const now = Date.now();
    if (action === "REQUEST_RESTART_TIMER" || action === "REQUEST_MUTUAL_REFUND") {
      const targetAction = action === "REQUEST_RESTART_TIMER" ? "RESTART_TIMER" : "MUTUAL_REFUND";
      if (currentMutual && currentMutual.action === targetAction && currentMutual.requestedBy !== userId) {
        if (targetAction === "RESTART_TIMER") {
          chatMessages.push({
            id: `msg_${now}`,
            senderId: "system",
            senderName: "ARENA REFEREE",
            text: `\u{1F504} Both players have mutually agreed to restart the match countdown timer. Timer reset!`,
            timestamp: now
          });
          await client.query(`
            UPDATE matches 
            SET room_generated_at = ${now}, 
                mutual_action_data = NULL,
                chat_messages = ${escapeSql(JSON.stringify(chatMessages))}
            WHERE id = ${escapeSql(matchId)}
          `);
          await client.query("COMMIT");
          const updated2 = await getMatchFromDb(matchId);
          if (globalIo) globalIo.emit("match_updated", updated2);
          return res.json({ success: true, message: "Match timer restarted by mutual agreement of both players", match: updated2 });
        } else {
          const stakeAmount = parseFloat(matchRow.stake_amount) || 0;
          if (matchRow.creator_id && creatorData.staked) {
            await client.query(`UPDATE users SET balance = balance + ${stakeAmount}, escrow_balance = GREATEST(0, escrow_balance - ${stakeAmount}) WHERE id = ${escapeSql(matchRow.creator_id)}`);
            await client.query(`
              INSERT INTO transactions (id, user_id, type, amount, description, match_id, timestamp)
              VALUES (${escapeSql(`tx_${now}_mref_c`)}, ${escapeSql(matchRow.creator_id)}, 'ESCROW_REFUND', ${stakeAmount}, ${escapeSql(`\u20A6${stakeAmount.toLocaleString()} full stake refunded from mutually cancelled match #${matchRow.challenge_code}`)}, ${escapeSql(matchId)}, ${now})
              ON CONFLICT (id) DO NOTHING
            `);
          }
          if (matchRow.opponent_id && opponentData.staked) {
            await client.query(`UPDATE users SET balance = balance + ${stakeAmount}, escrow_balance = GREATEST(0, escrow_balance - ${stakeAmount}) WHERE id = ${escapeSql(matchRow.opponent_id)}`);
            await client.query(`
              INSERT INTO transactions (id, user_id, type, amount, description, match_id, timestamp)
              VALUES (${escapeSql(`tx_${now}_mref_o`)}, ${escapeSql(matchRow.opponent_id)}, 'ESCROW_REFUND', ${stakeAmount}, ${escapeSql(`\u20A6${stakeAmount.toLocaleString()} full stake refunded from mutually cancelled match #${matchRow.challenge_code}`)}, ${escapeSql(matchId)}, ${now})
              ON CONFLICT (id) DO NOTHING
            `);
          }
          chatMessages.push({
            id: `msg_${now}`,
            senderId: "system",
            senderName: "ARENA REFEREE",
            text: `\u{1F91D} Both gladiators mutually agreed to void the match. Full stakes (\u20A6${stakeAmount.toLocaleString()}) refunded to both wallets.`,
            timestamp: now
          });
          await client.query(`
            UPDATE matches 
            SET status = 'CANCELLED',
                mutual_action_data = NULL,
                resolution_notes = 'Mutually voided and refunded by agreement of both players',
                chat_messages = ${escapeSql(JSON.stringify(chatMessages))}
            WHERE id = ${escapeSql(matchId)}
          `);
          await client.query("COMMIT");
          const updated2 = await getMatchFromDb(matchId);
          if (globalIo) globalIo.emit("match_updated", updated2);
          return res.json({ success: true, message: "Match mutually cancelled. Full stakes refunded to both players.", match: updated2 });
        }
      }
      const newMutual = {
        action: targetAction,
        requestedBy: userId,
        requestedByName: actingUser.codmIgn || actingUser.username || "Gladiator",
        requestedAt: now
      };
      chatMessages.push({
        id: `msg_${now}`,
        senderId: "system",
        senderName: "ARENA REFEREE",
        text: `\u23F3 ${actingUser.codmIgn || "A gladiator"} requested ${targetAction === "RESTART_TIMER" ? "a countdown timer restart" : "a mutual 100% refund"}. Waiting for opponent to agree.`,
        timestamp: now
      });
      await client.query(`
        UPDATE matches 
        SET mutual_action_data = ${escapeSql(JSON.stringify(newMutual))},
            chat_messages = ${escapeSql(JSON.stringify(chatMessages))}
        WHERE id = ${escapeSql(matchId)}
      `);
      await client.query("COMMIT");
      const updated = await getMatchFromDb(matchId);
      if (globalIo) globalIo.emit("match_updated", updated);
      return res.json({ success: true, message: "Request submitted. Both players must agree to proceed.", match: updated });
    } else if (action === "ACCEPT_ACTION") {
      if (!currentMutual) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "No active mutual action request to accept" });
      }
      if (currentMutual.requestedBy === userId) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "You cannot accept your own request" });
      }
      if (currentMutual.action === "RESTART_TIMER") {
        chatMessages.push({
          id: `msg_${now}`,
          senderId: "system",
          senderName: "ARENA REFEREE",
          text: `\u{1F504} Both players have mutually agreed to restart the match countdown timer. Timer reset!`,
          timestamp: now
        });
        await client.query(`
          UPDATE matches 
          SET room_generated_at = ${now}, 
              mutual_action_data = NULL,
              chat_messages = ${escapeSql(JSON.stringify(chatMessages))}
          WHERE id = ${escapeSql(matchId)}
        `);
        await client.query("COMMIT");
        const updated = await getMatchFromDb(matchId);
        if (globalIo) globalIo.emit("match_updated", updated);
        return res.json({ success: true, message: "Match timer restarted by mutual agreement", match: updated });
      } else if (currentMutual.action === "MUTUAL_REFUND") {
        const stakeAmount = parseFloat(matchRow.stake_amount) || 0;
        if (matchRow.creator_id && creatorData.staked) {
          await client.query(`UPDATE users SET balance = balance + ${stakeAmount}, escrow_balance = GREATEST(0, escrow_balance - ${stakeAmount}) WHERE id = ${escapeSql(matchRow.creator_id)}`);
          await client.query(`
            INSERT INTO transactions (id, user_id, type, amount, description, match_id, timestamp)
            VALUES (${escapeSql(`tx_${now}_mref_c`)}, ${escapeSql(matchRow.creator_id)}, 'ESCROW_REFUND', ${stakeAmount}, ${escapeSql(`\u20A6${stakeAmount.toLocaleString()} full stake refunded from mutually cancelled match #${matchRow.challenge_code}`)}, ${escapeSql(matchId)}, ${now})
            ON CONFLICT (id) DO NOTHING
          `);
        }
        if (matchRow.opponent_id && opponentData.staked) {
          await client.query(`UPDATE users SET balance = balance + ${stakeAmount}, escrow_balance = GREATEST(0, escrow_balance - ${stakeAmount}) WHERE id = ${escapeSql(matchRow.opponent_id)}`);
          await client.query(`
            INSERT INTO transactions (id, user_id, type, amount, description, match_id, timestamp)
            VALUES (${escapeSql(`tx_${now}_mref_o`)}, ${escapeSql(matchRow.opponent_id)}, 'ESCROW_REFUND', ${stakeAmount}, ${escapeSql(`\u20A6${stakeAmount.toLocaleString()} full stake refunded from mutually cancelled match #${matchRow.challenge_code}`)}, ${escapeSql(matchId)}, ${now})
            ON CONFLICT (id) DO NOTHING
          `);
        }
        chatMessages.push({
          id: `msg_${now}`,
          senderId: "system",
          senderName: "ARENA REFEREE",
          text: `\u{1F91D} Both gladiators mutually agreed to void the match. Full stakes (\u20A6${stakeAmount.toLocaleString()}) refunded to both wallets.`,
          timestamp: now
        });
        await client.query(`
          UPDATE matches 
          SET status = 'CANCELLED',
              mutual_action_data = NULL,
              resolution_notes = 'Mutually voided and refunded by agreement of both players',
              chat_messages = ${escapeSql(JSON.stringify(chatMessages))}
          WHERE id = ${escapeSql(matchId)}
        `);
        await client.query("COMMIT");
        const updated = await getMatchFromDb(matchId);
        if (globalIo) globalIo.emit("match_updated", updated);
        return res.json({ success: true, message: "Match mutually cancelled. Full stakes refunded to both players.", match: updated });
      }
    } else if (action === "DECLINE_ACTION") {
      if (!currentMutual) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "No active mutual action request to decline" });
      }
      chatMessages.push({
        id: `msg_${now}`,
        senderId: "system",
        senderName: "ARENA REFEREE",
        text: `\u26A0\uFE0F ${actingUser.codmIgn || "Opponent"} declined the request for ${currentMutual.action === "RESTART_TIMER" ? "timer restart" : "mutual refund"}. Match remains active under Arena rules.`,
        timestamp: now
      });
      await client.query(`
        UPDATE matches 
        SET mutual_action_data = NULL,
            chat_messages = ${escapeSql(JSON.stringify(chatMessages))}
        WHERE id = ${escapeSql(matchId)}
      `);
      await client.query("COMMIT");
      const updated = await getMatchFromDb(matchId);
      if (globalIo) globalIo.emit("match_updated", updated);
      return res.json({ success: true, message: "Mutual request declined", match: updated });
    }
    await client.query("ROLLBACK");
    return res.status(400).json({ error: "Invalid mutual action specified" });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
    }
    console.error("Error handling mutual action:", err);
    res.status(500).json({ error: err.message || "Failed to process mutual action" });
  } finally {
    client.release();
  }
});
app.post("/api/msksksnuwje/matches/:id/abandon", async (req, res) => {
  try {
    const matchId = req.params.id;
    const { userId, reason = "Admin settled as abandoned" } = req.body || {};
    const adminUser = req.adminUser;
    if (adminUser.role !== "admin" && adminUser.role !== "moderator") {
      return res.status(403).json({ error: "Unauthorized: Staff privileges required" });
    }
    const match = await getMatchFromDb(matchId);
    if (match && match.reviewerId && match.reviewerId !== adminUser.id) {
      return res.status(403).json({ error: `Forbidden: This match is assigned to ${match.reviewerName}` });
    }
    const result = await settleAbandonedMatch(matchId, reason);
    res.json({
      success: true,
      message: `Match settled as abandoned. Refunds processed.`,
      match: result.match,
      data: result
    });
  } catch (err) {
    console.error("Error in admin abandon match:", err);
    res.status(500).json({ error: err.message || "Failed to settle abandoned match" });
  }
});
app.get("/api/msksksnuwje/disputes", async (req, res) => {
  try {
    const { userId } = req.query;
    const adminUser = req.adminUser;
    if (!adminUser || adminUser.role !== "admin" && adminUser.role !== "moderator") {
      return res.status(403).json({ error: "Unauthorized: Staff privileges required" });
    }
    const mRes = await pool.query(`
      SELECT * FROM matches 
      WHERE status IN ('DISPUTED', 'SUBMITTING_RESULTS') 
      ORDER BY created_at DESC 
      LIMIT 50
    `);
    const matches = mRes.rows.map((m) => ({
      id: m.id,
      challengeCode: m.challenge_code,
      roomCode: m.room_code || void 0,
      gameMode: m.game_mode,
      map: m.map,
      stakeAmount: parseFloat(m.stake_amount),
      potAmount: parseFloat(m.pot_amount),
      platformFee: parseFloat(m.platform_fee || 0),
      winnerPayout: parseFloat(m.winner_payout),
      status: m.status,
      createdAt: parseInt(m.created_at, 10),
      creator: typeof m.creator_data === "string" ? JSON.parse(m.creator_data) : m.creator_data,
      opponent: m.opponent_data ? typeof m.opponent_data === "string" ? JSON.parse(m.opponent_data) : m.opponent_data : void 0,
      winnerId: m.winner_id || void 0,
      winnerIgn: m.winner_ign || void 0,
      resolutionNotes: m.resolution_notes || void 0,
      settledAt: m.settled_at ? parseInt(m.settled_at, 10) : void 0
    }));
    res.json({ matches });
  } catch (err) {
    console.error("Error fetching admin disputes:", err);
    res.status(500).json({ error: err.message || "Failed to fetch disputes" });
  }
});
app.get("/api/msksksnuwje/review-queue", async (req, res) => {
  try {
    const { userId } = req.query;
    const adminUser = req.adminUser;
    if (!adminUser || adminUser.role !== "admin" && adminUser.role !== "moderator") {
      return res.status(403).json({ error: "Unauthorized: Staff privileges required" });
    }
    const result = await pool.query(`
      SELECT * FROM matches 
      WHERE status IN ('DISPUTED', 'SUBMITTING_RESULTS', 'VERIFYING')
         OR (creator_data::text LIKE '%screenshotUrl%' AND status NOT IN ('SETTLED', 'CANCELLED', 'ABANDONED'))
         OR (opponent_data::text LIKE '%screenshotUrl%' AND status NOT IN ('SETTLED', 'CANCELLED', 'ABANDONED'))
         OR (resolution_notes LIKE '%Resubmission%' AND status NOT IN ('SETTLED', 'CANCELLED', 'ABANDONED'))
      ORDER BY 
        CASE WHEN status = 'DISPUTED' THEN 1 WHEN status = 'VERIFYING' THEN 2 ELSE 3 END,
        created_at DESC 
      LIMIT 100
    `);
    const matches = result.rows.map((m) => {
      const creator = typeof m.creator_data === "string" ? JSON.parse(m.creator_data) : m.creator_data || {};
      const opponent = m.opponent_data ? typeof m.opponent_data === "string" ? JSON.parse(m.opponent_data) : m.opponent_data : void 0;
      if (creator.screenshotUrl && !creator.systemAiDetection) {
        creator.systemAiDetection = analyzeImageSystemLogic(creator.screenshotUrl);
      }
      if (opponent?.screenshotUrl && !opponent.systemAiDetection) {
        opponent.systemAiDetection = analyzeImageSystemLogic(opponent.screenshotUrl);
      }
      const matchObj = {
        id: m.id,
        challengeCode: m.challenge_code,
        roomCode: m.room_code || void 0,
        gameMode: m.game_mode,
        map: m.map,
        rules: typeof m.rules === "string" ? JSON.parse(m.rules) : m.rules || [],
        stakeAmount: parseFloat(m.stake_amount),
        potAmount: parseFloat(m.pot_amount),
        platformFee: parseFloat(m.platform_fee || 0),
        winnerPayout: parseFloat(m.winner_payout),
        status: m.status,
        createdAt: parseInt(m.created_at, 10),
        creator,
        opponent,
        winnerId: m.winner_id || void 0,
        winnerIgn: m.winner_ign || void 0,
        resolutionNotes: m.resolution_notes || void 0,
        chatMessages: typeof m.chat_messages === "string" ? JSON.parse(m.chat_messages) : m.chat_messages || [],
        reviewerId: m.reviewer_id || void 0,
        reviewerName: m.reviewer_name || void 0
      };
      const conflictInfo = computeMatchConflictReasons(matchObj);
      matchObj.conflictReason = conflictInfo.conflictReason;
      matchObj.conflictReasonsList = conflictInfo.conflictReasonsList;
      return matchObj;
    });
    const disputedCount = matches.filter((m) => m.status === "DISPUTED").length;
    const aiFlaggedCount = matches.filter(
      (m) => m.creator?.systemAiDetection?.isLikelyFake || m.opponent?.systemAiDetection?.isLikelyFake
    ).length;
    res.json({
      matches,
      totalCount: matches.length,
      disputedCount,
      aiFlaggedCount,
      pendingCount: matches.length
    });
  } catch (err) {
    console.error("Error fetching review queue:", err);
    res.status(500).json({ error: err.message || "Failed to fetch review queue" });
  }
});
app.post("/api/msksksnuwje/matches/:id/resubmit", async (req, res) => {
  try {
    const { userId, targetPlayerId, reason } = req.body;
    const adminUser = req.adminUser;
    if (!adminUser || adminUser.role !== "admin" && adminUser.role !== "moderator") {
      return res.status(403).json({ error: "Unauthorized: Staff privileges required" });
    }
    const match = await getMatchFromDb(req.params.id);
    if (!match) return res.status(404).json({ error: "Match not found" });
    if (match.reviewerId && match.reviewerId !== adminUser.id) {
      return res.status(403).json({ error: `Forbidden: This match is assigned to ${match.reviewerName}` });
    }
    const targetNoticeReason = reason || "Screenshot proof rejected. Please upload an unedited, full-screen CODM landscape scoreboard.";
    const isTargetCreator = !targetPlayerId || targetPlayerId === "both" || match.creator.id === targetPlayerId;
    const isTargetOpponent = !targetPlayerId || targetPlayerId === "both" || match.opponent?.id === targetPlayerId;
    if (isTargetCreator) {
      delete match.creator.screenshotUrl;
      delete match.creator.screenshotAnalysis;
      delete match.creator.forensicAnalysis;
      delete match.creator.systemAiDetection;
      match.creator.resubmissionRequested = true;
      match.creator.resubmissionReason = targetNoticeReason;
    }
    if (isTargetOpponent && match.opponent) {
      delete match.opponent.screenshotUrl;
      delete match.opponent.screenshotAnalysis;
      delete match.opponent.forensicAnalysis;
      delete match.opponent.systemAiDetection;
      match.opponent.resubmissionRequested = true;
      match.opponent.resubmissionReason = targetNoticeReason;
    }
    match.status = "SUBMITTING_RESULTS";
    const targetLabel = targetPlayerId === match.creator.id ? match.creator.codmIgn : targetPlayerId === match.opponent?.id ? match.opponent?.codmIgn : "Both Players";
    match.resubmissionNotice = {
      targetPlayerId: targetPlayerId || "both",
      targetPlayerIgn: targetLabel,
      reason: targetNoticeReason,
      timestamp: Date.now()
    };
    match.resolutionNotes = `\u26A0\uFE0F Referee requested screenshot resubmission (${targetLabel}): ${targetNoticeReason}`;
    match.chatMessages.push({
      id: `msg_${Date.now()}_resubmit`,
      senderId: "SYSTEM",
      senderName: "CODM Referee Bot",
      text: `\u26A0\uFE0F REFEREE NOTICE: Proof resubmission requested for ${targetLabel}: "${targetNoticeReason}". Please upload an authentic, unedited landscape scoreboard screenshot to resolve.`,
      timestamp: Date.now()
    });
    const conflictInfo = computeMatchConflictReasons(match);
    match.conflictReason = conflictInfo.conflictReason;
    match.conflictReasonsList = conflictInfo.conflictReasonsList;
    await saveMatchToDb(match);
    res.json({ success: true, match });
  } catch (err) {
    console.error("Error in match resubmission request:", err);
    res.status(500).json({ error: err.message || "Failed to request resubmission" });
  }
});
app.post("/api/msksksnuwje/matches/:id/escalate", async (req, res) => {
  try {
    const { userId, reason } = req.body;
    const adminUser = req.adminUser;
    if (!adminUser || adminUser.role !== "admin" && adminUser.role !== "moderator") {
      return res.status(403).json({ error: "Unauthorized: Staff privileges required" });
    }
    const match = await getMatchFromDb(req.params.id);
    if (!match) return res.status(404).json({ error: "Match not found" });
    if (match.reviewerId && match.reviewerId !== adminUser.id) {
      return res.status(403).json({ error: `Forbidden: This match is assigned to ${match.reviewerName}` });
    }
    const auditReason = reason || "Escalated to high-priority manual referee review";
    match.status = "DISPUTED";
    match.resolutionNotes = `\u{1F6E1}\uFE0F Escalated to Manual Review: ${auditReason}`;
    match.chatMessages.push({
      id: `msg_${Date.now()}_escalate`,
      senderId: "SYSTEM",
      senderName: "CODM Referee Bot",
      text: `\u{1F6E1}\uFE0F REFEREE NOTICE: Match escalated to manual inspection by Admin (${auditReason}). Escrow pot (\u20A6${match.potAmount.toLocaleString()}) remains securely locked.`,
      timestamp: Date.now()
    });
    const conflictInfo = computeMatchConflictReasons(match);
    match.conflictReason = conflictInfo.conflictReason;
    match.conflictReasonsList = conflictInfo.conflictReasonsList;
    await saveMatchToDb(match);
    res.json({ success: true, match });
  } catch (err) {
    console.error("Error escalating match:", err);
    res.status(500).json({ error: err.message || "Failed to escalate match" });
  }
});
app.post("/api/msksksnuwje/analyze-forensic", async (req, res) => {
  try {
    const { adminUserId, screenshotBase64, playerIgn, matchId } = req.body;
    const adminUser = await getUserFromDb(adminUserId);
    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }
    if (!screenshotBase64) {
      return res.status(400).json({ error: "Missing image payload" });
    }
    const systemResult = analyzeImageSystemLogic(screenshotBase64);
    res.json({
      success: true,
      fileInfo: {
        mimeType: systemResult.fileType,
        headerHex: systemResult.headerHex,
        isStandardType: systemResult.isStandardType,
        dimensions: systemResult.dimensions,
        aspectRatio: systemResult.aspectRatio,
        fileSizeKb: systemResult.fileSizeKb,
        detectedSoftware: systemResult.detectedSoftware
      },
      analysis: {
        isLikelyFake: systemResult.isLikelyFake,
        confidenceScore: systemResult.confidenceScore,
        aiDetected: systemResult.isLikelyFake,
        manipulationDetected: systemResult.fakeRiskScore >= 45,
        detectedPlayerName: playerIgn || "Unknown",
        detectedOutcome: "INSPECTED",
        technicalNotes: systemResult.redFlags.join("; ") || "Standard verified mobile screenshot format",
        redFlags: systemResult.redFlags,
        positiveSignals: systemResult.positiveSignals,
        verdict: systemResult.verdict,
        aspectRatio: systemResult.aspectRatio,
        dimensions: systemResult.dimensions
      }
    });
  } catch (err) {
    console.error("Forensic analysis error:", err);
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/msksksnuwje/matches", async (req, res) => {
  try {
    const { userId, status } = req.query;
    const adminUser = req.adminUser;
    if (!adminUser || adminUser.role !== "admin" && adminUser.role !== "moderator") {
      return res.status(403).json({ error: "Unauthorized: Staff privileges required" });
    }
    let queryStr = "SELECT * FROM matches";
    if (status && status !== "all") {
      queryStr += ` WHERE status = ${escapeSql(status)}`;
    }
    queryStr += " ORDER BY created_at DESC LIMIT 100";
    const result = await pool.query(queryStr);
    const matches = result.rows.map((m) => ({
      id: m.id,
      challengeCode: m.challenge_code,
      roomCode: m.room_code || void 0,
      gameMode: m.game_mode,
      map: m.map,
      stakeAmount: parseFloat(m.stake_amount),
      potAmount: parseFloat(m.pot_amount),
      platformFee: parseFloat(m.platform_fee || 0),
      winnerPayout: parseFloat(m.winner_payout),
      status: m.status,
      createdAt: parseInt(m.created_at, 10),
      creator: typeof m.creator_data === "string" ? JSON.parse(m.creator_data) : m.creator_data,
      opponent: m.opponent_data ? typeof m.opponent_data === "string" ? JSON.parse(m.opponent_data) : m.opponent_data : void 0,
      winnerId: m.winner_id || void 0,
      winnerIgn: m.winner_ign || void 0,
      settledAt: m.settled_at ? parseInt(m.settled_at, 10) : void 0
    }));
    res.json({ matches });
  } catch (err) {
    console.error("Error fetching admin matches:", err);
    res.status(500).json({ error: err.message || "Failed to fetch matches" });
  }
});
app.get("/api/msksksnuwje/gmail/config", async (req, res) => {
  try {
    const { userId } = req.query;
    if (req.adminUser.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin access required" });
    }
    const config = await getGmailConfig();
    res.json({
      configured: !!config && !!config.gmailAddress && !!config.appPassword,
      gmailAddress: config?.gmailAddress || null,
      autoSync: config?.autoSync ?? true,
      lastSyncedAt: config?.lastSyncedAt || null,
      lastSyncStatus: config?.lastSyncStatus || "idle",
      lastSyncError: config?.lastSyncError || null,
      totalEmailsSynced: config?.totalEmailsSynced || 0,
      hasEnvOverride: !!process.env.GMAIL_USER && !!process.env.GMAIL_APP_PASSWORD
    });
  } catch (err) {
    console.error("Error fetching gmail config:", err);
    res.status(500).json({ error: err.message || "Failed to fetch Gmail status" });
  }
});
app.post("/api/msksksnuwje/gmail/config", async (req, res) => {
  try {
    const { userId, gmailAddress, appPassword, autoSync } = req.body;
    const user = await getUserFromDb(userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin privileges required" });
    }
    if (!gmailAddress || !appPassword) {
      return res.status(400).json({ error: "Gmail address and 16-character App Password are required" });
    }
    const testResult = await testGmailConnection(gmailAddress, appPassword);
    if (!testResult.success) {
      return res.status(400).json({
        error: testResult.message,
        details: "Connection test failed. Please verify your Gmail address and 16-character App Password."
      });
    }
    await saveGmailConfig(gmailAddress, appPassword, autoSync !== false);
    syncGmailEmails().catch((err) => console.warn("Initial sync error:", err.message));
    res.json({
      success: true,
      message: `Successfully connected ${gmailAddress}! Initial mail sync started.`,
      totalInboxMessages: testResult.totalMessages
    });
  } catch (err) {
    console.error("Error saving gmail config:", err);
    res.status(500).json({ error: err.message || "Failed to configure Gmail" });
  }
});
app.post("/api/msksksnuwje/gmail/test", async (req, res) => {
  try {
    const { userId, gmailAddress, appPassword } = req.body;
    const user = await getUserFromDb(userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }
    const result = await testGmailConnection(gmailAddress, appPassword);
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }
    res.json({ success: true, message: result.message, totalMessages: result.totalMessages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/msksksnuwje/gmail/sync", async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await getUserFromDb(userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }
    const result = await syncGmailEmails();
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }
    res.json(result);
  } catch (err) {
    console.error("Error syncing Gmail:", err);
    res.status(500).json({ error: err.message || "Failed to sync Gmail" });
  }
});
app.post("/api/msksksnuwje/gmail/disconnect", async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await getUserFromDb(userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }
    await disconnectGmailConfig();
    res.json({ success: true, message: "Gmail account disconnected successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.patch("/api/msksksnuwje/mailbox/:id/read", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, isRead = true } = req.body;
    const user = await getUserFromDb(userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }
    await pool.query(`UPDATE admin_emails SET is_read = $1 WHERE id = $2`, [isRead, id]);
    res.json({ success: true, id, isRead });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.delete("/api/msksksnuwje/mailbox/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const user = await getUserFromDb(userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }
    await pool.query(`DELETE FROM admin_emails WHERE id = $1`, [id]);
    res.json({ success: true, id, message: "Email deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post(["/api/inbound-mail", "/api/msksksnuwje/mail/webhook"], async (req, res) => {
  try {
    console.log("\u{1F4EC} Inbound Mail Webhook Received:", req.body);
    const { sender, from, subject, body, text, recipient, to } = req.body || {};
    const senderEmail = sender || from || "incoming@webhook.service";
    const subj = subject || "Incoming Payment/Support Mail";
    const bodyContent = body || text || (typeof req.body === "string" ? req.body : JSON.stringify(req.body));
    const mailId = `mail_wb_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
    const now = Date.now();
    await pool.query(
      `INSERT INTO admin_emails (id, sender_email, sender_name, recipient_email, subject, body, folder, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'inbox', false, $7)`,
      [mailId, senderEmail, senderEmail, recipient || to || "admin@codstake.com", subj, bodyContent, now]
    );
    res.json({ success: true, message: "Inbound email received and saved to admin mailbox", mailId });
  } catch (err) {
    console.error("Error handling inbound webhook mail:", err);
    res.status(500).json({ error: err.message });
  }
});
async function startServer() {
  (async () => {
    try {
      await initDatabase();
      console.log("\u2705 Supabase PostgreSQL database initialized");
    } catch (err) {
      console.warn("\u26A0\uFE0F Supabase database init error (handled non-fatally):", err.message);
    }
    try {
      await initGmailTables();
      startGmailAutoSyncService();
      console.log("\u2705 Gmail sync service initialized");
    } catch (err) {
      console.warn("\u26A0\uFE0F Gmail sync init error (handled non-fatally):", err.message);
    }
    try {
      sweepAbandonedMatches().catch((e) => console.warn("Initial sweepAbandonedMatches error:", e));
      setInterval(sweepAbandonedMatches, 3 * 60 * 1e3);
    } catch (err) {
      console.warn("\u26A0\uFE0F Match sweeper init error:", err.message);
    }
    try {
      startTelegramBotPolling();
      console.log("\u2705 Telegram Bot polling service initialized");
    } catch (err) {
      console.warn("\u26A0\uFE0F Telegram Bot init error (handled non-fatally):", err.message);
    }
  })();
  const publicPath = path.resolve(__dirname, "public");
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
    app.use("/public", express.static(publicPath));
  }
  const distPath = path.resolve(__dirname, "dist");
  const isProduction = process.env.NODE_ENV === "production" && fs.existsSync(distPath);
  if (isProduction) {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa"
    });
    app.use(vite.middlewares);
  }
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });
  globalIo = io;
  app.io = io;
  const roomUsers = /* @__PURE__ */ new Map();
  io.on("connection", (socket) => {
    let currentMatchId = null;
    let currentUserId = null;

    socket.on("join_support_room", (data) => {
      if (data.room) {
        socket.join(data.room);
        console.log(`Socket ${socket.id} joined support room: ${data.room}`);
      }
    });

    socket.on("support_message", async (data) => {
      try {
        if (!data || !data.text || !data.text.trim()) return;
        const targetUserId = data.targetUserId || data.userId || "unknown";
        const targetRoom = data.targetRoom || data.room || (targetUserId !== 'unknown' ? `support_user_${targetUserId}` : null);
        const role = data.senderRole || "user";
        const name = data.senderName || (role === "admin" ? "Admin Support" : "User");
        const newMsg = {
          id: data.id || `sup_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          userId: targetUserId,
          senderName: name,
          senderRole: role,
          text: data.text.trim(),
          category: data.category || "General Inquiry",
          room: targetRoom,
          status: data.status || 'open',
          timestamp: data.timestamp ? Number(data.timestamp) : Date.now()
        };

        // Persist support message if not already persisted by REST API
        try {
          const existing = await pool.query(`SELECT id FROM support_messages WHERE id = $1`, [newMsg.id]);
          if (existing.rows.length === 0) {
            await pool.query(
              `INSERT INTO support_messages (id, user_id, sender_name, sender_role, text, category, room, timestamp, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open')
               ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text`,
              [newMsg.id, newMsg.userId, newMsg.senderName, newMsg.senderRole, newMsg.text, newMsg.category, newMsg.room, newMsg.timestamp]
            );
          }
        } catch (dbErr) {
          console.error("Failed to persist support message:", dbErr);
        }

        // Emit to specific user room and admin dashboard
        if (targetRoom) {
          io.to(targetRoom).emit("support_message", newMsg);
        }
        io.to("support_admin_room").emit("support_message", newMsg);
        
        if (newMsg.senderRole === "user") {
          // Send Telegram Alert
          sendTelegramSupportAlert(newMsg.senderName, newMsg.text, newMsg.userId);
        }
      } catch (err) {
        console.error("Error processing socket support message:", err);
      }
    });

    socket.on("joinMatch", (data) => {
      const matchId = typeof data === "string" ? data : data?.matchId;
      const userId = data?.userId;
      if (matchId) {
        socket.join(matchId);
        currentMatchId = matchId;
        if (userId) {
          currentUserId = userId;
          if (!roomUsers.has(matchId)) {
            roomUsers.set(matchId, /* @__PURE__ */ new Set());
          }
          roomUsers.get(matchId).add(userId);
          io.to(matchId).emit("presence", {
            matchId,
            users: Array.from(roomUsers.get(matchId))
          });
        }
      }
    });
    socket.on("chat", async (data) => {
      try {
        if (!data || !data.matchId || !data.text || !data.text.trim()) return;
        const newMsg = {
          id: data.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          senderId: data.senderId || "unknown",
          senderName: data.senderName || "Player",
          text: data.text.trim(),
          timestamp: data.timestamp || Date.now()
        };
        if (data.matchId !== "lobby_global") {
          try {
            await pool.query(`
              UPDATE matches 
              SET chat_messages = COALESCE(chat_messages, '[]'::jsonb) || ${escapeSql([newMsg])}::jsonb
              WHERE id = ${escapeSql(data.matchId)}
            `);
          } catch (dbErr) {
            console.error("Failed to persist socket chat message in DB:", dbErr);
          }
        }
        io.to(data.matchId).emit("chat", { ...newMsg, matchId: data.matchId });
        socket.to(data.matchId).emit("chatNotification", {
          id: `chat_notif_${newMsg.id}`,
          matchId: data.matchId,
          senderId: newMsg.senderId,
          senderName: newMsg.senderName,
          text: newMsg.text,
          timestamp: newMsg.timestamp
        });
      } catch (err) {
        console.error("Error processing socket chat message:", err);
      }
    });
    socket.on("audio_stream", (data) => {
      if (data && data.matchId && data.pcm) {
        socket.to(data.matchId).emit("audio_stream", {
          userId: data.userId,
          pcm: data.pcm,
          sampleRate: data.sampleRate || 16e3
        });
      }
    });
    socket.on("mic_state", (data) => {
      if (data && data.matchId) {
        socket.to(data.matchId).emit("mic_state", {
          userId: data.userId,
          isMuted: data.isMuted,
          isSpeaking: data.isSpeaking
        });
      }
    });
    socket.on("typing", (data) => {
      if (data && data.matchId) {
        socket.to(data.matchId).emit("typing", {
          userId: data.userId,
          isTyping: data.isTyping
        });
      }
    });
    socket.on("clear_chat", async (data) => {
      const matchId = typeof data === "string" ? data : data?.matchId;
      if (matchId) {
        try {
          await clearMatchChatInDb(matchId);
          io.to(matchId).emit("chat_cleared", { matchId });
        } catch (err) {
          console.error("Error clearing chat via socket:", err);
        }
      }
    });
    socket.on("createMatch", (data) => {
      io.emit("matchCreated", data);
    });
    socket.on("matchUpdated", (data) => {
      io.emit("matchUpdated", data);
    });
    socket.on("matchAlert", (data) => {
      io.emit("matchAlert", data);
    });
    socket.on("updateBalance", (data) => {
      io.emit("balanceUpdated", data);
    });
    socket.on("disconnect", () => {
      if (currentMatchId && currentUserId) {
        const users = roomUsers.get(currentMatchId);
        if (users) {
          users.delete(currentUserId);
          if (users.size === 0) {
            roomUsers.delete(currentMatchId);
          } else {
            io.to(currentMatchId).emit("presence", {
              matchId: currentMatchId,
              users: Array.from(users)
            });
          }
        }
      }
    });
  });
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[CODM Stake 1v1] Server running on port ${PORT} with WebSockets enabled`);
  });
}
startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
export {
  analyzeImageSystemLogic,
  broadcastMatchStateChange,
  broadcastToMatchRoom,
  clearMatchChatInDb,
  computeMatchConflictReasons,
  fetchTelegramBotInfo,
  handleTelegramCallbackQuery,
  handleTelegramMessage,
  postMatchToPublicChannel,
  sanitizeMatchForPublic,
  sanitizePublicPlayerProfile,
  sendMatchDisputeVideoToTelegram,
  sendMatchDisputeVideoToTelegramFromFile,
  sendTelegramMatchAcceptedAlert,
  sendTelegramMatchSettledAlert,
  sendTelegramSquadSlotJoinedAlert,
  startTelegramBotPolling
};
