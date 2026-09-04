-- Phase 3: Pinterest OAuth Token Storage & Board Routing Configuration
-- Created: 2026-09-03
-- Purpose: Store encrypted Pinterest tokens and property-to-board mappings

-- ============================================================================
-- TABLE: pinterest_oauth_tokens
-- Purpose: Store encrypted OAuth tokens for Pinterest API access
-- ============================================================================

CREATE TABLE pinterest_oauth_tokens (
  id SERIAL PRIMARY KEY,

  -- Encrypted tokens (never stored plaintext)
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,

  -- Token expiration metadata
  access_token_expires_at TIMESTAMPTZ NOT NULL,
  refresh_token_expires_at TIMESTAMPTZ NOT NULL,

  -- Refresh tracking
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  last_refreshed_at TIMESTAMPTZ,
  refresh_count INTEGER DEFAULT 0,

  -- Singleton constraint: only one token state allowed
  CONSTRAINT singleton CHECK (id = 1)
);

-- Enable Row-Level Security
ALTER TABLE pinterest_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Deny all access by default (service role can bypass)
CREATE POLICY "deny_all_rls" ON pinterest_oauth_tokens FOR ALL USING (FALSE);

-- ============================================================================
-- TABLE: board_routing_config
-- Purpose: Map properties to Pinterest boards for pin routing
-- ============================================================================

CREATE TABLE board_routing_config (
  id SERIAL PRIMARY KEY,

  -- Property identification (unique per property)
  property_id TEXT UNIQUE NOT NULL,
  property_name TEXT NOT NULL,
  property_type TEXT,

  -- Pinterest board mapping
  pinterest_board_id TEXT NOT NULL,
  pinterest_board_name TEXT,

  -- Click-through destination for created pins
  destination_url TEXT,

  -- Property aliases for caption matching
  aliases TEXT[],

  -- Enable/disable routing without deletion
  active BOOLEAN DEFAULT TRUE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row-Level Security
ALTER TABLE board_routing_config ENABLE ROW LEVEL SECURITY;

-- Deny all access by default (service role can bypass)
CREATE POLICY "deny_all_rls" ON board_routing_config FOR ALL USING (FALSE);

-- Index for property lookups during execution
CREATE INDEX idx_board_routing_property_id ON board_routing_config(property_id);
CREATE INDEX idx_board_routing_active ON board_routing_config(active);
