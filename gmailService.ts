import tls from 'tls';
import crypto from 'crypto';
import { pool } from './db.js';

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

// Dynamic loader for imapflow & mailparser to avoid ERR_MODULE_NOT_FOUND on Render
async function loadImapflow() {
  try {
    const imapflowMod = await import('imapflow');
    const mailparserMod = await import('mailparser');
    return {
      ImapFlow: imapflowMod.ImapFlow,
      simpleParser: mailparserMod.simpleParser,
    };
  } catch (err: any) {
    // Graceful fallback to native TLS IMAP engine
    return null;
  }
}

// Decode RFC 2047 MIME encoded-word headers (e.g. =?UTF-8?B?...?= or =?UTF-8?Q?...?=)
function decodeMimeHeader(raw: string): string {
  if (!raw) return '';
  return raw.replace(/=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g, (_, charset, encoding, text) => {
    try {
      if (encoding.toUpperCase() === 'B') {
        return Buffer.from(text, 'base64').toString(charset.toLowerCase() === 'utf-8' ? 'utf8' : 'latin1');
      } else if (encoding.toUpperCase() === 'Q') {
        return text
          .replace(/=([0-9A-Fa-f]{2})/g, (_match: string, hex: string) => String.fromCharCode(parseInt(hex, 16)))
          .replace(/_/g, ' ');
      }
    } catch {
      return text;
    }
    return text;
  });
}

// Parse sender name & email from a From header string
function parseAddress(fromStr: string): { name: string; email: string } {
  if (!fromStr) return { name: 'Unknown', email: 'unknown@gmail.com' };
  const match = fromStr.match(/^(?:"?([^"]*)"?\s)?(?:<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?)$/);
  if (match) {
    const name = decodeMimeHeader(match[1]?.trim() || '');
    const email = match[2]?.trim().toLowerCase() || 'unknown@gmail.com';
    return { name: name || email, email };
  }
  return { name: decodeMimeHeader(fromStr.trim()), email: fromStr.trim() };
}

// Native TLS IMAP client for Gmail (Zero external dependencies, 100% Render compatible)
class NativeGmailImapClient {
  private host = 'imap.gmail.com';
  private port = 993;
  private socket: tls.TLSSocket | null = null;
  private tagCounter = 1;

  async connect(email: string, appPass: string): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      let resolved = false;
      let timer: NodeJS.Timeout | null = null;

      const finish = (res: { success: boolean; message: string }) => {
        if (!resolved) {
          resolved = true;
          if (timer) clearTimeout(timer);
          resolve(res);
        }
      };

      timer = setTimeout(() => {
        finish({ success: false, message: 'Connection to Gmail IMAP timed out (15s)' });
      }, 15000);

