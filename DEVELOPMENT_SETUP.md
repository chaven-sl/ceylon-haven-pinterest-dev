# Development Setup Guide - Phase 2.4 Revised

This guide walks through setting up Ceylon Haven Pinterest automation for cloud development with Supabase and Vercel.

**Key Principle:** Separate development and production entirely. This phase uses a dedicated Supabase development project with no connection to production data.

## Prerequisites

- Node.js 18+ (verify: `node --version`)
- npm 9+ (verify: `npm --version`)
- Git (already configured with dillyrab94@gmail.com)
- Supabase account (free tier OK)
- Vercel account (free tier OK)
- GitHub repository (created, see initial commit)

## Part 1: Supabase Development Project

### Step 1.1: Create Development Project

1. Go to https://supabase.com/dashboard
2. Click "New project"
3. Fill in:
   - **Organization:** Your account
   - **Project name:** `ceylon-haven-pinterest-dev` (or similar, must include "dev")
   - **Database password:** Generate strong random password (save it securely)
   - **Region:** Choose closest to Asia (e.g., Singapore ap-southeast-1)
   - **Pricing plan:** Free tier is fine for development
4. Click "Create new project"
5. Wait for initialization (~2 minutes)

### Step 1.2: Obtain Credentials

After project creation, credentials are visible in: **Project Settings → API**

Copy and save these (keep them secure, never commit):
- **Project URL:** Format: `https://xxxxx.supabase.co`
- **Project Ref:** The `xxxxx` part (format: 8-character alphanumeric)
- **Anon Key:** Labeled "Anon/Public" (public, safe to share)
- **Service Role Key:** Labeled "Service Role Secret" (SECRET, never share)

### Step 1.3: Apply Database Migrations

Two SQL migrations create the database schema and RPC functions.

**Option A: Supabase CLI (if installed)**

```bash
cd /Users/dilshanrabbie/Desktop/Ceylon-Haven-Pinterest-Automation
supabase link --project-ref [your-project-ref]
supabase db push
```

**Option B: Supabase Studio (web UI) - Recommended**

1. Go to your project dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New query**
4. Copy contents of `db/migrations/0001_init_schema.sql`
5. Paste into SQL editor
6. Click **Execute**
7. Wait for completion (should create 3 tables)

Repeat for `db/migrations/0002_atomic_operations.sql`:
1. Click **New query**
2. Copy contents of `db/migrations/0002_atomic_operations.sql`
3. Paste into SQL editor
4. Click **Execute**
5. Wait for completion (should create 6 RPC functions)

**Verify migrations completed:**

In Supabase Studio:
- **Table Editor:** Should show `facebook_posts`, `pinterest_pins`, `execution_logs`
- **SQL Functions:** Should show `claim_for_publishing`, `record_published_pin`, `increment_retry_and_fail`, `claim_for_retry`, `mark_post_uncertain`, `mark_post_skipped`

### Step 1.4: Enable Row-Level Security (RLS)

Development project uses RLS to simulate production security.

In Supabase Studio:
1. Go to **Authentication → Policies**
2. For each table (`facebook_posts`, `pinterest_pins`, `execution_logs`):
   - Select the table
   - Click **Enable RLS**
   - This restricts direct access via Anon Key (but RPC functions work)

## Part 2: Configure Development Credentials

### Step 2.1: Create .env.test

Copy the template and fill in actual values:

```bash
cd /Users/dilshanrabbie/Desktop/Ceylon-Haven-Pinterest-Automation
cp .env.test.example .env.test
```

Edit `.env.test` with your credentials:

```bash
# Example values (replace with your actual values)
NODE_ENV=test
TEST_SUPABASE_URL=https://abcdefgh.supabase.co
TEST_SUPABASE_PROJECT_REF=abcdefgh
TEST_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
TEST_SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
ALLOW_REMOTE_TEST_DATABASE=true
```

**CRITICAL:**
- `.env.test` is in `.gitignore` (never committed)
- **Keep service role key secret** (never share, never commit)
- Verify `TEST_SUPABASE_PROJECT_REF` contains only alphanumeric (no special chars)

