-- Pins-Tabelle für Hetzner PostgreSQL
-- Führe dieses Script in deiner Hetzner-Datenbank aus

-- Pins table - stores individual Pinterest pins
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

-- Many-to-Many relationship between ideas and pins
CREATE TABLE IF NOT EXISTS public.idea_pins (
    idea_id TEXT REFERENCES public.ideas(id) ON DELETE CASCADE,
    pin_id TEXT REFERENCES public.pins(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (idea_id, pin_id)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pins_last_scrape ON public.pins(last_scrape);
CREATE INDEX IF NOT EXISTS idx_pins_save_count ON public.pins(save_count DESC);
CREATE INDEX IF NOT EXISTS idx_idea_pins_idea ON public.idea_pins(idea_id);
CREATE INDEX IF NOT EXISTS idx_idea_pins_pin ON public.idea_pins(pin_id);
CREATE INDEX IF NOT EXISTS idx_idea_pins_position ON public.idea_pins(idea_id, position);
