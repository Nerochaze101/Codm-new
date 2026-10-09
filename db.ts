import pg from 'pg';
import dotenv from 'dotenv';
import dns from 'dns';
import net from 'net';
import { URL } from 'url';

// Prefer IPv4 DNS lookup to prevent ENETUNREACH errors on cloud hosting (e.g. Render)
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {
  // fallback for older node
}

dotenv.config();

const { Pool } = pg;

// Supabase IPv4 Pooler PostgreSQL Connection String
export const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres.zwlovcpkmydzcuoexjbg:Hello10122%40ususbhaj@aws-0-eu-west-2.pooler.supabase.com:5432/postgres';

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Supabase cloud PostgreSQL
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export interface DatabaseDiagnosticResult {
  status: 'CONNECTED' | 'PARTIAL' | 'FAILED';
  timestamp: string;
  environment: {
    hasEnvDatabaseUrl: boolean;
    maskedConnectionString: string;
  };
  network: {
    host: string;
    port: number;
    dnsIPv4: string | null;
    dnsIPv4Error: string | null;
    dnsIPv6: string | null;
    dnsIPv6Error: string | null;
    tcpSocketReachable: boolean;
    tcpSocketError: string | null;
  };
  database: {
    pgConnected: boolean;
    pgError: string | null;
    serverTime: string | null;
    currentUser: string | null;
    usersCount: number | null;
  };
  recommendations: string[];
}

export async function runDatabaseDiagnostics(): Promise<DatabaseDiagnosticResult> {
  const result: DatabaseDiagnosticResult = {
    status: 'FAILED',
    timestamp: new Date().toISOString(),
    environment: {
      hasEnvDatabaseUrl: !!process.env.DATABASE_URL,
      maskedConnectionString: DATABASE_URL.replace(/(:)([^@]+)(@)/, '$1******$3'),
    },
    network: {
      host: 'aws-0-eu-west-2.pooler.supabase.com',
      port: 5432,
      dnsIPv4: null,
      dnsIPv4Error: null,
      dnsIPv6: null,
      dnsIPv6Error: null,
      tcpSocketReachable: false,
      tcpSocketError: null,
    },
    database: {
      pgConnected: false,
      pgError: null,
      serverTime: null,
      currentUser: null,
      usersCount: null,
    },
    recommendations: [],
  };

  try {
    const parsedUrl = new URL(DATABASE_URL);
    result.network.host = parsedUrl.hostname;
    result.network.port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : 5432;
  } catch (e) {
    // fallback
  }

  const host = result.network.host;
  const port = result.network.port;

  // Step 1: Check DNS IPv4
  await new Promise<void>((resolve) => {
    dns.lookup(host, { family: 4 }, (err, address) => {
      if (err) {
        result.network.dnsIPv4Error = err.message;
      } else {
        result.network.dnsIPv4 = address;
      }
      resolve();
    });
  });

  // Step 2: Check DNS IPv6
  await new Promise<void>((resolve) => {
    dns.lookup(host, { family: 6 }, (err, address) => {
      if (err) {
        result.network.dnsIPv6Error = err.message;
      } else {
        result.network.dnsIPv6 = address;
      }
      resolve();
    });
  });

  // Step 3: Test TCP Socket Connection
  await new Promise<void>((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(4000);
    socket.on('connect', () => {
      result.network.tcpSocketReachable = true;
      socket.destroy();
      resolve();
    });
    socket.on('error', (err) => {
      result.network.tcpSocketError = err.message;
      socket.destroy();
      resolve();
    });
    socket.on('timeout', () => {
      result.network.tcpSocketError = 'Connection timed out after 4000ms';
      socket.destroy();
      resolve();
    });
    socket.connect(port, host);
  });

  // Step 4: Test PostgreSQL Query
  try {
    const client = await pool.connect();
    result.database.pgConnected = true;
    const timeRes = await client.query('SELECT NOW() as now, CURRENT_USER as user');
    result.database.serverTime = timeRes.rows[0]?.now;
    result.database.currentUser = timeRes.rows[0]?.user;

    const countRes = await client.query('SELECT COUNT(*) FROM users');
    result.database.usersCount = parseInt(countRes.rows[0]?.count || '0', 10);
    client.release();
    result.status = 'CONNECTED';
  } catch (err: any) {
    result.database.pgError = err.message || String(err);
    if (result.network.tcpSocketReachable) {
      result.status = 'PARTIAL';
    } else {
      result.status = 'FAILED';
    }
  }

  // Recommendations
  if (!result.database.pgConnected) {
    if (result.network.dnsIPv6 && !result.network.dnsIPv4 && host.includes('supabase.co')) {
      result.recommendations.push(
        "Direct Supabase host ('db.*.supabase.co') resolves ONLY to IPv6. Hosting providers like Render block outbound IPv6, leading to ENETUNREACH. Update DATABASE_URL in Render Environment settings to use the Supabase IPv4 Pooler host: 'aws-0-eu-west-2.pooler.supabase.com' or 'pooler.supabase.com'."
      );
    }
    if (!result.network.tcpSocketReachable) {
      result.recommendations.push(
        `TCP port ${port} on ${host} is unreachable. Check if your hosting provider restricts outbound ports, or try port 6543 (Supabase Transaction Pooler) or port 5432 (Session Pooler).`
      );
    }
    if (result.database.pgError?.includes('password authentication failed')) {
      result.recommendations.push('Database credentials in DATABASE_URL are incorrect. Verify username/password in Supabase Dashboard -> Database -> Connection string.');
    }
    if (result.database.pgError?.includes('SSL')) {
      result.recommendations.push('Ensure SSL is enabled in connection settings ({ ssl: { rejectUnauthorized: false } }).');
    }
  } else {
    result.recommendations.push('Supabase database connection is HEALTHY and active!');
  }

  return result;
}

