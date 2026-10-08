import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

// Supabase PostgreSQL Connection String
const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:Hello10122%40ususbhaj@db.zwlovcpkmydzcuoexjbg.supabase.co:5432/postgres';

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Supabase cloud PostgreSQL
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export async function initDatabase() {
  console.log('🔌 Connecting to Supabase PostgreSQL database...');
  try {
    const client = await pool.connect();
    console.log('✅ Successfully connected to Supabase PostgreSQL database!');

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
        created_at BIGINT
      );

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
      await client.query(`
        INSERT INTO users (id, username, codm_ign, codm_uid, tier, clan, email, phone, balance, escrow_balance, total_winnings, wins, losses, draws, avatar, created_at)
        VALUES 
        ('user_ghost', 'Ghost_NG', 'GHOST_NG', '6829471928371902', 'LEGENDARY TIER', '[1V1_PRO]', 'ghost@lagos-codm.com', '+234 803 123 4567', 0, 0, 24500, 14, 3, 1, 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150&auto=format&fit=crop&q=80', $1),
        ('user_shadow', 'ShadowSniper', 'ShadowSniper', '6948201948271034', 'MASTER V TIER', '[NIGHT_HAWK]', 'shadow@esports.ng', '+234 812 987 6543', 0, 0, 12000, 8, 5, 0, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80', $1)
        ON CONFLICT (id) DO NOTHING;
      `, [Date.now()]);
    }

    client.release();
    console.log('✅ Supabase database tables initialized and verified.');
    return true;
  } catch (error) {
    console.error('⚠️ Supabase connection warning (will use in-memory state fallback if disconnected):', error);
    return false;
  }
}
