# Phase 2.4 Test Setup Guide

This guide explains how to set up the local Supabase test environment and run the 29 integration tests.

## Prerequisites

Before running the integration tests, you need:

### 1. Docker or Podman
Supabase CLI requires Docker to run the local Supabase instance.

**macOS:**
- Download Docker Desktop: https://www.docker.com/products/docker-desktop
- Install and start Docker

**Linux:**
```bash
# Ubuntu/Debian
sudo apt-get install docker.io

# Then start Docker daemon
sudo systemctl start docker
```

**Windows:**
- Download Docker Desktop: https://www.docker.com/products/docker-desktop
- Install and start Docker

**Verify installation:**
```bash
docker --version
```

### 2. Supabase CLI
Already installed globally: `supabase --version` should show version 2.116.0 or newer.

If not installed:
```bash
npm install -g supabase
```

### 3. Node.js & npm
```bash
node --version  # Should be v18+
npm --version   # Should be v9+
```

## Setup Steps

### Step 1: Navigate to Project Directory
```bash
cd /Users/dilshanrabbie/Desktop/Ceylon-Haven-Pinterest-Automation
```

### Step 2: Start Local Supabase
This script will:
- Start PostgreSQL database
- Start PostgREST API
- Apply all migrations
- Extract test credentials
- Create `.env.test` file

```bash
bash scripts/setup-test-db.sh
```

**First run may take 2-5 minutes** (downloads Docker images).

Expected output:
```
=== Ceylon Haven Phase 2.4: Local Supabase Test Environment ===

✓ Prerequisites found:
  - Supabase CLI: 2.116.0
  - Docker: Docker version 27.x.x

Starting local Supabase instance...
(takes 1-2 minutes on first run)

✓ Supabase is running!

✓ Credentials retrieved

Creating .env.test file...
✓ Created .env.test

=== Local Supabase Configuration ===
PostgREST API URL: http://localhost:54321
PostgreSQL Database: postgresql://postgres:postgres@localhost:54322/postgres
Supabase Studio: http://localhost:54323

Migrations applied: 2 files

=== Next Steps ===
(instructions printed)

✓ Setup complete!
```

### Step 3: Load Test Environment
```bash
source .env.test
```

This loads:
```env
NODE_ENV=test
TEST_SUPABASE_URL=http://localhost:54321
TEST_SUPABASE_ANON_KEY=...
TEST_SUPABASE_SERVICE_ROLE_KEY=...
```

### Step 4: Run Integration Tests
```bash
npm run test:integration:db
```

Expected output:
```
 ✓ Supabase API Integration Tests (Local HTTP API) (29 tests)
   ✓ Schema Validation (4 tests)
     ✓ should have facebook_posts table
     ✓ should have pinterest_pins table
     ✓ should have execution_logs table
     ✓ should enforce UNIQUE constraint on facebook_post_id
   ✓ claimForPublishing (discovered -> publishing) (4 tests)
   ✓ recordPublishedPin (atomic transaction) (5 tests)
   ✓ Retry operations (atomic increment) (6 tests)
   ✓ claimForRetry (failed -> publishing) (3 tests)
   ✓ State protection (9 tests)
   ✓ markPostUncertain (publishing -> uncertain) (2 tests)
   ✓ markPostSkipped (discovered -> skipped) (2 tests)

✓ 29 passed, 0 failed, 0 skipped
```

## What's Being Tested

### 29 Integration Tests

**Schema Validation (4 tests)**
- Tables exist
- Constraints enforced
- ENUM types correct

**State Transitions via Supabase API (20 tests)**
- `claim_for_publishing` (discovered → publishing)
- `record_published_pin` (atomic transaction)
- `increment_retry_and_fail` (retry counter)
- `claim_for_retry` (failed → publishing)
- `mark_post_uncertain` (publishing → uncertain)
- `mark_post_skipped` (discovered → skipped)

**Concurrency & Atomicity (5 tests)**
- Simultaneous claims (only one succeeds)
- Retry increment race condition prevention
- Transaction rollback on errors

## Supabase Studio (Optional)

To view the database in Supabase Studio:

1. Make sure Supabase is running: `supabase status`
2. Open http://localhost:54323 in browser
3. Login with:
   - Email: supabase@example.com
   - Password: password

You can view:
- Tables and schema
- Execute SQL queries
- View real-time data
- Manage users and auth

## Troubleshooting

### "Docker not found" Error
```bash
# Check Docker is running
docker ps

# If not, start Docker Desktop or daemon
# macOS: Start Docker.app from Applications
# Linux: sudo systemctl start docker
# Windows: Start Docker Desktop from Start Menu
```

### "supabase status" shows "Not running"
```bash
# Start Supabase again
supabase start

# Wait 1-2 minutes for services to start
```

### Tests fail with "Connection refused"
```bash
# Check Supabase is running
supabase status

# If API not ready, wait and retry:
# supabase status

# Check .env.test was created
cat .env.test

# Reload environment
source .env.test
```

### "NODE_ENV must be 'test'" Error
```bash
# Make sure you loaded .env.test
source .env.test

# Verify it's set
echo $NODE_ENV  # Should print: test
```

### Tests hang or timeout
```bash
# Restart Supabase
supabase stop
supabase start

# Wait 2-3 minutes for all services to start
# Then reload environment and re-run tests
source .env.test
npm run test:integration:db
```

### PostgreSQL port already in use (54322)
```bash
# Check what's using the port
lsof -i :54322

# If another Supabase is running, stop it
supabase stop

# Or change the port in supabase/config.toml [db] section
# Then run: supabase start
```

## Stopping Supabase

### Keep Data (next session will have same data)
```bash
supabase stop
```

### Reset Database (clean state)
```bash
supabase db reset
```

### Full Stop with Backup
```bash
supabase stop --backup
```

## Production vs Test Environment

**Test Environment (Local):**
- Runs at http://localhost:54321
- Uses test-only credentials
- Tests use `NODE_ENV=test`
- Safety guards prevent production mutations

**Production Environment:**
- Will run on Vercel Functions
- Uses Vercel environment variables
- Uses production Supabase project
- Real Facebook/Pinterest APIs

## API Endpoints (During Testing)

When Supabase is running:

| Service | URL | Purpose |
|---------|-----|---------|
| PostgREST API | http://localhost:54321 | Main API (REST) |
| PostgreSQL | localhost:54322 | Raw database access (for CLI) |
| Supabase Studio | http://localhost:54323 | Web UI for database management |
| Realtime | ws://localhost:54321 | WebSocket (for subscriptions) |

## Full Validation Suite

After tests pass, run the complete validation:

```bash
npm install        # Verify dependencies
npm audit          # Check security
npm run type-check # TypeScript validation
npm run lint       # Code style check
npm test           # Unit + mock tests
npm run test:integration:db  # Integration tests (requires Supabase)
npm run build      # Production build
```

## Next Steps

Once all 29 integration tests pass:

1. **Review Results**
   - Check test output for any warnings
   - Verify all 0 skipped

2. **Phase 3 Ready**
   - Real Facebook Graph API integration
   - Real Pinterest API integration
   - Content adaptation
   - Monitoring/alerting

3. **Production Deployment**
   - Vercel project setup
   - Environment variables in Vercel
   - Supabase production project
   - Deploy to Vercel

## Questions?

See:
- `PHASE_2_4_REPORT.md` - Detailed explanation of Phase 2.4 corrections
- `ARCHITECTURE_PHASE1.md` - Overall architecture
- `DECISIONS.md` - Why these choices were made
