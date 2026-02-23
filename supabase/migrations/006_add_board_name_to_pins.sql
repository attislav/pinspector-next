-- Add board_name column to pins table
-- Stores the name of the Pinterest board where the pin was pinned

ALTER TABLE pins ADD COLUMN IF NOT EXISTS board_name TEXT;
