-- Phase 2 Database Schema
-- Approved in ARCHITECTURE_PHASE1.md
-- Created: 2026-09-03

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUM type for post status
CREATE TYPE post_status AS ENUM (
  'discovered',
  'publishing',
  'published',
  'failed',
  'uncertain',
  'skipped'
);

-- Table: facebook_posts
-- Tracks Facebook posts and their publishing lifecycle
CREATE TABLE IF NOT EXISTS facebook_posts (
  id BIGSERIAL PRIMARY KEY,
  facebook_post_id VARCHAR(255) NOT NULL UNIQUE,
  facebook_permalink VARCHAR(512),
  caption TEXT,
  image_url TEXT,
  date_published TIMESTAMPTZ NOT NULL,
  date_discovered TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status post_status NOT NULL DEFAULT 'discovered',
  skip_reason VARCHAR(255),
  last_error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for facebook_posts
-- Note: facebook_post_id has UNIQUE constraint which automatically creates an index
-- Keep these indexes for query optimization
CREATE INDEX IF NOT EXISTS idx_facebook_posts_status
  ON facebook_posts(status);
CREATE INDEX IF NOT EXISTS idx_facebook_posts_status_date_published
  ON facebook_posts(status, date_published DESC);
CREATE INDEX IF NOT EXISTS idx_facebook_posts_started_at
  ON facebook_posts(date_published DESC);

-- Table: pinterest_pins
-- Maps Facebook posts to Pinterest pins
CREATE TABLE IF NOT EXISTS pinterest_pins (
  id BIGSERIAL PRIMARY KEY,
  facebook_post_id VARCHAR(255) NOT NULL UNIQUE REFERENCES facebook_posts(facebook_post_id) ON DELETE CASCADE,
  pinterest_pin_id VARCHAR(255) NOT NULL UNIQUE,
  pinterest_pin_url VARCHAR(512),
  board_id VARCHAR(255),
  board_name VARCHAR(255),
  destination_url VARCHAR(512),
  title TEXT,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for pinterest_pins
-- Note: facebook_post_id and pinterest_pin_id have UNIQUE constraints which automatically create indexes
-- Keep status index for filtering
CREATE INDEX IF NOT EXISTS idx_pinterest_pins_status
  ON pinterest_pins(status);

-- Table: execution_logs
-- Tracks cron execution history and results
CREATE TABLE IF NOT EXISTS execution_logs (
  id BIGSERIAL PRIMARY KEY,
  execution_id VARCHAR(255) NOT NULL UNIQUE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  posts_fetched INTEGER DEFAULT 0,
  posts_discovered INTEGER DEFAULT 0,
  posts_published INTEGER DEFAULT 0,
  posts_failed INTEGER DEFAULT 0,
  posts_skipped INTEGER DEFAULT 0,
  posts_uncertain INTEGER DEFAULT 0,
  duration_ms INTEGER,
  status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
  errors JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for execution_logs
-- Note: execution_id has UNIQUE constraint which automatically creates an index
-- Removed redundant explicit index in Phase 2.4
CREATE INDEX IF NOT EXISTS idx_execution_logs_started_at
  ON execution_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_logs_status
  ON execution_logs(status);

-- Enable Row-Level Security
ALTER TABLE facebook_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pinterest_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_logs ENABLE ROW LEVEL SECURITY;

-- Default-deny RLS policies (service_role bypasses these)
CREATE POLICY "Deny all access" ON facebook_posts AS RESTRICTIVE FOR ALL TO PUBLIC USING (FALSE);
CREATE POLICY "Deny all access" ON pinterest_pins AS RESTRICTIVE FOR ALL TO PUBLIC USING (FALSE);
CREATE POLICY "Deny all access" ON execution_logs AS RESTRICTIVE FOR ALL TO PUBLIC USING (FALSE);

-- Add comments for documentation
COMMENT ON TABLE facebook_posts IS 'Tracks Facebook posts and their publishing pipeline state';
COMMENT ON TABLE pinterest_pins IS 'Maps published Facebook posts to their corresponding Pinterest pins';
COMMENT ON TABLE execution_logs IS 'Logs execution history of the automated publishing cron job';
COMMENT ON COLUMN facebook_posts.status IS 'Lifecycle state: discovered, publishing, published, failed, uncertain, skipped';
COMMENT ON COLUMN facebook_posts.retry_count IS 'Number of times this post has been retried (max 3)';
COMMENT ON COLUMN pinterest_pins.facebook_post_id IS 'Foreign key to facebook_posts; UNIQUE to ensure one pin per post';
