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

// Auto-migrate: run pending migrations tracked in DB
async function ensureMigrations(): Promise<void> {
  if (migrated) return;
  migrated = true;
  try {
    const p = getPool();
    // Create migrations tracking table if it doesn't exist
    await p.query(`CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMP DEFAULT NOW())`);
    // Define all migrations
    const migrations: [string, string][] = [
      ['006_add_board_name', `ALTER TABLE pins ADD COLUMN IF NOT EXISTS board_name TEXT`],
    ];
    for (const [name, sql] of migrations) {
      const exists = await p.query(`SELECT 1 FROM _migrations WHERE name = $1`, [name]);
      if (exists.rows.length === 0) {
        await p.query(sql);
        await p.query(`INSERT INTO _migrations (name) VALUES ($1)`, [name]);
        console.log(`Migration applied: ${name}`);
      }
    }
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
