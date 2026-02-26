-- Drop existing function (return type changes - adding klp_count, related_count)
DROP FUNCTION IF EXISTS get_filtered_ideas(text,integer,integer,integer,integer,text,text,text,text,integer,integer,text);

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
  p_offset INTEGER DEFAULT 0,
  p_language TEXT DEFAULT NULL
)
RETURNS TABLE(
  id TEXT, name TEXT, url TEXT, searches INTEGER,
  last_update TIMESTAMPTZ, last_scrape TIMESTAMPTZ,
  related_interests JSONB, top_annotations TEXT,
  seo_breadcrumbs JSONB, klp_pivots JSONB,
  language TEXT, created_at TIMESTAMPTZ,
  total_count BIGINT,
  history_count BIGINT,
  prev_searches INTEGER,
  klp_count INTEGER,
  related_count INTEGER
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
    count(*) OVER() as total_count,
    (SELECT count(*) FROM public.idea_history ih WHERE ih.idea_id = i.id) as history_count,
    (SELECT ih2.searches FROM public.idea_history ih2
     WHERE ih2.idea_id = i.id
     ORDER BY ih2.scrape_date DESC
     OFFSET 1 LIMIT 1
    ) as prev_searches,
    CASE WHEN i.klp_pivots IS NOT NULL AND jsonb_typeof(i.klp_pivots) = 'array' THEN jsonb_array_length(i.klp_pivots) ELSE 0 END::INTEGER as klp_count,
    CASE WHEN i.related_interests IS NOT NULL AND jsonb_typeof(i.related_interests) = 'array' THEN jsonb_array_length(i.related_interests) ELSE 0 END::INTEGER as related_count
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
    AND (p_language IS NULL OR i.language = p_language)
  ORDER BY
    CASE WHEN p_sort_by = 'name' AND p_sort_order = 'asc' THEN i.name END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'name' AND p_sort_order = 'desc' THEN i.name END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'searches' AND p_sort_order = 'asc' THEN i.searches END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'searches' AND p_sort_order = 'desc' THEN i.searches END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'search_diff' AND p_sort_order = 'desc' THEN
      i.searches - COALESCE((SELECT ih3.searches FROM public.idea_history ih3 WHERE ih3.idea_id = i.id ORDER BY ih3.scrape_date DESC OFFSET 1 LIMIT 1), i.searches)
    END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'search_diff' AND p_sort_order = 'asc' THEN
      i.searches - COALESCE((SELECT ih3.searches FROM public.idea_history ih3 WHERE ih3.idea_id = i.id ORDER BY ih3.scrape_date DESC OFFSET 1 LIMIT 1), i.searches)
    END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'last_scrape' AND p_sort_order = 'asc' THEN i.last_scrape END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'last_scrape' AND p_sort_order = 'desc' THEN i.last_scrape END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'last_update' AND p_sort_order = 'asc' THEN i.last_update END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'last_update' AND p_sort_order = 'desc' THEN i.last_update END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'history_count' AND p_sort_order = 'asc' THEN
      (SELECT count(*) FROM public.idea_history ih4 WHERE ih4.idea_id = i.id)
    END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'history_count' AND p_sort_order = 'desc' THEN
      (SELECT count(*) FROM public.idea_history ih4 WHERE ih4.idea_id = i.id)
    END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'klp_count' AND p_sort_order = 'asc' THEN
      CASE WHEN i.klp_pivots IS NOT NULL AND jsonb_typeof(i.klp_pivots) = 'array' THEN jsonb_array_length(i.klp_pivots) ELSE 0 END
    END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'klp_count' AND p_sort_order = 'desc' THEN
      CASE WHEN i.klp_pivots IS NOT NULL AND jsonb_typeof(i.klp_pivots) = 'array' THEN jsonb_array_length(i.klp_pivots) ELSE 0 END
    END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'related_count' AND p_sort_order = 'asc' THEN
      CASE WHEN i.related_interests IS NOT NULL AND jsonb_typeof(i.related_interests) = 'array' THEN jsonb_array_length(i.related_interests) ELSE 0 END
    END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'related_count' AND p_sort_order = 'desc' THEN
      CASE WHEN i.related_interests IS NOT NULL AND jsonb_typeof(i.related_interests) = 'array' THEN jsonb_array_length(i.related_interests) ELSE 0 END
    END DESC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
END;
$$;
