-- Pinspector Database Schema for Supabase
-- Migration: Initial Schema (public schema)

-- Ideas table (main table for Pinterest interests)
CREATE TABLE IF NOT EXISTS ideas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT,
    searches INTEGER DEFAULT 0,
    last_update TIMESTAMP WITH TIME ZONE,
    last_scrape TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    related_interests JSONB DEFAULT '[]'::jsonb,
    top_annotations TEXT,
    seo_breadcrumbs JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Idea history table (for tracking search volume changes over time)
CREATE TABLE IF NOT EXISTS idea_history (
    id SERIAL PRIMARY KEY,
    idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    searches INTEGER DEFAULT 0,
    scrape_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ideas_name ON ideas(name);
CREATE INDEX IF NOT EXISTS idx_ideas_searches ON ideas(searches);
CREATE INDEX IF NOT EXISTS idx_ideas_last_scrape ON ideas(last_scrape);
CREATE INDEX IF NOT EXISTS idx_idea_history_idea_id ON idea_history(idea_id);
CREATE INDEX IF NOT EXISTS idx_idea_history_scrape_date ON idea_history(scrape_date);

-- Full text search index on idea names
CREATE INDEX IF NOT EXISTS idx_ideas_name_search ON ideas USING GIN (to_tsvector('german', name));
