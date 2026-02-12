// Script zum Umbenennen der pinner_username Spalte zu domain
// Ausführen mit: node scripts/add-pinner-username.js

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function updateColumn() {
  const client = await pool.connect();

  try {
    console.log('Verbinde mit Datenbank...');

    // Check if pinner_username exists and domain doesn't
    const checkResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'pins' AND column_name IN ('pinner_username', 'domain');
    `);

    const existingColumns = checkResult.rows.map(r => r.column_name);
    console.log('Vorhandene Spalten:', existingColumns);

    if (existingColumns.includes('pinner_username') && !existingColumns.includes('domain')) {
      // Rename pinner_username to domain
      console.log('Benenne pinner_username zu domain um...');
      await client.query(`
        ALTER TABLE public.pins
        RENAME COLUMN pinner_username TO domain;
      `);
      console.log('✓ Spalte umbenannt');
    } else if (!existingColumns.includes('domain')) {
      // Add domain column
      console.log('Füge domain Spalte hinzu...');
      await client.query(`
        ALTER TABLE public.pins
        ADD COLUMN IF NOT EXISTS domain TEXT;
      `);
      console.log('✓ domain Spalte hinzugefügt');
    } else {
      console.log('✓ domain Spalte existiert bereits');
    }

    // Drop pinner_username if it still exists alongside domain
    if (existingColumns.includes('pinner_username') && existingColumns.includes('domain')) {
      console.log('Lösche alte pinner_username Spalte...');
      await client.query(`
        ALTER TABLE public.pins
        DROP COLUMN IF EXISTS pinner_username;
      `);
      console.log('✓ pinner_username Spalte gelöscht');
    }

    // Verify the column exists
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'pins' AND column_name = 'domain';
    `);

    if (result.rows.length > 0) {
      console.log('\n✅ Spalte erfolgreich konfiguriert:', result.rows[0]);
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

updateColumn();
