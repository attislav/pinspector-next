-- Add language column to ideas table
-- Stores the language code (e.g. 'de', 'en', 'fr') used when scraping
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS language TEXT DEFAULT NULL;

-- Backfill: detect language from existing URLs
UPDATE public.ideas SET language = 'de' WHERE url LIKE '%de.pinterest.com%' AND language IS NULL;
UPDATE public.ideas SET language = 'en' WHERE url LIKE '%www.pinterest.com%' AND language IS NULL;
UPDATE public.ideas SET language = 'fr' WHERE url LIKE '%fr.pinterest.com%' AND language IS NULL;
UPDATE public.ideas SET language = 'es' WHERE url LIKE '%es.pinterest.com%' AND language IS NULL;
UPDATE public.ideas SET language = 'it' WHERE url LIKE '%it.pinterest.com%' AND language IS NULL;
UPDATE public.ideas SET language = 'pt' WHERE url LIKE '%br.pinterest.com%' AND language IS NULL;
UPDATE public.ideas SET language = 'nl' WHERE url LIKE '%nl.pinterest.com%' AND language IS NULL;
