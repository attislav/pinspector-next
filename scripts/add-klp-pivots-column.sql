-- Add klp_pivots column to ideas table
-- Run this in your Hetzner PostgreSQL database

ALTER TABLE public.ideas
ADD COLUMN IF NOT EXISTS klp_pivots TEXT DEFAULT '[]';

-- Verify the column was added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ideas' AND column_name = 'klp_pivots';
