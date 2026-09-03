-- Phase 2.2 Database Hardening: Atomic Operations
-- Created: 2026-09-03
-- Purpose: Implement true PostgreSQL transactions for critical operations

-- Function: claim_for_publishing
-- Atomically claim a Facebook post for publishing
-- Precondition: Post must exist and be in 'discovered' state
-- Postcondition: Post transitioned to 'publishing' state (or returns error)
-- Returns: success BOOLEAN, message TEXT
CREATE OR REPLACE FUNCTION claim_for_publishing(
  p_facebook_post_id TEXT
)
RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
DECLARE
  v_rows_updated INT;
BEGIN
  UPDATE facebook_posts
  SET status = 'publishing', updated_at = NOW()
  WHERE facebook_post_id = p_facebook_post_id
  AND status = 'discovered';

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated > 0 THEN
    RETURN QUERY SELECT TRUE, 'Claimed for publishing';
  ELSE
    -- Check if post exists
    IF EXISTS (
      SELECT 1 FROM facebook_posts
      WHERE facebook_post_id = p_facebook_post_id
    ) THEN
      -- Post exists but is not in discovered state
      RETURN QUERY SELECT FALSE, 'Post not in discovered state';
    ELSE
      RETURN QUERY SELECT FALSE, 'Post not found';
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function: record_published_pin
-- Atomically record a published Pinterest pin and transition post to published state
-- Precondition: Post must be in 'publishing' state
-- Postcondition: Either both changes committed or entire transaction rolled back
-- Returns: success BOOLEAN, message TEXT, pin_id TEXT
CREATE OR REPLACE FUNCTION record_published_pin(
  p_facebook_post_id TEXT,
  p_pinterest_pin_id TEXT,
  p_pinterest_pin_url TEXT,
  p_board_id TEXT,
  p_board_name TEXT,
  p_destination_url TEXT
)
RETURNS TABLE(success BOOLEAN, message TEXT, pin_id TEXT) AS $$
DECLARE
  v_current_status post_status;
BEGIN
  -- Verify post is in publishing state (state protection)
  SELECT status INTO v_current_status
  FROM facebook_posts
  WHERE facebook_post_id = p_facebook_post_id
  FOR UPDATE; -- Lock the row to prevent concurrent modifications

  IF v_current_status IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Post not found', NULL::TEXT;
    RETURN;
  END IF;

  IF v_current_status != 'publishing' THEN
    RETURN QUERY SELECT FALSE,
      'Post not in publishing state (current: ' || v_current_status::TEXT || ')',
      NULL::TEXT;
    RETURN;
  END IF;

  -- Insert pin record (will fail with constraint violation if duplicate)
  INSERT INTO pinterest_pins (
    facebook_post_id,
    pinterest_pin_id,
    pinterest_pin_url,
    board_id,
    board_name,
    destination_url,
    status,
    created_at,
    updated_at
  ) VALUES (
    p_facebook_post_id,
    p_pinterest_pin_id,
    p_pinterest_pin_url,
    p_board_id,
    p_board_name,
    p_destination_url,
    'published',
    NOW(),
    NOW()
  );

  -- Transition facebook_posts to published
  UPDATE facebook_posts
  SET status = 'published', updated_at = NOW()
  WHERE facebook_post_id = p_facebook_post_id;

  RETURN QUERY SELECT TRUE, 'Pin recorded and post published', p_pinterest_pin_id;

EXCEPTION WHEN UNIQUE_VIOLATION THEN
  -- This handles duplicate facebook_post_id or pinterest_pin_id
  RETURN QUERY SELECT FALSE,
    'Duplicate pin record detected (facebook_post_id or pinterest_pin_id already exists)',
    NULL::TEXT;
  RETURN;
WHEN FOREIGN_KEY_VIOLATION THEN
  RETURN QUERY SELECT FALSE, 'Foreign key violation (post may have been deleted)',
    NULL::TEXT;
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Function: increment_retry_and_fail
-- Atomically increment retry count and mark post as failed
-- This is a single UPDATE operation to prevent race conditions
-- Returns: success BOOLEAN, new_retry_count INT, will_retry BOOLEAN
CREATE OR REPLACE FUNCTION increment_retry_and_fail(
  p_facebook_post_id TEXT,
  p_error_message TEXT
)
RETURNS TABLE(success BOOLEAN, new_retry_count INT, will_retry BOOLEAN) AS $$
DECLARE
  v_new_retry INT;
  v_rows_updated INT;
BEGIN
  UPDATE facebook_posts
  SET
    retry_count = retry_count + 1,
    last_error = p_error_message,
    status = 'failed',
    updated_at = NOW()
  WHERE facebook_post_id = p_facebook_post_id
  AND status = 'publishing';

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated = 0 THEN
    RETURN QUERY SELECT FALSE, NULL::INT, FALSE;
    RETURN;
  END IF;

  -- Get the updated retry count
  SELECT retry_count INTO v_new_retry
  FROM facebook_posts
  WHERE facebook_post_id = p_facebook_post_id;

  RETURN QUERY SELECT TRUE, v_new_retry, v_new_retry < 3;