export async function initDatabase() {
  console.log('🔌 Running Supabase PostgreSQL Database Diagnostics...');
  const diag = await runDatabaseDiagnostics();

  console.log('========== DATABASE DIAGNOSTICS ==========');
  console.log(`Status: ${diag.status}`);
  console.log(`Target Host: ${diag.network.host}:${diag.network.port}`);
  console.log(`IPv4 Resolved: ${diag.network.dnsIPv4 || 'None (' + diag.network.dnsIPv4Error + ')'}`);
  console.log(`IPv6 Resolved: ${diag.network.dnsIPv6 || 'None (' + diag.network.dnsIPv6Error + ')'}`);
  console.log(`TCP Reachable: ${diag.network.tcpSocketReachable ? 'YES' : 'NO (' + diag.network.tcpSocketError + ')'}`);
  console.log(`Database Connected: ${diag.database.pgConnected ? 'YES' : 'NO (' + diag.database.pgError + ')'}`);
  if (diag.database.pgConnected) {
    console.log(`DB Users Count: ${diag.database.usersCount}`);
  }
  console.log('Recommendations:');
  diag.recommendations.forEach((rec, idx) => console.log(`  ${idx + 1}. ${rec}`));
  console.log('==========================================');

  if (!diag.database.pgConnected) {
    console.error('⚠️ Supabase database connection failed during startup diagnostics.');
    return false;
  }

  try {
    const client = await pool.connect();
    // Initialize tables
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
        created_at BIGINT
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS account_number VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS account_name VARCHAR(255);

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
        settled_at BIGINT
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        type VARCHAR(100) NOT NULL,
        amount NUMERIC NOT NULL,
        description TEXT,
        match_id VARCHAR(255),
        timestamp BIGINT NOT NULL
      );
    `);

    // Seed default starter players if table is empty
    const usersCountRes = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(usersCountRes.rows[0].count, 10) === 0) {
      console.log('🌱 Seeding initial CODM gladiators into Supabase...');
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
    console.log('✅ Supabase database tables initialized and verified successfully.');
    return true;
  } catch (error) {
    console.error('⚠️ Supabase initialization table error:', error);
    return false;
  }
}
