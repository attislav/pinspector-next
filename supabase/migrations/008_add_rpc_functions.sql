-- RPC functions for Supabase migration
-- These replace complex SQL queries that can't be expressed with the Supabase query builder

-- 1. Monthly history (DISTINCT ON)
CREATE OR REPLACE FUNCTION get_monthly_history(p_idea_id TEXT)
RETURNS TABLE(id INTEGER, idea_id TEXT, name TEXT, searches INTEGER, scrape_date TIMESTAMPTZ)
LANGUAGE sql STABLE
AS $$
  SELECT DISTINCT ON (date_trunc('month', ih.scrape_date))
    ih.id, ih.idea_id, ih.name, ih.searches, ih.scrape_date
  FROM public.idea_history ih
  WHERE ih.idea_id = p_idea_id
  ORDER BY date_trunc('month', ih.scrape_date) ASC, ih.scrape_date DESC;
$$;

-- 2. Filtered ideas listing (word count, JSONB category, dynamic sort)
CREATE OR REPLACE FUNCTION get_filtered_ideas(
  p_search TEXT DEFAULT NULL,
  p_min_searches INTEGER DEFAULT NULL,
  p_max_searches INTEGER DEFAULT NULL,
  p_min_words INTEGER DEFAULT NULL,
  p_max_words INTEGER DEFAULT NULL,
  p_main_category TEXT DEFAULT NULL,
  p_sub_category TEXT DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'last_scrape',
  p_sort_order TEXT DEFAULT 'desc',
  p_limit INTEGER DEFAULT 30,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id TEXT, name TEXT, url TEXT, searches INTEGER,
  last_update TIMESTAMPTZ, last_scrape TIMESTAMPTZ,
  related_interests JSONB, top_annotations TEXT,
  seo_breadcrumbs JSONB, klp_pivots JSONB,
  language TEXT, created_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id, i.name, i.url, i.searches,
    i.last_update, i.last_scrape,
    i.related_interests, i.top_annotations,
    i.seo_breadcrumbs, i.klp_pivots,
    i.language, i.created_at,
    count(*) OVER() as total_count
  FROM public.ideas i
  WHERE
    (p_search IS NULL OR i.name ILIKE '%' || p_search || '%')
    AND (p_min_searches IS NULL OR i.searches >= p_min_searches)
    AND (p_max_searches IS NULL OR i.searches <= p_max_searches)
    AND (p_min_words IS NULL OR array_length(string_to_array(i.name, ' '), 1) >= p_min_words)
    AND (p_max_words IS NULL OR array_length(string_to_array(i.name, ' '), 1) <= p_max_words)
    AND (p_main_category IS NULL OR (
      i.seo_breadcrumbs IS NOT NULL AND (
        i.seo_breadcrumbs::jsonb->0->>'name' = p_main_category OR
        i.seo_breadcrumbs::jsonb->>0 = p_main_category
      )
    ))
    AND (p_sub_category IS NULL OR (
      i.seo_breadcrumbs IS NOT NULL AND (
        i.seo_breadcrumbs::jsonb->1->>'name' = p_sub_category OR
        i.seo_breadcrumbs::jsonb->>1 = p_sub_category
      )
    ))
  ORDER BY
    CASE WHEN p_sort_by = 'name' AND p_sort_order = 'asc' THEN i.name END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'name' AND p_sort_order = 'desc' THEN i.name END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'searches' AND p_sort_order = 'asc' THEN i.searches END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'searches' AND p_sort_order = 'desc' THEN i.searches END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'last_scrape' AND p_sort_order = 'asc' THEN i.last_scrape END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'last_scrape' AND p_sort_order = 'desc' THEN i.last_scrape END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'last_update' AND p_sort_order = 'asc' THEN i.last_update END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'last_update' AND p_sort_order = 'desc' THEN i.last_update END DESC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 3. Pins with aggregated idea info (LEFT JOIN + array_agg)
CREATE OR REPLACE FUNCTION get_pins_with_ideas(
  p_search TEXT DEFAULT NULL,
  p_idea_id TEXT DEFAULT NULL,
  p_min_saves INTEGER DEFAULT NULL,
  p_max_saves INTEGER DEFAULT NULL,
  p_has_article TEXT DEFAULT NULL,
  p_sort_column TEXT DEFAULT 'save_count',
  p_sort_dir TEXT DEFAULT 'desc',
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id TEXT, title TEXT, description TEXT, image_url TEXT,
  image_thumbnail_url TEXT, link TEXT, article_url TEXT,
  repin_count INTEGER, save_count INTEGER, comment_count INTEGER,
  annotations TEXT[], pin_created_at TIMESTAMPTZ, domain TEXT,
  board_name TEXT, last_scrape TIMESTAMPTZ, created_at TIMESTAMPTZ,
  idea_ids TEXT[], idea_names TEXT[], total_count BIGINT
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.title, p.description, p.image_url,
    p.image_thumbnail_url, p.link, p.article_url,
    p.repin_count, p.save_count, p.comment_count,
    p.annotations, p.pin_created_at, p.domain,
    p.board_name, p.last_scrape, p.created_at,
    array_agg(DISTINCT ip.idea_id) FILTER (WHERE ip.idea_id IS NOT NULL) as idea_ids,
    array_agg(DISTINCT i.name) FILTER (WHERE i.name IS NOT NULL) as idea_names,
    count(*) OVER() as total_count
  FROM public.pins p
  LEFT JOIN public.idea_pins ip ON p.id = ip.pin_id
  LEFT JOIN public.ideas i ON ip.idea_id = i.id
  WHERE
    (p_search IS NULL OR p.title ILIKE '%' || p_search || '%' OR p.description ILIKE '%' || p_search || '%')
    AND (p_idea_id IS NULL OR ip.idea_id = p_idea_id)
    AND (p_min_saves IS NULL OR p.save_count >= p_min_saves)
    AND (p_max_saves IS NULL OR p.save_count <= p_max_saves)
    AND (p_has_article IS NULL
         OR (p_has_article = 'true' AND p.article_url IS NOT NULL AND p.article_url != '')
         OR (p_has_article = 'false' AND (p.article_url IS NULL OR p.article_url = '')))
  GROUP BY p.id
  ORDER BY
    CASE WHEN p_sort_column = 'save_count' AND p_sort_dir = 'asc' THEN p.save_count END ASC NULLS LAST,
    CASE WHEN p_sort_column = 'save_count' AND p_sort_dir = 'desc' THEN p.save_count END DESC NULLS LAST,
    CASE WHEN p_sort_column = 'repin_count' AND p_sort_dir = 'asc' THEN p.repin_count END ASC NULLS LAST,
    CASE WHEN p_sort_column = 'repin_count' AND p_sort_dir = 'desc' THEN p.repin_count END DESC NULLS LAST,
    CASE WHEN p_sort_column = 'comment_count' AND p_sort_dir = 'asc' THEN p.comment_count END ASC NULLS LAST,
    CASE WHEN p_sort_column = 'comment_count' AND p_sort_dir = 'desc' THEN p.comment_count END DESC NULLS LAST,
    CASE WHEN p_sort_column = 'pin_created_at' AND p_sort_dir = 'asc' THEN p.pin_created_at END ASC NULLS LAST,
    CASE WHEN p_sort_column = 'pin_created_at' AND p_sort_dir = 'desc' THEN p.pin_created_at END DESC NULLS LAST,
    CASE WHEN p_sort_column = 'title' AND p_sort_dir = 'asc' THEN p.title END ASC NULLS LAST,
    CASE WHEN p_sort_column = 'title' AND p_sort_dir = 'desc' THEN p.title END DESC NULLS LAST,
    CASE WHEN p_sort_column = 'last_scrape' AND p_sort_dir = 'asc' THEN p.last_scrape END ASC NULLS LAST,
    CASE WHEN p_sort_column = 'last_scrape' AND p_sort_dir = 'desc' THEN p.last_scrape END DESC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 4. Atomic pin saving with transaction (DELETE + UPSERT + annotation linking)
CREATE OR REPLACE FUNCTION save_pins_for_idea(
  p_idea_id TEXT,
  p_pins JSONB,
  p_matching_interests JSONB DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  pin JSONB;
  i INTEGER := 0;
  annotation TEXT;
  matching_idea_id TEXT;
BEGIN
  -- Delete existing relationships for this idea
  DELETE FROM public.idea_pins WHERE idea_id = p_idea_id;

  -- Upsert each pin and create relationships
  FOR pin IN SELECT * FROM jsonb_array_elements(p_pins)
  LOOP
    INSERT INTO public.pins (
      id, title, description, image_url, image_thumbnail_url, link,
      article_url, repin_count, save_count, comment_count, annotations,
      pin_created_at, domain, board_name, last_scrape
    )
    VALUES (
      pin->>'id', pin->>'title', pin->>'description', pin->>'image_url',
      pin->>'image_thumbnail_url', pin->>'link', pin->>'article_url',
      COALESCE((pin->>'repin_count')::int, 0),
      COALESCE((pin->>'save_count')::int, 0),
      COALESCE((pin->>'comment_count')::int, 0),
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(pin->'annotations', '[]'::jsonb))),
      CASE WHEN pin->>'pin_created_at' IS NOT NULL AND pin->>'pin_created_at' != ''
        THEN (pin->>'pin_created_at')::timestamptz ELSE NULL END,
      pin->>'domain', pin->>'board_name', NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      image_url = EXCLUDED.image_url,
      image_thumbnail_url = EXCLUDED.image_thumbnail_url,
      link = EXCLUDED.link,
      article_url = EXCLUDED.article_url,
      repin_count = EXCLUDED.repin_count,
      save_count = EXCLUDED.save_count,
      comment_count = EXCLUDED.comment_count,
      annotations = EXCLUDED.annotations,
      pin_created_at = EXCLUDED.pin_created_at,
      domain = EXCLUDED.domain,
      board_name = EXCLUDED.board_name,
      last_scrape = NOW();

    -- Create idea_pins relationship with position
    INSERT INTO public.idea_pins (idea_id, pin_id, position)
    VALUES (p_idea_id, pin->>'id', i)
    ON CONFLICT (idea_id, pin_id) DO UPDATE SET position = EXCLUDED.position;

    -- Auto-link annotations to matching interests
    IF pin->'annotations' IS NOT NULL AND jsonb_array_length(pin->'annotations') > 0 THEN
      FOR annotation IN SELECT jsonb_array_elements_text(pin->'annotations')
      LOOP
        SELECT (mi->>'id')::text INTO matching_idea_id
        FROM jsonb_array_elements(p_matching_interests) mi
        WHERE LOWER(mi->>'name') = LOWER(annotation)
        LIMIT 1;

        IF matching_idea_id IS NOT NULL AND matching_idea_id != p_idea_id THEN
          INSERT INTO public.idea_pins (idea_id, pin_id, position)
          VALUES (matching_idea_id, pin->>'id', -1)
          ON CONFLICT (idea_id, pin_id) DO NOTHING;
        END IF;
      END LOOP;
    END IF;

    i := i + 1;
  END LOOP;
END;
$$;

-- Also ensure klp_pivots column exists (was added directly to Hetzner, not in migrations)
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS klp_pivots JSONB;
