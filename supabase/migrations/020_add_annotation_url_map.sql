-- Add annotation_url_map JSONB column to ideas table
-- Stores a complete mapping of lowercased annotation name → absolute Pinterest URL
-- This ensures all pin annotations can be resolved to their Pinterest Ideas URL
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS annotation_url_map JSONB;
