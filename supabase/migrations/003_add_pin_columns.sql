-- Add additional columns to pins table for better analysis
-- Migration: Add thumbnail, article_url, comment_count, pin_created_at

ALTER TABLE pins ADD COLUMN IF NOT EXISTS image_thumbnail_url TEXT;
ALTER TABLE pins ADD COLUMN IF NOT EXISTS article_url TEXT;
ALTER TABLE pins ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;
ALTER TABLE pins ADD COLUMN IF NOT EXISTS pin_created_at TIMESTAMP WITH TIME ZONE;

-- Add index for pin creation date
CREATE INDEX IF NOT EXISTS idx_pins_created_at ON pins(pin_created_at DESC);
