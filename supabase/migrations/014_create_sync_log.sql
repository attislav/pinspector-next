-- Sync log table to track auto-scrape executions
CREATE TABLE public.sync_log (
  id SERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',        -- running | completed | failed
  idea_id TEXT,
  idea_name TEXT,
  idea_searches INTEGER,
  language TEXT,
  score DOUBLE PRECISION,
  annotations_total INTEGER DEFAULT 0,
  annotations_scraped INTEGER DEFAULT 0,
  new_created INTEGER DEFAULT 0,
  existing_updated INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  error TEXT
);

CREATE INDEX idx_sync_log_started_at ON public.sync_log(started_at DESC);
