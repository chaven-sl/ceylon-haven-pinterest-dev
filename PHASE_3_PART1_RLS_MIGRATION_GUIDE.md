# Phase 3 Part 1: RLS Security Fix - Migration Guide

## Summary

Migration 0004 fixes a critical RLS bypass vulnerability where anonymous users can SELECT from `pinterest_oauth_tokens` and `board_routing_config` tables despite RLS policies.

**Issue**: Current RLS policies use `USING (FALSE)` for writes, but allow reads to pass through with empty results.
**Fix**: Enable FORCE ROW LEVEL SECURITY and create explicit deny policies for SELECT, INSERT, UPDATE, DELETE.

## Current Status

- ✗ SECURITY ISSUE: Anonymous SELECT returns 200 with empty results (appears allowed)
- ✓ Correct: Anonymous INSERT returns 401 with RLS error (correctly denied)
- ✓ Correct: Service-role can SELECT (returns empty array, no errors)

## Apply Migration 0004

### Option 1: Manual Application via Supabase Dashboard (Recommended)

1. **Navigate to Supabase SQL Editor**
   - Go to: https://app.supabase.com/project/smechrmugemwvqugigwk/sql

2. **Create New Query**
   - Click "New Query"

3. **Paste Migration SQL**
   - Copy entire contents of: `db/migrations/0004_fix_phase3_rls.sql`
   - Paste into the query editor

4. **Execute**
   - Click "Run" button
   - Wait for confirmation message

5. **Verify**
   - Run: `npm run verify:rls:migration`

### Option 2: Via Supabase CLI (if linked)

```bash
# Link project to CLI (interactive)
supabase link --project-ref smechrmugemwvqugigwk

# Apply migration
supabase db push
```

### Option 3: Via Script (after manual application)

```bash
# Apply migration manually first (Option 1), then run verification
npm run verify:rls:migration
```

## Migration Contents

### 1. Pinterest OAuth Tokens Table

```sql
-- Disable existing policy that allows SELECT bypass
DROP POLICY IF EXISTS "deny_all_rls" ON pinterest_oauth_tokens;

-- Enable FORCE ROW LEVEL SECURITY
ALTER TABLE pinterest_oauth_tokens FORCE ROW LEVEL SECURITY;

-- Create explicit deny policies for all operations
CREATE POLICY "anon_deny_select" ON pinterest_oauth_tokens FOR SELECT TO anon USING (FALSE);
CREATE POLICY "anon_deny_insert" ON pinterest_oauth_tokens FOR INSERT TO anon WITH CHECK (FALSE);
CREATE POLICY "anon_deny_update" ON pinterest_oauth_tokens FOR UPDATE TO anon USING (FALSE);
CREATE POLICY "anon_deny_delete" ON pinterest_oauth_tokens FOR DELETE TO anon USING (FALSE);

-- Same for authenticated role
CREATE POLICY "authenticated_deny_select" ON pinterest_oauth_tokens FOR SELECT TO authenticated USING (FALSE);
CREATE POLICY "authenticated_deny_insert" ON pinterest_oauth_tokens FOR INSERT TO authenticated WITH CHECK (FALSE);
CREATE POLICY "authenticated_deny_update" ON pinterest_oauth_tokens FOR UPDATE TO authenticated USING (FALSE);
CREATE POLICY "authenticated_deny_delete" ON pinterest_oauth_tokens FOR DELETE TO authenticated USING (FALSE);

-- Revoke all and grant only to service_role
REVOKE ALL ON pinterest_oauth_tokens FROM PUBLIC;
REVOKE ALL ON pinterest_oauth_tokens FROM anon;
REVOKE ALL ON pinterest_oauth_tokens FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON pinterest_oauth_tokens TO service_role;
```

### 2. Board Routing Config Table

Same approach as pinterest_oauth_tokens:
- Drop existing "deny_all_rls" policy
- Enable FORCE ROW LEVEL SECURITY
- Create explicit deny policies for SELECT, INSERT, UPDATE, DELETE
- Revoke all and grant only to service_role

## Expected Results After Migration

### Anonymous Access (should all be DENIED)

```
✗ SELECT: 403 Forbidden or similar error
✗ INSERT: 403 Forbidden
✗ UPDATE: 403 Forbidden
✗ DELETE: 403 Forbidden
```

### Service-Role Access (should all be ALLOWED)

```
✓ SELECT: 200 with results/empty array
✓ INSERT: 201 with created record
✓ UPDATE: 200 with updated record
✓ DELETE: 204 No Content
```

## Verification

After applying migration:

```bash
# Test RLS enforcement
TEST_SUPABASE_URL=https://smechrmugemwvqugigwk.supabase.co \
TEST_SUPABASE_ANON_KEY="..." \
TEST_SUPABASE_SERVICE_ROLE_KEY="..." \
TEST_SUPABASE_PROJECT_REF=smechrmugemwvqugigwk \
npx tsx scripts/apply-migration-0004.ts
```

Expected output after migration:
```
Testing pinterest_oauth_tokens SELECT with anon key...
  ✓ DENIED (expected after fix)
Testing board_routing_config SELECT with anon key...
  ✓ DENIED (expected after fix)
```

## Files Modified

- `db/migrations/0004_fix_phase3_rls.sql` - New migration file
- `scripts/apply-migration-0004.ts` - Verification script
- `scripts/verify-rls-migration.ts` - Post-migration verification

## Rollback

If needed, revert policies to original state:

```sql
-- For both tables:
DROP POLICY IF EXISTS "anon_deny_select" ON table_name;
DROP POLICY IF EXISTS "anon_deny_insert" ON table_name;
DROP POLICY IF EXISTS "anon_deny_update" ON table_name;
DROP POLICY IF EXISTS "anon_deny_delete" ON table_name;
DROP POLICY IF EXISTS "authenticated_deny_select" ON table_name;
DROP POLICY IF EXISTS "authenticated_deny_insert" ON table_name;
DROP POLICY IF EXISTS "authenticated_deny_update" ON table_name;
DROP POLICY IF EXISTS "authenticated_deny_delete" ON table_name;

-- Recreate original policy
CREATE POLICY "deny_all_rls" ON table_name FOR ALL USING (FALSE);

-- Restore default grants (Supabase default)
GRANT ALL ON table_name TO anon;
GRANT ALL ON table_name TO authenticated;
```

## Timeline

- Created: 2026-09-04
- Target Application: ASAP (critical security issue)
- Testing: Phase 3 DB integration suite
- Status: PENDING MANUAL APPLICATION
