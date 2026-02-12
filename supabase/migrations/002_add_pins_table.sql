-- Add separate pins table for better searchability and analysis
-- Migration: Add pins and idea_pins tables

-- Pins table - stores individual Pinterest pins
CREATE TABLE IF NOT EXISTS pins (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    image_url TEXT,
    link TEXT,
    repin_count INTEGER DEFAULT 0,
    save_count INTEGER DEFAULT 0,
    annotations TEXT[] DEFAULT '{}',
    last_scrape TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Many-to-Many relationship between ideas and pins
CREATE TABLE IF NOT EXISTS idea_pins (
    idea_id TEXT REFERENCES ideas(id) ON DELETE CASCADE,
    pin_id TEXT REFERENCES pins(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,  -- Order/rank in the idea results
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (idea_id, pin_id)
);

-- Indexes for searching pins
CREATE INDEX IF NOT EXISTS idx_pins_title ON pins USING GIN (to_tsvector('german', title));
CREATE INDEX IF NOT EXISTS idx_pins_description ON pins USING GIN (to_tsvector('german', description));
CREATE INDEX IF NOT EXISTS idx_pins_annotations ON pins USING GIN (annotations);
CREATE INDEX IF NOT EXISTS idx_pins_save_count ON pins(save_count DESC);
CREATE INDEX IF NOT EXISTS idx_pins_last_scrape ON pins(last_scrape);

-- Indexes for idea_pins relationships
CREATE INDEX IF NOT EXISTS idx_idea_pins_idea ON idea_pins(idea_id);
CREATE INDEX IF NOT EXISTS idx_idea_pins_pin ON idea_pins(pin_id);
CREATE INDEX IF NOT EXISTS idx_idea_pins_position ON idea_pins(idea_id, position);