      try {
        const s = tls.connect(
          {
            host: this.host,
            port: this.port,
            rejectUnauthorized: false,
            timeout: 12000,
          },
          () => {
            // TLS connection established
          }
        );
        this.socket = s;

        let buffer = '';
        let loginTag = '';
        let loginSent = false;

        const onData = (chunk: Buffer) => {
          buffer += chunk.toString();

          if (!loginSent && buffer.includes('* OK')) {
            loginSent = true;
            loginTag = 'A' + this.tagCounter++;
            s.write(`${loginTag} LOGIN "${email}" "${appPass}"\r\n`);
            return;
          }

          if (loginSent && loginTag) {
            const lines = buffer.split('\r\n');
            for (const line of lines) {
              if (line.startsWith(loginTag + ' OK')) {
                s.off('data', onData);
                finish({ success: true, message: 'Authentication successful' });
                return;
              } else if (line.startsWith(loginTag + ' NO') || line.startsWith(loginTag + ' BAD')) {
                s.off('data', onData);
                let errorMsg = 'Google rejected credentials.';
                if (line.includes('AUTHENTICATIONFAILED') || line.includes('Invalid credentials')) {
                  errorMsg =
                    'Google rejected credentials. Ensure 2-Step Verification is ON and you are using a 16-character App Password (not your normal Google account password).';
                }
                finish({ success: false, message: errorMsg });
                return;
              }
            }
          }
        };

        s.on('data', onData);
        s.on('error', (err) => {
          finish({ success: false, message: `TLS socket error: ${err.message}` });
        });
        s.on('timeout', () => {
          finish({ success: false, message: 'Connection to Gmail IMAP timed out' });
          this.close();
        });
      } catch (err: any) {
        finish({ success: false, message: err.message || 'Failed to initialize TLS socket' });
      }
    });
  }

  async sendCommand(command: string, timeoutMs = 15000): Promise<{ ok: boolean; response: string; full: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ ok: false, response: 'Socket not connected', full: '' });
        return;
      }

      const tag = 'A' + this.tagCounter++;
      let buffer = '';
      let timer: NodeJS.Timeout;

      const onData = (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\r\n');
        for (const line of lines) {
          if (line.startsWith(tag + ' OK')) {
            clearTimeout(timer);
            this.socket?.off('data', onData);
            resolve({ ok: true, response: line, full: buffer });
            return;
          } else if (line.startsWith(tag + ' NO') || line.startsWith(tag + ' BAD')) {
            clearTimeout(timer);
            this.socket?.off('data', onData);
            resolve({ ok: false, response: line, full: buffer });
            return;
          }
        }
      };

      timer = setTimeout(() => {
        this.socket?.off('data', onData);
        resolve({ ok: false, response: 'Command timed out', full: buffer });
      }, timeoutMs);

      this.socket.on('data', onData);
      this.socket.write(`${tag} ${command}\r\n`);
    });
  }

  async selectInbox(): Promise<{ ok: boolean; total: number }> {
    const res = await this.sendCommand('SELECT INBOX');
    if (!res.ok) return { ok: false, total: 0 };
    const match = res.full.match(/\*\s+(\d+)\s+EXISTS/i);
    const total = match ? parseInt(match[1], 10) : 0;
    return { ok: true, total };
  }

  async fetchMessages(start: number, end: number): Promise<Array<{
    subject: string;
    from: string;
    date: number;
    body: string;
    messageId: string;
  }>> {
    if (start < 1 || end < start) return [];
    const res = await this.sendCommand(`FETCH ${start}:${end} (BODY.PEEK[HEADER] BODY.PEEK[TEXT])`, 20000);
    if (!res.ok && !res.full.includes('* ')) return [];

    const messages: Array<{
      subject: string;
      from: string;
      date: number;
      body: string;
      messageId: string;
    }> = [];

    // Separate by message blocks
    const rawChunks = res.full.split(/(?=\*\s+\d+\s+FETCH)/g);
    for (const chunk of rawChunks) {
      if (!chunk.includes('FETCH')) continue;

      let subject = '(No Subject)';
      let from = 'unknown@gmail.com';
      let date = Date.now();
      let messageId = '';
      let body = '';

      // Extract headers
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

      // Extract body snippet
      const bodyPart = chunk.split(/BODY\[TEXT\](?:\s*\{\d+\})?\r\n/i)[1];
      if (bodyPart) {
        // Strip trailing IMAP command closing tags
        const cleanBody = bodyPart.split(/\r\n\)\r\n|\r\nA\d+\s+OK/)[0] || '';
        // Decode simple quoted printable if found
        body = cleanBody
          .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
          .replace(/<[^>]+>/g, ' ')
          .substring(0, 3000)
          .trim();
      }

      if (!messageId) {
        messageId = crypto.createHash('md5').update(`${from}_${subject}_${date}`).digest('hex');
      }

      messages.push({
        subject,
        from,
        date,
        body: body || '(Email content)',
        messageId,
      });
    }

    return messages;
  }

  async close() {
    try {
      if (this.socket && !this.socket.destroyed) {
        this.socket.write('TAG_OUT LOGOUT\r\n');
        setTimeout(() => {
          try {
            this.socket?.destroy();
          } catch {}
        }, 500);
      }
    } catch {}
  }
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

    // Fallback: Check process.env (convenient for Render environment variables)
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

