import { Pool } from 'pg';

// PostgreSQL connection pool
let pool: Pool | null = null;
let migrated = false;

export function getPool(): Pool {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL nicht konfiguriert');
    }

    pool = new Pool({
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

// Auto-migrate: add missing columns on first query
async function ensureMigrations(): Promise<void> {
  if (migrated) return;
  migrated = true;
  try {
    const p = getPool();
    await p.query(`ALTER TABLE pins ADD COLUMN IF NOT EXISTS board_name TEXT`);
  } catch (err) {
    console.error('Auto-migration failed:', err);
  }
}

// Helper function to execute queries
export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  await ensureMigrations();
  const pool = getPool();
  const result = await pool.query(text, params);
  return result.rows as T[];
}

// Helper function to execute single result queries
export async function queryOne<T>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}
