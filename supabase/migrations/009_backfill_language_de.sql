-- Backfill: Mark all ideas without language as 'de' (German)
-- All existing data was scraped from German Pinterest.
-- On next re-scrape, the scraper will auto-correct the language
-- based on canonical_domain and url_name from Pinterest data.
UPDATE public.ideas SET language = 'de' WHERE language IS NULL OR language = '';
