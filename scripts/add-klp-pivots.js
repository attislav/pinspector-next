// Script zum Hinzufügen der klp_pivots Spalte zur Hetzner-Datenbank
// Ausführen mit: node scripts/add-klp-pivots.js

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function addColumn() {
  const client = await pool.connect();

  try {
    console.log('Verbinde mit Datenbank...');

    // Add klp_pivots column
    console.log('Füge klp_pivots Spalte hinzu...');
    await client.query(`
      ALTER TABLE public.ideas
      ADD COLUMN IF NOT EXISTS klp_pivots TEXT DEFAULT '[]';
    `);
    console.log('✓ klp_pivots Spalte hinzugefügt');

    // Verify the column was added
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'ideas' AND column_name = 'klp_pivots';
    `);

    if (result.rows.length > 0) {
      console.log('\n✅ Spalte erfolgreich erstellt:', result.rows[0]);
    } else {
      console.log('\n❌ Spalte konnte nicht verifiziert werden');
    }

  } catch (error) {
    console.error('❌ Fehler:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

addColumn();
