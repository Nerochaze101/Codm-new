import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { pool } from './db.js';
import crypto from 'crypto';

export interface GmailConfig {
  id: string;
  gmailAddress: string;
  appPassword?: string;
  autoSync: boolean;
  lastSyncedAt: number | null;
  lastSyncStatus: 'idle' | 'success' | 'error' | 'syncing';
  lastSyncError: string | null;
  totalEmailsSynced: number;
  updatedAt: number;
}

export interface AdminEmail {
  id: string;
  senderEmail: string;
  senderName: string;
  recipientEmail: string;
  subject: string;
  body: string;
  folder: string;
  isRead: boolean;
  createdAt: number;
}

// Initialize tables in Supabase Postgres
export async function initGmailTables() {
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
        created_at BIGINT NOT NULL
      );
    `);
    console.log('✅ Gmail & Admin Email tables verified in database');
  } catch (err: any) {
    console.error('Error initializing Gmail tables:', err.message);
  }
}

// Retrieve active Gmail configuration (from DB or fallback to environment variables)
export async function getGmailConfig(): Promise<GmailConfig | null> {
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
        lastSyncStatus: (row.last_sync_status as any) || 'idle',
        lastSyncError: row.last_sync_error || null,
        totalEmailsSynced: parseInt(row.total_emails_synced || 0, 10),
        updatedAt: parseInt(row.updated_at || Date.now(), 10),
      };
    }

    // Fallback: Check process.env (useful for Render deployment environment variables)
    const envUser = process.env.GMAIL_USER;
    const envPass = process.env.GMAIL_APP_PASSWORD;
    if (envUser && envPass) {
      return {
        id: 'main',
        gmailAddress: envUser.trim(),
        appPassword: envPass.trim(),
        autoSync: true,
        lastSyncedAt: null,
        lastSyncStatus: 'idle',
        lastSyncError: null,
        totalEmailsSynced: 0,
        updatedAt: Date.now(),
      };
    }

    return null;
  } catch (err: any) {
    console.error('Error fetching gmail config:', err.message);
    return null;
  }
}

// Save or update Gmail credentials
export async function saveGmailConfig(
  gmailAddress: string,
  appPassword: string,
  autoSync: boolean = true
): Promise<void> {
  await initGmailTables();
  const cleanEmail = gmailAddress.trim().toLowerCase();
  const cleanPass = appPassword.trim().replace(/\s+/g, '');
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

// Disconnect Gmail
export async function disconnectGmailConfig(): Promise<void> {
  await initGmailTables();
  await pool.query(`DELETE FROM gmail_config WHERE id = 'main'`);
}

// Test IMAP connection
export async function testGmailConnection(
  gmailAddress?: string,
  appPassword?: string
): Promise<{ success: boolean; message: string; totalMessages?: number }> {
  let user = gmailAddress;
  let pass = appPassword;

  if (!user || !pass) {
    const config = await getGmailConfig();
    if (!config || !config.gmailAddress || !config.appPassword) {
      return {
        success: false,
        message: 'No Gmail credentials configured. Please provide your Gmail and App Password.',
      };
    }
    user = config.gmailAddress;
    pass = config.appPassword;
  }

  const cleanEmail = user.trim().toLowerCase();
  const cleanPass = pass.trim().replace(/\s+/g, '');

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: cleanEmail,
      pass: cleanPass,
    },
    logger: false,
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 12000,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    const total = client.mailbox && typeof client.mailbox === 'object' ? (client.mailbox.exists || 0) : 0;
    lock.release();
    await client.logout();

    return {
      success: true,
      message: `Connected successfully to ${cleanEmail}! Inbox contains ${total} message(s).`,
      totalMessages: total,
    };
  } catch (err: any) {
    console.error('Gmail test connection failed:', err);
    let errorMsg = err.message || 'Failed to connect to Gmail IMAP';
    if (errorMsg.includes('Invalid credentials') || errorMsg.includes('Username and Password not accepted')) {
      errorMsg =
        'Google rejected credentials. Ensure 2-Step Verification is ON and you are using a 16-character App Password (not your normal Google account password).';
    }
    return {
      success: false,
      message: errorMsg,
    };
  }
}

// Fetch & Sync recent emails from Gmail INBOX
export async function syncGmailEmails(): Promise<{
  success: boolean;
  newEmailsCount: number;
  totalInboxCount: number;
  message: string;
}> {
  const config = await getGmailConfig();
  if (!config || !config.gmailAddress || !config.appPassword) {
    return {
      success: false,
      newEmailsCount: 0,
      totalInboxCount: 0,
      message: 'Gmail is not connected. Please connect your Gmail address and App Password.',
    };
  }

  const cleanEmail = config.gmailAddress.trim().toLowerCase();
  const cleanPass = config.appPassword.trim().replace(/\s+/g, '');

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: cleanEmail,
      pass: cleanPass,
    },
    logger: false,
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 15000,
  });

  try {
    await pool.query(
      `UPDATE gmail_config SET last_sync_status = 'syncing' WHERE id = 'main'`
    );

    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    const total = client.mailbox && typeof client.mailbox === 'object' ? (client.mailbox.exists || 0) : 0;

    let newCount = 0;

    if (total > 0) {
      // Fetch up to the last 35 messages to balance speed and completeness
      const startSeq = Math.max(1, total - 35);
      const range = `${startSeq}:*`;

      for await (const msg of client.fetch(range, { envelope: true, source: true, flags: true })) {
        try {
          if (!msg.source) continue;
          const parsed: any = await simpleParser(msg.source);
          const rawId = parsed.messageId || `${cleanEmail}_${msg.uid || msg.seq}_${parsed.date?.getTime() || Date.now()}`;
          const mailId = 'mail_gm_' + crypto.createHash('md5').update(rawId).digest('hex').substring(0, 24);

          const senderEmail = parsed.from?.value?.[0]?.address || 'unknown@gmail.com';
          const senderName = parsed.from?.value?.[0]?.name || senderEmail;
          const subject = parsed.subject || '(No Subject)';
          const bodyText = parsed.text || (parsed.html ? parsed.html.replace(/<[^>]+>/g, ' ').substring(0, 2000) : '(Empty email body)');
          const mailTime = parsed.date ? parsed.date.getTime() : Date.now();

          // Check if already in database
          const existing = await pool.query(`SELECT id FROM admin_emails WHERE id = $1`, [mailId]);
          if (existing.rows.length === 0) {
            await pool.query(
              `INSERT INTO admin_emails (id, sender_email, sender_name, recipient_email, subject, body, folder, is_read, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, 'inbox', false, $7)`,
              [mailId, senderEmail, senderName, cleanEmail, subject, bodyText, mailTime]
            );
            newCount++;
          }
        } catch (msgErr: any) {
          console.warn('Error parsing single message:', msgErr.message);
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
      message: `Sync successful! Fetched ${newCount} new email(s) from ${cleanEmail}. (Total in Inbox: ${total})`,
    };
  } catch (err: any) {
    console.error('Error during Gmail sync:', err);
    const now = Date.now();
    const errorMsg = err.message || 'Unknown sync error';
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
      message: errorMsg,
    };
  }
}

// Background auto-sync scheduler (runs every 3 minutes if auto-sync is enabled)
let autoSyncInterval: NodeJS.Timeout | null = null;

export function startGmailAutoSyncService() {
  if (autoSyncInterval) return;

  console.log('📬 Gmail Auto-Sync background service initialized (polling every 3m)');
  // Initial check after 10 seconds
  setTimeout(async () => {
    try {
      const config = await getGmailConfig();
      if (config && config.autoSync && config.gmailAddress && config.appPassword) {
        console.log(`📬 Running initial Gmail sync for ${config.gmailAddress}...`);
        await syncGmailEmails();
      }
    } catch (e: any) {
      console.warn('Initial sync warning:', e.message);
    }
  }, 10000);

  autoSyncInterval = setInterval(async () => {
    try {
      const config = await getGmailConfig();
      if (config && config.autoSync && config.gmailAddress && config.appPassword) {
        console.log(`📬 Auto-syncing Gmail for ${config.gmailAddress}...`);
        await syncGmailEmails();
      }
    } catch (e: any) {
      console.warn('Periodic Gmail sync warning:', e.message);
    }
  }, 180000); // 3 minutes
}
