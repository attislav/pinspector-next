-- RPC function to pick the best idea for auto-scraping
-- Score = normalized(age_days) + normalized(pivots+related count) + normalized(searches)
-- Only considers ideas where last_scrape AND last_update are older than p_min_age_days

CREATE OR REPLACE FUNCTION get_auto_scrape_candidate(
  p_language TEXT,
  p_min_age_days INTEGER DEFAULT 30
)
RETURNS TABLE(
  id TEXT,
  name TEXT,
  url TEXT,
  language TEXT,
  searches INTEGER,
  last_scrape TIMESTAMPTZ,
  pivot_count INTEGER,
  related_count INTEGER,
  score DOUBLE PRECISION
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT
      i.id, i.name, i.url, i.language, i.searches, i.last_scrape,
      CASE WHEN i.klp_pivots IS NOT NULL AND jsonb_typeof(i.klp_pivots) = 'array' THEN jsonb_array_length(i.klp_pivots) ELSE 0 END::INTEGER AS pivot_count,
      CASE WHEN i.related_interests IS NOT NULL AND jsonb_typeof(i.related_interests) = 'array' THEN jsonb_array_length(i.related_interests) ELSE 0 END::INTEGER AS related_count,
      EXTRACT(EPOCH FROM (NOW() - COALESCE(i.last_scrape, '2020-01-01'::TIMESTAMPTZ))) / 86400.0 AS age_days
    FROM public.ideas i
    WHERE i.language = p_language
      AND (i.last_scrape IS NULL OR i.last_scrape < NOW() - (p_min_age_days || ' days')::INTERVAL)
      AND (i.last_update IS NULL OR i.last_update < NOW() - (p_min_age_days || ' days')::INTERVAL)
      AND i.url IS NOT NULL
  ),
  stats AS (
    SELECT
      MAX(c.age_days) AS max_age,
      MAX(c.pivot_count + c.related_count) AS max_expansion,
      MAX(c.searches) AS max_searches
    FROM candidates c
  )
  SELECT
    c.id, c.name, c.url, c.language, c.searches, c.last_scrape,
    c.pivot_count, c.related_count,
    -- Normalized score (0-1 each, sum 0-3)
    CASE WHEN s.max_age > 0 THEN c.age_days / s.max_age ELSE 0 END
    + CASE WHEN s.max_expansion > 0 THEN (c.pivot_count + c.related_count)::DOUBLE PRECISION / s.max_expansion ELSE 0 END
    + CASE WHEN s.max_searches > 0 THEN c.searches::DOUBLE PRECISION / s.max_searches ELSE 0 END
    AS score
  FROM candidates c, stats s
  ORDER BY score DESC
  LIMIT 1;
END;
$$;