### Step 2.2: Verify .env.test

```bash
# Check that file exists and is readable
ls -la .env.test
cat .env.test | grep TEST_SUPABASE_PROJECT_REF
```

## Part 3: Run Integration Tests

### Step 3.1: Install Dependencies

```bash
npm install
```

### Step 3.2: Run Tests

```bash
# Load .env.test and run integration tests
source .env.test
npm run test:integration:db
```

**Expected output:**

```
✓ 32 passed (29 core + 3 RLS/security)
✗ 0 failed
⊙ 0 skipped
```

If tests fail, see **Troubleshooting** section below.

### Step 3.3: Verify All Tests Pass

The test output should show:
- Schema validation (4 tests)
- claimForPublishing concurrency (4 tests)
- record_published_pin atomicity (5 tests)
- Retry operations (6 tests)
- claimForRetry state protection (3 tests)
- Terminal state protection (4 tests)
- markPostUncertain (2 tests)
- markPostSkipped (2 tests)
- RLS & Security validation (3 tests)

**Total: 32 tests (29 core + 3 RLS/security), all implemented and ready to execute**

## Part 4: Verify Row-Level Security (RLS)

RLS tests are included in the integration suite and verify:
- Anon Key cannot perform direct INSERT/UPDATE/DELETE (returns 403 via RLS policies)
- Service Role Key bypasses RLS (succeeds)
- Operational RPC functions (claim_for_publishing, record_published_pin, etc.) are restricted to service_role only (not callable by anon/public users)

To manually test RLS:

```bash
# In Supabase Studio SQL Editor, test with Anon Key:
# (This will fail as expected)
SELECT * FROM facebook_posts;
-- Error: new row violates row-level security policy

# Switch to Service Role Key (if UI supports it)
# (This will succeed)
SELECT * FROM facebook_posts LIMIT 5;
```

## Part 5: Vercel Deployment (Optional for Phase 2.4)

Vercel deployment is prepared but NOT required for Phase 2.4.

### Step 5.1: Link to Vercel (Optional)

```bash
# One-time setup (if needed)
npm install -g vercel
cd /Users/dilshanrabbie/Desktop/Ceylon-Haven-Pinterest-Automation
vercel link
# Follow prompts to create/link Vercel project
```

### Step 5.2: Configure Environment Variables (Optional)

