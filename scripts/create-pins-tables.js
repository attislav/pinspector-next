// Script zum Erstellen der Pins-Tabellen in der Hetzner-Datenbank
// Ausführen mit: node scripts/create-pins-tables.js

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createTables() {
  const client = await pool.connect();

  try {
    console.log('Verbinde mit Datenbank...');

    // Pins table
    console.log('Erstelle pins Tabelle...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.pins (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        image_url TEXT,
        image_thumbnail_url TEXT,
        link TEXT,
        article_url TEXT,
        repin_count INTEGER DEFAULT 0,
        save_count INTEGER DEFAULT 0,
        comment_count INTEGER DEFAULT 0,
        annotations TEXT[] DEFAULT '{}',
        pin_created_at TIMESTAMP WITH TIME ZONE,
        last_scrape TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✓ pins Tabelle erstellt');

    // Idea-Pins relationship table
    console.log('Erstelle idea_pins Tabelle...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.idea_pins (
        idea_id TEXT REFERENCES public.ideas(id) ON DELETE CASCADE,
        pin_id TEXT REFERENCES public.pins(id) ON DELETE CASCADE,
        position INTEGER DEFAULT 0,
        added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (idea_id, pin_id)
      );
    `);
    console.log('✓ idea_pins Tabelle erstellt');

    // Indexes
    console.log('Erstelle Indexes...');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pins_last_scrape ON public.pins(last_scrape);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pins_save_count ON public.pins(save_count DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_idea_pins_idea ON public.idea_pins(idea_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_idea_pins_pin ON public.idea_pins(pin_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_idea_pins_position ON public.idea_pins(idea_id, position);`);
    console.log('✓ Indexes erstellt');

    console.log('\n✅ Alle Tabellen erfolgreich erstellt!');

  } catch (error) {
    console.error('❌ Fehler:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

createTables();