END;
$$ LANGUAGE plpgsql;

-- Function: claim_for_retry
-- Atomically claim a failed post for retry
-- Precondition: Post must be in 'failed' state with retry_count < 3
-- Postcondition: Post transitioned to 'publishing' state or returns error
-- Returns: success BOOLEAN, message TEXT
CREATE OR REPLACE FUNCTION claim_for_retry(
  p_facebook_post_id TEXT
)
RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
DECLARE
  v_rows_updated INT;
BEGIN
  UPDATE facebook_posts
  SET status = 'publishing', updated_at = NOW()
  WHERE facebook_post_id = p_facebook_post_id
  AND status = 'failed'
  AND retry_count < 3;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated > 0 THEN
    RETURN QUERY SELECT TRUE, 'Claimed for retry';
  ELSE
    RETURN QUERY SELECT FALSE, 'Not retryable (not in failed state, limit reached, or not found)';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function: mark_post_uncertain
-- Mark a post as uncertain (published but confirmation failed)
-- Precondition: Post must be in 'publishing' state
-- Returns: success BOOLEAN, message TEXT
CREATE OR REPLACE FUNCTION mark_post_uncertain(
  p_facebook_post_id TEXT,
  p_error_message TEXT
)
RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
DECLARE
  v_rows_updated INT;
BEGIN
  UPDATE facebook_posts
  SET
    status = 'uncertain',
    last_error = p_error_message,
    updated_at = NOW()
  WHERE facebook_post_id = p_facebook_post_id
  AND status = 'publishing';

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated > 0 THEN
    RETURN QUERY SELECT TRUE, 'Marked as uncertain';
  ELSE
    RETURN QUERY SELECT FALSE, 'Post not in publishing state or not found';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function: mark_post_skipped
-- Mark a post as skipped
-- Precondition: Post must be in 'discovered' state
-- Returns: success BOOLEAN, message TEXT
CREATE OR REPLACE FUNCTION mark_post_skipped(
  p_facebook_post_id TEXT,
  p_skip_reason TEXT
)
RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
DECLARE
  v_rows_updated INT;
BEGIN
  UPDATE facebook_posts
  SET
    status = 'skipped',
    skip_reason = p_skip_reason,
    updated_at = NOW()
  WHERE facebook_post_id = p_facebook_post_id
  AND status = 'discovered';

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated > 0 THEN
    RETURN QUERY SELECT TRUE, 'Marked as skipped';
  ELSE
    RETURN QUERY SELECT FALSE, 'Post not in discovered state or not found';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Add COMMENT for clarity
COMMENT ON FUNCTION claim_for_publishing IS 'Atomically claim a discovered post for publishing (discovered -> publishing)';
COMMENT ON FUNCTION record_published_pin IS 'Atomically record a pin and transition post to published (single transaction)';
COMMENT ON FUNCTION increment_retry_and_fail IS 'Atomically increment retry count and mark failed (no race condition)';
COMMENT ON FUNCTION claim_for_retry IS 'Atomically claim a failed post for retry if under limit (failed -> publishing)';
COMMENT ON FUNCTION mark_post_uncertain IS 'Atomically mark publishing post as uncertain (publishing -> uncertain)';
COMMENT ON FUNCTION mark_post_skipped IS 'Atomically skip a discovered post (discovered -> skipped)';

-- Restrict operational RPC functions to service_role only
-- These functions manage critical state transitions and must not be callable by public or anon users

-- claim_for_publishing: Restrict to service_role
REVOKE EXECUTE ON FUNCTION claim_for_publishing(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION claim_for_publishing(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION claim_for_publishing(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION claim_for_publishing(TEXT) TO service_role;

-- record_published_pin: Restrict to service_role
REVOKE EXECUTE ON FUNCTION record_published_pin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION record_published_pin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION record_published_pin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION record_published_pin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- increment_retry_and_fail: Restrict to service_role
REVOKE EXECUTE ON FUNCTION increment_retry_and_fail(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION increment_retry_and_fail(TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION increment_retry_and_fail(TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION increment_retry_and_fail(TEXT, TEXT) TO service_role;

-- claim_for_retry: Restrict to service_role
REVOKE EXECUTE ON FUNCTION claim_for_retry(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION claim_for_retry(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION claim_for_retry(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION claim_for_retry(TEXT) TO service_role;

-- mark_post_uncertain: Restrict to service_role
REVOKE EXECUTE ON FUNCTION mark_post_uncertain(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION mark_post_uncertain(TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION mark_post_uncertain(TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION mark_post_uncertain(TEXT, TEXT) TO service_role;

-- mark_post_skipped: Restrict to service_role
REVOKE EXECUTE ON FUNCTION mark_post_skipped(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION mark_post_skipped(TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION mark_post_skipped(TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION mark_post_skipped(TEXT, TEXT) TO service_role;