In Vercel dashboard (https://vercel.com/projects):

1. Select project
2. Settings → Environment Variables
3. Add (for Preview/Development only):
   - `SUPABASE_URL` = your dev project URL
   - `SUPABASE_ANON_KEY` = your dev anon key
   - `FB_GRAPH_API_VERSION` = `v26`
   - `CRON_SECRET` = any test value
4. Do NOT add `SUPABASE_SERVICE_ROLE_KEY` to Vercel

### Step 5.3: Deploy Preview (Optional)

```bash
vercel --prod false  # Deploy as preview
```

Verify health endpoint:

```bash
curl https://[preview-url].vercel.app/api/health
```

Should return:

```json
{
  "status": "ok",
  "phase": "development",
  "databaseConfigured": true,
  "environment": "development"
}
```

## Part 6: Troubleshooting

### Tests Fail: "SAFETY GUARD FAILED"

**Problem:** Safety guard error (e.g., `TEST_SUPABASE_URL` not set)

**Solution:**
1. Verify `.env.test` exists: `ls -la .env.test`
2. Verify contents: `cat .env.test`
3. Verify environment variables are loaded: `source .env.test && echo $TEST_SUPABASE_URL`
4. Run tests again: `npm run test:integration:db`

### Tests Fail: "Cannot connect to Supabase"

**Problem:** Connection timeout or 404

**Solution:**
1. Verify URL format is correct (no trailing slash): `https://xxxxx.supabase.co`
2. Verify project exists in Supabase dashboard
3. Verify project is active (not paused)
4. Check internet connection

### Tests Fail: "Authentication failed"

**Problem:** Invalid API keys

**Solution:**
1. Re-copy keys from Supabase dashboard (Project Settings → API)
2. Verify keys don't have extra spaces or newlines
3. Verify `TEST_SUPABASE_PROJECT_REF` matches the project ref in URL

### Tests Fail: "Table does not exist"

**Problem:** Migrations not applied

**Solution:**
1. Go to Supabase Studio → SQL Editor
2. Verify migrations were executed (check output logs)
3. Check Table Editor for tables: `facebook_posts`, `pinterest_pins`, `execution_logs`
4. If missing, manually run migrations:
   - Copy contents of `db/migrations/0001_init_schema.sql`
   - Execute in SQL Editor
   - Repeat for `db/migrations/0002_atomic_operations.sql`

### Tests Fail: "403 Forbidden" on RLS tests

**Problem:** RLS policies not applied or incorrect

**Solution:**
1. Verify RLS is enabled:
   - Supabase Studio → Authentication → Policies
   - Each table should show "RLS is ON"
2. Verify policies are created (should see policy entries for each table)
3. If missing, create default deny policy:
   - Click "Create policy" on table
   - Select "For all users using (false)" template
   - This denies all direct access (RPC functions bypass this)

## Part 7: Development Workflow

### Running Tests Locally

```bash
# Load credentials
source .env.test

# Run all tests
npm test

# Run only integration tests
npm run test:integration:db

# Run with verbose output
npm run test:integration:db -- --reporter=verbose
```

### Test Data Cleanup

Tests automatically clean up after themselves. If you need to manually clear test data:

```bash
# In Supabase Studio SQL Editor:
DELETE FROM pinterest_pins WHERE facebook_post_id LIKE 'test_%';
DELETE FROM facebook_posts WHERE facebook_post_id LIKE 'test_%';
DELETE FROM execution_logs WHERE name LIKE 'test_%';
```

### Making Code Changes

1. Edit source code (app/, db/, lib/, services/)
2. Run type check: `npm run type-check`
3. Run linter: `npm run lint`
4. Run tests: `npm test`
5. Commit to Git: `git add . && git commit -m "..."`

## Part 8: Safety Practices

### Credentials

- **Never commit .env.test**
- **Never share service role key**
- **Never use production credentials in development**
- **Never log credentials** (tests sanitize all output)

### Development vs Production

| Aspect | Development | Production |
|--------|-------------|------------|
| Database | `ceylon-haven-pinterest-dev` | `ceylon-haven-pinterest` (future) |
| Credentials | Test values | Real values (Phase 3+) |
| Facebook App | Test app (future) | Production app |
| Pinterest App | Test app (future) | Production app |
| Vercel | Preview deployments | Production deployment |
| Mutations | Only test data | Real data |
| API Calls | Mocked or 0 | Real (Phase 3+) |

### .gitignore Verification

Verify sensitive files are ignored:

```bash
git status
# Should NOT show:
# - .env, .env.test, .env.local
# - node_modules/
# - .supabase/
# - tsconfig.tsbuildinfo (if in ignore)
```

## Part 9: Next Steps

After this setup is complete:

1. **Verify all tests pass** (29/29)
2. **Commit updated test safety guards:**
   ```bash
   git add tests/integration.database.test.ts
   git commit -m "Update test safety guards for cloud Supabase development"
   ```
3. **Optional: Set up Vercel Preview** (Part 5)
4. **Document Phase 2.4 completion** (see PHASE_2_4_REPORT.md)
5. **Prepare for Phase 3** (API integration)

## Appendix A: Project References

- **Supabase Dashboard:** https://supabase.com/dashboard
- **Supabase Docs:** https://supabase.com/docs
- **Vercel Dashboard:** https://vercel.com/projects (after linking)
- **GitHub Repository:** Initial commit created
- **Environment Guide:** See .env.test.example
- **Test Suite:** 29 integration tests, all cloud-based

## Appendix B: Support

If you encounter issues:

1. Check this troubleshooting section
2. Review test output for specific error messages
3. Check Supabase logs: Project → Logs → Database
4. Check Vercel logs: Deployments → Logs (if deployed)

---

**Last Updated:** 2026-09-03  
**Phase:** 2.4 Revised - Cloud Development Setup