// Test IMAP connection (uses imapflow if installed, or native TLS client)
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

  // 1. Primary engine: Pure Node.js TLS IMAP Client (fast, zero dependencies)
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
      return { success: false, message: 'Authenticated, but could not select INBOX.' };
    }

    return {
      success: true,
      message: `Connected successfully to ${cleanEmail}! Inbox contains ${inbox.total} message(s).`,
      totalMessages: inbox.total,
    };
  } catch (nativeErr: any) {
    await nativeClient.close();
  }

  // 2. Secondary fallback: ImapFlow if available
  const engines = await loadImapflow();
  if (engines) {
    try {
      const client = new engines.ImapFlow({
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        auth: { user: cleanEmail, pass: cleanPass },
        logger: false,
        tls: { rejectUnauthorized: false },
        connectionTimeout: 10000,
      });

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
      let errorMsg = err.message || 'Failed to connect to Gmail IMAP';
      if (errorMsg.includes('Invalid credentials') || errorMsg.includes('Username and Password not accepted')) {
        errorMsg =
          'Google rejected credentials. Ensure 2-Step Verification is ON and you are using a 16-character App Password (not your normal Google account password).';
      }
      return { success: false, message: errorMsg };
    }
  }

  return { success: false, message: 'Could not connect to Gmail IMAP server' };
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

  await pool.query(`UPDATE gmail_config SET last_sync_status = 'syncing' WHERE id = 'main'`);

  // 1. Try with ImapFlow if package is available
  const engines = await loadImapflow();
  if (engines) {
    try {
      const client = new engines.ImapFlow({
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        auth: { user: cleanEmail, pass: cleanPass },
        logger: false,
        tls: { rejectUnauthorized: false },
        connectionTimeout: 15000,
      });

      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      const total = client.mailbox && typeof client.mailbox === 'object' ? (client.mailbox.exists || 0) : 0;
      let newCount = 0;

      if (total > 0) {
        const startSeq = Math.max(1, total - 35);
        const range = `${startSeq}:*`;

        for await (const msg of client.fetch(range, { envelope: true, source: true, flags: true })) {
          try {
            if (!msg.source) continue;
            const parsed: any = await engines.simpleParser(msg.source);
            const rawId = parsed.messageId || `${cleanEmail}_${msg.uid || msg.seq}_${parsed.date?.getTime() || Date.now()}`;
            const mailId = 'mail_gm_' + crypto.createHash('md5').update(rawId).digest('hex').substring(0, 24);

            const senderEmail = parsed.from?.value?.[0]?.address || 'unknown@gmail.com';
            const senderName = parsed.from?.value?.[0]?.name || senderEmail;
            const subject = parsed.subject || '(No Subject)';
            const bodyText = parsed.text || (parsed.html ? parsed.html.replace(/<[^>]+>/g, ' ').substring(0, 2000) : '(Empty email body)');
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
      console.warn('ImapFlow sync warning, trying native TLS client:', err.message);
    }
  }

  // 2. Native TLS IMAP fallback (Pure Node.js, 100% resilient on Render)
  const nativeClient = new NativeGmailImapClient();
  try {
    const conn = await nativeClient.connect(cleanEmail, cleanPass);
    if (!conn.success) {
      await nativeClient.close();
      const now = Date.now();
      await pool.query(
        `UPDATE gmail_config SET last_synced_at = $1, last_sync_status = 'error', last_sync_error = $2 WHERE id = 'main'`,
        [now, conn.message]
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
          const mailId = 'mail_gm_' + crypto.createHash('md5').update(item.messageId).digest('hex').substring(0, 24);
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
        } catch (itemErr: any) {
          console.warn('Error inserting email item:', itemErr.message);
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
      message: `Sync successful! Fetched ${newCount} new email(s) from ${cleanEmail}. (Total in Inbox: ${inbox.total})`,
    };
  } catch (err: any) {
    await nativeClient.close();
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
