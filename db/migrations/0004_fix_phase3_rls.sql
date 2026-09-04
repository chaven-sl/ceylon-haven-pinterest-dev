-- Phase 3 Part 1: RLS & Access Control Validation & Correction
-- Created: 2026-09-04
-- Purpose: Verify and document RLS and table access control for backend tables
--
-- IMPORTANT: This migration corrects the previous diagnosis. PostgreSQL RLS works as follows:
-- - SELECT returning HTTP 200 with empty array = rows filtered by RLS (secure, expected)
-- - UPDATE returning 0 affected rows = operation blocked by RLS (secure, expected)
-- - DELETE returning 0 rows = operation blocked by RLS (secure, expected)
-- - INSERT with RLS FALSE = error returned (secure, expected)
-- - service_role BYPASSES RLS by design (intentional, correct for backend)
--
-- CURRENT STATE (After 0003):
-- - pinterest_oauth_tokens has RLS ENABLED with "deny_all_rls" policy (using FALSE)
-- - board_routing_config has RLS ENABLED with "deny_all_rls" policy (using FALSE)
-- - Both tables already deny anonymous access via RLS
--
-- CORRECTION: No migration needed for RLS policies (they already work correctly).
-- However, we should document and optionally add table-level GRANT/REVOKE for clarity.

-- ============================================================================
-- OPTION A: Table-Level Access Control (Recommended - Cleaner, More Explicit)
-- ============================================================================
--
-- These REVOKE/GRANT statements are REDUNDANT with the RLS policies but
-- provide explicit defense-in-depth and make intent clear.
--
-- Effect: Even if RLS is misconfigured, anonymous users cannot access the tables.
--
-- Note: This is optional since the RLS "deny_all_rls" policy already achieves security.
-- We apply it anyway for clarity and defense-in-depth.

-- pinterest_oauth_tokens: Revoke default table access, grant only to service_role
REVOKE ALL ON TABLE public.pinterest_oauth_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pinterest_oauth_tokens TO service_role;

-- board_routing_config: Revoke default table access, grant only to service_role
REVOKE ALL ON TABLE public.board_routing_config FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.board_routing_config TO service_role;

-- ============================================================================
-- DOCUMENTATION COMMENTS
-- ============================================================================
COMMENT ON TABLE public.pinterest_oauth_tokens IS 'Stores encrypted OAuth tokens for Pinterest API access. Restricted to service_role via RLS policy and table grants. Anonymous and authenticated users cannot access.';
COMMENT ON TABLE public.board_routing_config IS 'Maps properties to Pinterest boards for pin routing. Restricted to service_role via RLS policy and table grants. Anonymous and authenticated users cannot access.';

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
--
-- RLS VALIDATION RESULTS:
-- ✅ Anonymous SELECT: Returns HTTP 200 [] (rows filtered by RLS) - SECURE
-- ✅ Anonymous UPDATE: Returns HTTP 200 with 0 rows affected (blocked by RLS) - SECURE
-- ✅ Anonymous DELETE: Returns HTTP 200 with 0 rows deleted (blocked by RLS) - SECURE
-- ✅ Anonymous INSERT: Returns HTTP 403/error (blocked by RLS) - SECURE
-- ✅ Service role: Can INSERT/UPDATE/SELECT/DELETE (bypasses RLS intentionally) - CORRECT
--
-- WHY NO NEW RLS POLICIES:
-- The existing "deny_all_rls" policies with USING (FALSE) already provide complete security:
-- - They deny access to anon and authenticated roles
-- - They return appropriate HTTP responses (200 for read/update/delete, 401+ for insert)
-- - They allow service_role to bypass (as designed)
--
-- ADDITIONAL GRANT/REVOKE JUSTIFICATION:
-- - Provides explicit, documented access control
-- - Redundant but adds defense-in-depth
-- - Makes intent clear to future maintainers
-- - Does not hurt - service_role bypasses all anyway
--
