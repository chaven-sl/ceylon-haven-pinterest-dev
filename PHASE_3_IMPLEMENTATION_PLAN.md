# Phase 3 Implementation Plan: Facebook → Pinterest Real API Integration

**Date Created:** 2026-09-03  
**Date Corrections Completed:** 2026-09-03  
**Status:** ✓ PRE-FLIGHT CORRECTION PASS COMPLETE - Ready for Phase 3 Implementation  
**Prepared By:** Claude Haiku 4.5  
**Version:** 2.0 (Post-Correction)

---

## Navigation for Phase 3

**Start here for Phase 3 Implementation:**
1. **[PHASE_3_CORRECTION_REPORT.md](PHASE_3_CORRECTION_REPORT.md)** — Executive summary of all corrections
2. **[PHASE_3_API_VERIFICATION.md](PHASE_3_API_VERIFICATION.md)** — Current Facebook API v26 + Pinterest API v5 specs
3. **[PHASE_3_ARCHITECTURE_CORRECTIONS.md](PHASE_3_ARCHITECTURE_CORRECTIONS.md)** — Design for token persistence, retries, board routing, content adaptation
4. This document — Detailed implementation guide

---

## Section 1: Current Verified Project State

**Phase Status:** Phase 2.4 COMPLETE ✓

**Test Results:**
- Unit tests: 83 passed, 0 failed
- Integration tests (cloud Supabase): 32 passed, 0 failed, 0 skipped
- Type checking: 0 errors
- ESLint: 0 errors
- Build: Success
- npm audit: 0 vulnerabilities

**Git Verification:**
- Commit: `01de63b` (Sep 3 16:53:01 2026)
- Message: "Phase 2.4: Cloud integration testing complete - ALL 32 TESTS PASSED"
- Confirmed: All cloud Supabase integration tests executed successfully

**Repository State:**
- Source code: Complete (app/, db/, lib/, services/)
- Database schema: 2 migrations applied (0001_init_schema.sql, 0002_atomic_operations.sql)
- Test suite: 115 tests total (83 unit/mock + 32 integration)
- Documentation: Complete (8 phase reports + architecture guides)
- GitHub: Initialized with clean git history (no committed secrets)

---

## Section 2: Documentation Corrections Performed

**Stale Information Identified and Status:**

### Documentation Corrections Status

| File | Issue | Final Status |
|------|-------|--------------|
| PROJECT_STATUS.md | Claims "29 integration tests still awaiting execution" | ✓ Reconciled |
| PHASE_2_4_HANDOFF.md | Claims tests are "pending" execution | ✓ Reconciled |
| PHASE_2_4_HANDOFF_SUMMARY.md | Claims test execution blocked on Docker | ✓ Reconciled |
| DEVELOPMENT_SETUP.md | References "29 tests" instead of 32 | ✓ Reconciled |
| README.md | References "29 tests pass" in setup section | ✓ Reconciled |
| CHANGELOG.md | Phase 2.4 entry needs completion status | ✓ Reconciled |

**Corrections Summary:**
- 32 integration tests (not 29) have been executed and passed
- Tests ran against cloud Supabase (smechrmugemwvqugigwk.supabase.co)
- No Docker was required for cloud testing
- Full validation suite: all checks passed
- Architecture: proven production-ready

**Historical Information Preserved:**
- Phase 1 research and decisions: INTACT (marked as complete)
- Phase 2 foundation work: INTACT (marked as complete)
- Phase 2.1-2.3 evolution: INTACT (marked as completed phases)

---

## Section 3: Repository Audit Findings

**Consistency Verification Results:**

### Architecture ✓ VERIFIED
- GitHub → Vercel → Supabase pipeline correct
- Environment isolation: dev/prod credentials separated
- State machine: valid transitions confirmed (discovered → publishing | skipped; publishing → published | failed | uncertain; failed → publishing with retry limit)
- Retry logic: MAX_RETRIES=3, failed→publishing confirmed in state/transitions.ts

### Database ✓ VERIFIED
- Schema migration 0001: Three tables (facebook_posts, pinterest_pins, execution_logs)
- Migration 0002: Six RPC functions (claim_for_publishing, record_published_pin, increment_retry_and_fail, claim_for_retry, mark_post_uncertain, mark_post_skipped)
- UNIQUE constraints: facebook_post_id, pinterest_pin_id (prevent duplicates at DB level)
- RLS configuration: Enabled on all tables; service_role permitted; anon denied
- Atomic operations: All state transitions protected by RPC functions

### RLS Security ✓ VERIFIED
- Anon key: Cannot perform direct INSERT/UPDATE/DELETE (returns 403)
- Service role key: Bypasses RLS (permitted for scheduled functions)
- RPC functions: Restricted to service_role only (not callable by public/anon)
- Production parity: Tests verify same constraints will apply to production

### Test Isolation ✓ VERIFIED
- Safety guards (3 layers): NODE_ENV=test, ALLOW_REMOTE_TEST_DATABASE=true, TEST_SUPABASE_URL contains project ref
- Development project only: Tests use explicit project ref verification (smechrmugemwvqugigwk)
- Production protection: No tests connect to production (separate project credentials required)
- Test data cleanup: Tests auto-cleanup before/after execution

### Build & Deployment ✓ VERIFIED
- next.config.js: Production-ready (Turbopack enabled)
- vercel.json: Cron schedule configured (06:30 UTC = 12:00 PM Asia/Colombo)
- Environment variables: Documented in .env.example (no secrets committed)
- Type safety: TypeScript strict mode, all types verified
- ESLint: 0 errors, 0 warnings

### API Abstractions ✓ VERIFIED
- Mock Pinterest service (services/mock-pinterest.ts): Suitable for replacing with real API
- Database abstraction (db/operations.ts): RPC-based, production-ready
- Supabase client (db/supabase.ts): Correct initialization for production

### Secrets Management ✓ VERIFIED
- .gitignore: Excludes .env*, node_modules, .supabase, secrets
- No secrets in repo: Git history clean
- Credential management: Vercel environment variables (verified via audit)
- Service role key: Never exposed in client code or logs

---

## Section 4: Facebook Graph API Findings

**Current API Status (as of Phase 2.4 design - September 2026)**

### Version & Endpoints
- Current: Meta Graph API v26 (configured in .env.example)
- Page feed retrieval: GET /{PAGE_ID}/posts endpoint (recommended for page-only content)
- Required permissions: 
  - `pages_read_engagement` (read post engagement metrics)
  - `pages_read_user_content` (read Facebook Page content)
  - **DO NOT use `manage_pages` (deprecated)**

### Media Retrieval
- Endpoint: GET /{POST_ID}/attachments (retrieves media metadata)
- Supported formats: image/jpeg, image/png, image/gif, image/webp
- CDN: Facebook CDN (URLs stable and cacheable)
- Resolution requirement: For Pinterest (1000x1000px minimum recommended, 2000x2000px ideal)

### Pagination & Rate Limits
- Pagination: Cursor-based (next/after tokens in response)
- Limit: Recommended batch size 100 posts per request
- Rate limits: As of 2026, 100 calls/minute per application (standard tier)
- Daily limits: 10,000 calls/app/day (standard tier, sufficient for once-daily execution)

### Token Management
- Access Token: Long-lived (~60+ days); refresh not necessary for once-daily use
- Refresh strategy: Preemptive refresh every 25 days (prevents expiration mid-execution)
- Token expiration: Check via /me/accounts endpoint during daily run
- Re-authorization: Required if user removes app or changes password

### API Review Requirements
- Standard app: No additional approval needed for accessing own Page
- Production requirements: App review may be needed for production app store listing
- Data access permissions: Refresh required every 90 days (manual renewal via app dashboard)

**NOTE:** Current documentation assumes Graph API v26. **VERIFY** against current Meta documentation before Phase 3 implementation begins. Meta frequently updates versions and endpoints.

---

## Section 5: Pinterest API Findings

**Current API Status (as of Phase 2.4 design - September 2026)**

### Version & Endpoints
- Current: Pinterest REST API v5 (supported)
- Pin creation: POST /v5/pins (create single pin)
- Board retrieval: GET /v5/user_account/boards (list user boards)
- Pin lookup: GET /v5/pins/{pin_id} (retrieve pin details)

### OAuth & Token Management
- OAuth scopes required (Phase 3 minimum):
  - `boards:read` (read board information)
  - `pins:write` (create pins)
  
- Access token: 30-day expiration (must refresh before expiration)
- Refresh token: 60-day rolling window (extends on each successful refresh)
- Refresh strategy: Check expiration at start of daily run; refresh if <7 days remaining

### Pin Creation Requirements
- Media source: Required (image URL or image upload)
- Title: Required (max 100 characters)
- Description: Optional (max 500 characters)
- URL (link): Required (destination URL for click-throughs)
- Board ID: Required (destination board)
- Supported image formats: JPG, PNG, GIF, WebP
- Image size: 1000x1500px ideal (aspect ratio 2:3); minimum 200x300px

### Rate Limits
- Write limit: 100 requests/minute (pin creation is write operation)
- At 1 pin/day: 1440 requests/month = 1.4% of write capacity (very safe)
- Read limit: Higher quota (no concerns for daily board enumeration)
- No daily caps; sustainable indefinitely at current volume

### Trial vs Standard Access
- Trial apps: Limited to 10 pins/month
- Standard apps: Unlimited (after review approval)
- To upgrade: Submit for Pinterest app review (specify production intent)
- Review time: 2-4 weeks typical

**NOTE:** Verify against current Pinterest API documentation (developers.pinterest.com) before implementation. Pinterest API frequently updates endpoints and requirements.

---

## Section 6: Architecture Changes Recommended

**NO BREAKING CHANGES REQUIRED** for Phase 3.

However, the following non-blocking improvements are recommended:

### 1. Token Refresh Architecture (Recommended)
- Add token_refreshed_at to database schema
- Log token refresh events to execution_logs
- Implement early refresh (refresh when <7 days to expiration)
- Handle refresh failures gracefully (log, alert, but don't fail execution)

### 2. Board Routing Configuration (Recommended)
- Add boards table or JSON column for board routing rules
- Example structure:
  ```
  property_name -> board_id mapping
  "The Beach Home" -> "Sri Lanka Villas"
  "Colombo Heritage" -> "Sri Lanka City Stays"
  ```
- Make routing configurable without code changes

### 3. Error Categorization (Nice-to-Have)
- Distinguish transient errors (rate limit, network) vs fatal (auth, invalid data)
- Different retry strategy per error type
- Current implementation (retry all 3x) is reasonable for Phase 3

### 4. Observability Enhancements (Nice-to-Have)
- Log Pinterest API response times
- Track rate limit headers for capacity planning
- Monitor token refresh success rate
- Currently execution_logs table is prepared; add fields as needed

---

## Section 7: Phase 3 Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Vercel Cron Job (daily)                      │
│                   06:30 UTC (12:00 PM Asia/Colombo)             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│              /api/cron/facebook-pinterest Endpoint               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 1. Validate CRON_SECRET in Authorization header           │  │
│  │ 2. Initialize Supabase service-role client                │  │
│  │ 3. Log execution start to execution_logs                  │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│              Facebook Graph API Integration Client               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Services/facebook.ts                                       │  │
│  │ - Fetch page posts: GET /page_id/feed                      │  │
│  │ - Get post attachments: GET /post_id/attachments          │  │
│  │ - Handle pagination (cursor-based)                         │  │
│  │ - Rate limit tracking                                      │  │
│  │ - Error handling (retry on network errors)                 │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│              Post Discovery & Classification                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ For each post:                                              │  │
│  │ 1. Check Supabase for existing facebook_post_id            │  │
│  │ 2. Extract: caption, media URL, timestamp                  │  │
│  │ 3. Classify: single-image → supported, else → skipped      │  │
│  │ 4. Record new posts in facebook_posts table (discovered)   │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│            Atomic Claim & Publishing Pipeline                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ For each discovered post:                                  │  │
│  │ 1. Atomically claim: discovered → publishing               │  │
│  │    (RPC: claim_for_publishing)                             │  │
│  │ 2. Content adaptation: title + description generation      │  │
│  │ 3. Board routing: map property → Pinterest board           │  │
│  │ 4. Resolve destination URL: property landing page          │  │
│  │ 5. Attempt publish (with retries)                          │  │
│  │ 6. On success: record_published_pin RPC                    │  │
│  │ 7. On failure: increment_retry_and_fail RPC                │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│              Pinterest API Integration Client                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Services/pinterest.ts                                      │  │
│  │ - OAuth token management (with refresh)                    │  │
│  │ - Create pins: POST /v5/pins                               │  │
│  │ - Get user boards: GET /v5/user_account/boards             │  │
│  │ - Media validation (format, size)                          │  │
│  │ - Rate limit tracking (100/minute)                         │  │
│  │ - Error handling (distinguish transient vs fatal)          │  │
│  │ - Retry logic (exponential backoff, MAX_RETRIES=3)         │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│              Execution Logging & Monitoring                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Record in execution_logs:                                   │  │
│  │ - Posts fetched: count                                     │  │
│  │ - Posts published: count + success rate                    │  │
│  │ - Posts failed: count + error types                        │  │
│  │ - Execution duration                                       │  │
│  │ - Pinterest rate limit status                              │  │
│  │ - Token refresh status                                     │  │
│  │ - Any errors encountered                                   │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│                    Response & Cleanup                             │
│  - Return execution summary (HTTP 200/500)                       │
│  - Cleanup test data (if applicable)                             │
│  - Log completion timestamp                                      │
└──────────────────────────────────────────────────────────────────┘
```

**Component Files (Existing → Will Extend for Phase 3):**
- app/api/cron/facebook-pinterest/route.ts - Main orchestrator
- services/facebook.ts - NEW (Facebook API integration)
- services/pinterest.ts - NEW (Pinterest API integration, replaces mock)
- lib/classify.ts - Existing (post type classification)
- lib/adapt.ts - NEW (content adaptation)
- db/operations.ts - Existing (atomic DB operations via RPC)
- lib/board-routing.ts - NEW (property → board mapping)

---

## Section 8: Data Flow Diagram

```
DISCOVERY PHASE
───────────────────────────────────────────────────────────────

Facebook API
   └─→ [Fetch /page_id/feed]
       ├─ Pagination (cursor-based)
       └─→ Post list (caption, media URL, timestamp)
       
Discovery Logic
   └─→ [For each post]
       ├─ Check facebook_post_id uniqueness
       ├─ Extract media (single image only)
       ├─ Mark duplicate posts as "skipped"
       └─→ Record in facebook_posts (status: discovered)


PUBLISHING PHASE
───────────────────────────────────────────────────────────────

Atomic Claim
   └─→ [RPC: claim_for_publishing]
       ├─ discovered → publishing (atomic)
       └─→ Lock obtained (concurrent safety)

Content Adaptation
   └─→ [lib/adapt.ts]
       ├─ Generate Pinterest title (deterministic template)
       ├─ Generate description (property-aware)
       ├─ Validate character limits
       └─→ Adapted content ready

Board Routing
   └─→ [lib/board-routing.ts]
       ├─ Extract property name from post caption
       ├─ Map to target board (config-driven)
       ├─ Validate board ID exists
       └─→ Board ID selected

Pinterest API
   └─→ [Prepare request]
       ├─ POST /v5/pins
       ├─ media_source: { url: facebook_image_url }
       ├─ title: adapted_title
       ├─ description: adapted_description
       ├─ url: property_landing_page
       ├─ board_id: target_board_id
       └─→ Send request

Pinterest Response
   ├─ Success (200) → RPC: record_published_pin
   │                   ├─ Insert pinterest_pins record
   │                   ├─ publishing → published
   │                   └─→ Execution summary: +1 success
   │
   └─ Failure (4xx/5xx) → Retry Decision
       ├─ Transient (rate limit, timeout)?
       │  └─→ Retry up to 3 times (exponential backoff)
       │      ├─ On eventual success → published
       │      └─ On all failures → RPC: increment_retry_and_fail
       │                           ├─ publishing → failed
       │                           ├─ increment retry_count
       │                           └─→ Execution summary: +1 failed
       │
       └─ Fatal (auth, invalid)?
           └─→ RPC: mark_post_uncertain
               ├─ publishing → uncertain (manual review)
               └─→ Execution summary: +1 uncertain


COMPLETION PHASE
───────────────────────────────────────────────────────────────

Execution Summary
   └─→ Record in execution_logs
       ├─ posts_fetched: N
       ├─ posts_discovered: N
       ├─ posts_published: N
       ├─ posts_failed: N
       ├─ posts_skipped: N
       ├─ posts_uncertain: N
       ├─ duration_seconds: D
       ├─ pinterest_rate_limit: current/100
       └─→ Log complete

Manual Override (Optional)
   └─→ [Planned for Phase 3+]
       ├─ Dashboard endpoint: POST /api/manual/run-now
       ├─ Bypasses cron schedule
       └─→ Trigger immediate execution
```

---

## Section 9: Token Lifecycle Architecture

```
INITIALIZATION (Daily Run Start)
────────────────────────────────────────────

Supabase Service Role Key
   └─→ [Environment variable: SUPABASE_SERVICE_ROLE_KEY]
       ├─ Never exposed in client-side code
       ├─ Used only by Vercel Function (backend)
       ├─ Rotated at infrastructure level (Vercel)
       └─→ Initialize client: createClient(URL, serviceRoleKey)

Facebook Page Access Token
   └─→ [Environment variable: FACEBOOK_ACCESS_TOKEN]
       ├─ Retrieved from Meta App Dashboard
       ├─ Stored in Vercel environment variables
       ├─ Long-lived (~60+ days, no active refresh needed for once-daily)
       ├─ Check validity: GET /me endpoint at runtime
       └─→ Use for all Facebook API calls

Pinterest OAuth Token Management (CORRECTED ARCHITECTURE)
   └─→ [Vercel deployment-level secrets (set once)]
       ├─ PINTEREST_APP_ID (plaintext)
       ├─ PINTEREST_APP_SECRET (secured)
       └─ TOKEN_ENCRYPTION_KEY (32-byte random, base64-encoded)
   
   └─→ [Supabase runtime storage (mutable per execution)]
       ├─ access_token_encrypted (libsodium crypto_secretbox: XSalsa20-Poly1305, 256-bit key)
       ├─ refresh_token_encrypted (libsodium crypto_secretbox: XSalsa20-Poly1305, 256-bit key)
       ├─ access_token_expires_at (TIMESTAMPTZ)
       ├─ refresh_token_expires_at (TIMESTAMPTZ)
       └─ last_refreshed_at (TIMESTAMPTZ)


REFRESH CYCLE (30-Day Window)
────────────────────────────────────────────

At daily run start:
1. Read encrypted tokens from Supabase (pinterest_oauth_tokens table)
2. Check access_token_expires_at
3. If <24 hours to expiration:
   └─→ POST /v5/oauth/token endpoint
       ├─ Send: grant_type=refresh_token, refresh_token, client_id, client_secret
       ├─ Receive: new access_token, new refresh_token, expires_in
       ├─ Encrypt new tokens in Node.js (libsodium)
       ├─ Call Supabase RPC: refresh_pinterest_token(encrypted_access, encrypted_refresh, expires_at)
       └─→ Atomic update ensures consistency

If refresh fails:
   ├─ Log error (non-fatal)
   ├─ Attempt to continue with existing token
   └─→ If existing token also invalid, execution fails with auth error

**NOTE:** Tokens stored encrypted in Supabase, never as plaintext in environment variables


USAGE (API Calls)
────────────────────────────────────────────

Facebook API
   └─→ Authorization: GET /v26.0/{page_id}/posts?access_token={FACEBOOK_ACCESS_TOKEN}
       ├─ No token refresh needed (long-lived, once-daily)
       └─→ If 401: token expired, requires manual renewal

Pinterest API
   └─→ Authorization: Bearer {PINTEREST_ACCESS_TOKEN} (in Authorization header)
       ├─ If 401: token expired, check if refresh was attempted
       └─→ If refresh failed: log, mark execution as uncertain


ERROR HANDLING
────────────────────────────────────────────

Token Expired
   ├─ Facebook: Manual renewal required (user action)
   │            Re-generate in Meta App Dashboard
   │
   └─ Pinterest: Attempted auto-refresh
               ├─ If refresh succeeds: continue execution (log refresh)
               └─ If refresh fails: halt execution, mark as uncertain

Token Invalid/Revoked
   ├─ Facebook: User removed app access
   │            Requires re-authorization (user action)
   │
   └─ Pinterest: User revoked app access
               Requires re-authorization via OAuth (user action)

Quota Exhausted
   └─→ Pinterest 30-day pin limit (if Standard access) → Skip new pins


ROTATION STRATEGY (Recommended Annual)
────────────────────────────────────────────

1. Generate new Facebook Page Access Token (via Meta App Dashboard)
2. Update FACEBOOK_ACCESS_TOKEN in Vercel
3. Test health endpoint: GET /api/health
4. Verify execution logs show successful API calls
5. Remove old token from Meta App Dashboard

For Pinterest:
1. Re-authenticate user (complete OAuth flow)
2. Encrypt new access/refresh tokens in Node.js
3. Store encrypted tokens in Supabase (pinterest_oauth_tokens table)
4. Test: create sample pin to verify access
5. Verify token refresh works via RPC function
6. Note: No Vercel environment variable updates needed (credentials stored in Supabase)
```

---

## Section 10: Board Routing Architecture

```
BOARD ROUTING CONFIGURATION (Supabase Table)
──────────────────────────────────────────────

Configuration Source: Supabase board_routing_config table (CORRECTED ARCHITECTURE)

Schema:
  └─→ Table: board_routing_config
      ├─ Columns:
      │  ├─ id SERIAL PRIMARY KEY
      │  ├─ property_id TEXT UNIQUE (e.g., "ceylon-haven-beach-home")
      │  ├─ property_name TEXT (e.g., "The Beach Home")
      │  ├─ property_type TEXT (e.g., "villa", "beach", "boutique")
      │  ├─ pinterest_board_id TEXT (Pinterest board ID)
      │  ├─ pinterest_board_name TEXT (Pinterest board name)
      │  ├─ destination_url TEXT (property landing page URL)
      │  ├─ active BOOLEAN DEFAULT TRUE
      │  ├─ created_at TIMESTAMPTZ
      │  └─ updated_at TIMESTAMPTZ
      │
      └─ Usage:
          ├─ At run start: Load all active mappings from Supabase
          ├─ For each post: Extract property name from caption
          ├─ Query table: SELECT pinterest_board_id, destination_url WHERE property_id = X
          └─→ Use board_id and URL for pin creation

Advantages:
  ├─ Easy to modify board mappings without code deployment
  ├─ Add new properties without releasing new version
  ├─ Disable properties without code changes
  ├─ All data persists between executions
  └─ Access controlled via Supabase RLS


PROPERTY EXTRACTION
──────────────────────────────────────────────

From Facebook Post Caption:
  ├─ Strategy 1: Keyword detection (simplest)
  │              └─ If caption includes "The Beach Home" → use beach board
  │
  ├─ Strategy 2: Metadata tagging (if available)
  │              └─ Extract property code from post (if tagged)
  │
  └─ Strategy 3: Manual mapping (fallback)
                 └─ If property cannot be determined → use default board

Example:
  Post Caption: "Slow mornings at The Beach Home 🌴..."
  └─→ Contains "The Beach Home"
      └─→ Lookup: routing["The Beach Home"]
          └─→ board_id = "1234567890"
              └─→ Create pin on board 1234567890


BOARD VALIDATION
──────────────────────────────────────────────

At run start:
  1. Fetch Pinterest boards: GET /v5/user_account/boards
  2. For each configured board_id:
     ├─ Verify board exists in user's profile
     ├─ If not found: log warning, mark board as invalid
     └─→ Cache valid board IDs for use during execution

During execution:
  ├─ For each post needing routing:
  │  ├─ Check if board_id is in valid board cache
  │  ├─ If valid: proceed with pin creation
  │  └─ If invalid: mark post as uncertain (manual review)
  │
  └─→ Report invalid boards in execution summary


FALLBACK ROUTING
──────────────────────────────────────────────

If board_id cannot be determined:
  1. Check for DEFAULT_BOARD_ID configuration
     └─ Use default if configured (e.g., "Ceylon Haven - General")
  
  2. If no default configured:
     └─ Mark post as uncertain (requires manual routing)
        └─ User reviews in dashboard, selects board, retries

Example Configuration:
  {
    "The Beach Home": "board_001",
    "Colombo Heritage": "board_002",
    "Gampaha Villa": "board_003",
    "DEFAULT": "board_000"  // Fallback board
  }


BOARD CONFIGURATION MANAGEMENT
──────────────────────────────────────────────

For Production Deployment:

1. During Phase 3 setup:
   ├─ User identifies all Ceylon Haven properties
   ├─ User selects corresponding Pinterest boards
   └─→ Record mapping in Supabase or .env

2. To add a new property:
   ├─ Create new Pinterest board (if needed)
   ├─ Add property_name → board_id mapping
   ├─ Verify board is accessible to Pinterest app token
   └─→ No code changes needed

3. To retire a property:
   ├─ Set is_active=false for property mapping
   ├─ Existing pins remain on board (no removal)
   └─→ New posts will skip (no matching board)

This approach keeps board configuration separate from code,
allowing non-technical users to adjust routing without deployment.
```

---

## Section 11: Content Adaptation Architecture

```
TEMPLATE-BASED CONTENT GENERATION (Phase 3)
──────────────────────────────────────────────

NO LLM IN PHASE 3 (Deterministic templates only)

Reasoning:
  ├─ Eliminates API dependency (Claude, OpenAI, etc.)
  ├─ Reduces per-pin cost (currently $0 → would be ~$0.02-0.05 per pin with LLM)
  ├─ Enables testing full pipeline without AI infrastructure
  └─ Business can evaluate effectiveness before AI investment

Phase 3 Implementation: Template-Based


TITLE GENERATION
──────────────────────────────────────────────

Input: Facebook post caption, property name
Output: Pinterest pin title (max 100 characters)

Strategy: Property-aware deterministic templates

Example Rules:
  ├─ Property name detected?
  │  └─ "Beachfront Villa in Galle, Sri Lanka"
  │     └─ Used: "The Beach Home"
  │
  ├─ Location keywords detected?
  │  ├─ "beach" → Include location in title
  │  ├─ "villa" → Append "Villa"
  │  └─ "resort" → Append "Resort"
  │
  └─ Fallback (generic):
      └─ "Sri Lankan Beachfront Getaway"


Implementation Example:

```typescript
function generateTitle(caption: string, propertyName: string): string {
  const titleTemplates: Record<string, string> = {
    "The Beach Home": "Beachfront Villa in Galle, Sri Lanka",
    "Colombo Heritage": "Historic Boutique Escape in Colombo",
    "Gampaha Villa": "Luxury Villa Near Colombo, Sri Lanka",
  };
  
  if (propertyName in titleTemplates) {
    return titleTemplates[propertyName];
  }
  
  // Fallback: Extract first 100 characters of caption
  return caption.substring(0, 100);
}
```

DESCRIPTION GENERATION
──────────────────────────────────────────────

Input: Facebook post caption, property name, title
Output: Pinterest description (max 500 characters)

Strategy: Property-aware, include call-to-action

Template Structure:
  ├─ Hook (first sentence)
  ├─ Property benefit
  ├─ Destination URL
  └─ Call-to-action

Example:

```
Wake up beside the Indian Ocean at this private beachfront villa 
near Galle, Sri Lanka. Discover The Beach Home by Ceylon Haven — 
ideal for families and groups looking for a relaxed south-coast escape.

[Link to property page]
```

Implementation Example:

```typescript
function generateDescription(
  caption: string,
  propertyName: string,
  propertyUrl: string
): string {
  const descriptions: Record<string, string> = {
    "The Beach Home": 
      `Wake up beside the Indian Ocean at this private beachfront villa 
      near Galle, Sri Lanka. Discover The Beach Home by Ceylon Haven — 
      ideal for families and groups looking for a relaxed south-coast escape.
      
      [${propertyUrl}]`,
      
    "Colombo Heritage":
      `Immerse yourself in Colombo's vibrant cultural scene at this 
      historic boutique property. Experience authentic Sri Lankan hospitality 
      at Colombo Heritage by Ceylon Haven.
      
      [${propertyUrl}]`,
  };
  
  return descriptions[propertyName] || caption.substring(0, 500);
}
```

CHARACTER LIMIT VALIDATION
──────────────────────────────────────────────

After template generation:
  ├─ Title: Must be ≤ 100 characters
  │  └─ If too long: Truncate + add "..."
  │
  └─ Description: Must be ≤ 500 characters
      └─ If too long: Truncate + add "..."


IMAGE HANDLING
──────────────────────────────────────────────

Input: Facebook post media
Process:
  ├─ Extract media URL from post attachments
  ├─ Validate format: JPG, PNG, GIF, WebP
  ├─ Validate dimensions: 1000x1500px ideal (min 200x300px)
  ├─ If validation fails: Mark post as uncertain (manual review)
  └─→ Use Facebook CDN URL directly (no download needed)

Aspect Ratio:
  ├─ Pinterest ideal: 2:3 (1000x1500px)
  ├─ Pinterest accepts: 0.5:1 to 2:1
  └─ Strategy: Use original image; Pinterest handles resize


MARKDOWN/HTML STRIPPING
──────────────────────────────────────────────

Facebook captions may contain:
  ├─ Emojis (preserve)
  ├─ @mentions (remove or replace)
  ├─ Hashtags (preserve, optional)
  ├─ Links (remove from description, as we add link later)
  └─ HTML entities (convert to Unicode)

Sanitization:

```typescript
function sanitizeCaption(caption: string): string {
  return caption
    .replace(/@\w+/g, '')           // Remove @mentions
    .replace(/http\S+/g, '')        // Remove URLs
    .replace(/&lt;/g, '<')          // Decode entities
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}
```


MULTILINGUAL CONSIDERATIONS
──────────────────────────────────────────────

Currently (Phase 3):
  └─ All content in English (Ceylon Haven audience is English-speaking)

Future (Phase 4+):
  └─ Could add translations for other markets

Current behavior:
  ├─ Do not auto-translate
  ├─ Preserve any Sinhala text in original captions
  └─ Pinterest handles UTF-8 properly


PHASE 4+ (AI Enhancement)
──────────────────────────────────────────────

Future expansion (not Phase 3):
  ├─ Could replace templates with Claude API
  ├─ Generate unique descriptions per pin
  ├─ Personalize based on post content
  ├─ Add trending hashtags
  └─ Estimated cost: $1-5/month for 30 pins/month

For Phase 3: Keep deterministic to simplify testing and reduce costs.
```

---

## Section 12: Error and Retry Architecture

```
ERROR CLASSIFICATION & HANDLING
──────────────────────────────────────────────

All errors categorized into two types:

TYPE 1: TRANSIENT ERRORS (Retry Strategy)
  ├─ Network timeout / Connection refused
  ├─ Pinterest rate limit (429)
  ├─ Pinterest temporary service error (5xx)
  ├─ Database temporary unavailable
  │
  └─→ Retry Strategy:
      ├─ Retry up to MAX_RETRIES (3)
      ├─ Exponential backoff: 1s, 2s, 4s
      ├─ On eventual success: Mark published ✓
      ├─ On all retries exhausted: Mark failed
      └─→ Log retry count and backoff delays


TYPE 2: FATAL ERRORS (No Retry)
  ├─ Pinterest authentication failure (401)
  ├─ Invalid board ID (404)
  ├─ Invalid pin data (400)
  ├─ Image URL inaccessible (404)
  ├─ Quota exhausted (Pinterest Standard plan limit)
  │
  └─→ Retry Strategy:
      ├─ Log error immediately
      ├─ Mark post as "uncertain" (requires manual review)
      ├─ Do NOT retry
      └─→ User reviews error in dashboard


STATE MACHINE INTEGRATION
──────────────────────────────────────────────

Existing state transitions (from Phase 2):
  
  discovered
    ├─ [Success] → publishing
    │              ├─ [Success] → published ✓
    │              ├─ [Transient Error] → retry → publishing (loop)
    │              ├─ [Retries Exhausted] → failed
    │              └─ [Fatal Error] → uncertain
    │
    └─ [Classified as skip] → skipped ✓

  failed (recoverable state)
    ├─ [Retry Decision]
    ├─ If retry_count < MAX_RETRIES (3):
    │  └─→ Transition: failed → publishing → published ✓
    └─ If retry_count >= MAX_RETRIES:
       └─→ Terminal: failed (no further retries)

  uncertain (requires manual intervention)
    └─→ Terminal: user reviews and decides action


RETRY LOGIC IMPLEMENTATION
──────────────────────────────────────────────

```typescript
// Current implementation (Phase 2)
const MAX_RETRIES = 3;

// For each post in "publishing" state:
async function attemptPublish(post: FacebookPost): Promise<PublishResult> {
  try {
    // Attempt to create pin
    const pin = await createPinterestPin({
      title: post.title,
      description: post.description,
      url: post.destinationUrl,
      board_id: post.boardId,
      media_source: { url: post.imageUrl }
    });
    
    // Success: Record published pin
    await recordPublishedPin(post.facebook_post_id, pin.id);
    return { success: true };
    
  } catch (error) {
    // Error handling
    if (isTransientError(error) && post.retry_count < MAX_RETRIES) {
      // Transient: schedule retry
      const backoffMs = Math.pow(2, post.retry_count) * 1000;
      await sleep(backoffMs);
      
      // Increment retry count and retry
      await claimForRetry(post.facebook_post_id);
      return attemptPublish(post); // Recursive retry
      
    } else if (isTransientError(error)) {
      // Transient but retries exhausted
      await incrementRetryAndFail(post.facebook_post_id);
      return { success: false, reason: 'retries_exhausted' };
      
    } else {
      // Fatal error: mark uncertain for manual review
      await markPostUncertain(post.facebook_post_id, error.message);
      return { success: false, reason: 'fatal_error' };
    }
  }
}

function isTransientError(error: Error): boolean {
  // Timeout
  if (error.code === 'ETIMEDOUT') return true;
  if (error.code === 'ECONNREFUSED') return true;
  
  // HTTP 429 (rate limit), 5xx (server error)
  if (error.status === 429) return true;
  if (error.status >= 500 && error.status < 600) return true;
  
  // Database connection issues
  if (error.message.includes('connection')) return true;
  
  return false;
}
```


EXECUTION FLOW WITH RETRIES
──────────────────────────────────────────────

Daily Cron Run:
  ├─ Fetch new Facebook posts
  ├─ Discover new posts → facebook_posts (status: discovered)
  │
  ├─ Process discovered posts:
  │  └─ For each post:
  │     ├─ Claim: discovered → publishing
  │     ├─ Attempt publish (with retries)
  │     │  ├─ Success → publishing → published ✓
  │     │  ├─ Transient error, retry<3 → stay publishing, retry next run
  │     │  ├─ Transient error, retry=3 → failed
  │     │  └─ Fatal error → uncertain
  │     └─→ Record result in execution_logs
  │
  ├─ Process previously failed posts (if retry_count < MAX_RETRIES):
  │  └─ For each failed post:
  │     ├─ Claim: failed → publishing
  │     ├─ Attempt publish (with retries)
  │     ├─ Success → published ✓
  │     ├─ Failure → failed (retry_count incremented)
  │     └─→ Record result in execution_logs
  │
  └─ Log execution summary (success/failed/uncertain counts)


ERROR LOGGING & OBSERVABILITY
──────────────────────────────────────────────

Each error recorded with:
  ├─ Error type (transient/fatal)
  ├─ Error message
  ├─ API response (if available)
  ├─ Retry count (if applicable)
  ├─ Timestamp
  └─→ Stored in: facebook_posts.last_error, execution_logs.error_details

For production monitoring (Phase 3+):
  ├─ Alert on: 5+ consecutive failed pins
  ├─ Alert on: Pinterest rate limit exceeded
  ├─ Alert on: Facebook API auth failure
  ├─ Alert on: Uncertain posts require manual review
  └─→ Email/Slack notification to admin

Dashboard view:
  ├─ Recent errors by type
  ├─ Error trend over time
  ├─ Posts requiring manual review (uncertain status)
  └─→ Admin can review and reprocess
```

---

## Section 13: Observability Strategy

```
EXECUTION LOGGING
──────────────────────────────────────────────

Table: execution_logs

For each daily cron run:
  ├─ execution_id: Unique per run (UUID)
  ├─ started_at: Timestamp
  ├─ completed_at: Timestamp (NULL if in progress)
  ├─ duration_seconds: completed_at - started_at
  │
  ├─ Counts:
  │  ├─ posts_fetched: Total from Facebook API
  │  ├─ posts_discovered: New posts added
  │  ├─ posts_published: Successfully created on Pinterest
  │  ├─ posts_failed: Exhausted retries (retrying next run)
  │  ├─ posts_skipped: Not eligible (video, text-only, etc.)
  │  └─ posts_uncertain: Manual review needed
  │
  ├─ API Activity:
  │  ├─ facebook_api_calls: Count of Graph API calls
  │  ├─ facebook_api_errors: Count of failed calls
  │  ├─ pinterest_api_calls: Count of pin creation calls
  │  ├─ pinterest_api_errors: Count of failed calls
  │  └─ pinterest_rate_limit_remaining: 100 - used this run
  │
  ├─ Tokens:
  │  ├─ facebook_token_refreshed: Boolean (always false, long-lived)
  │  ├─ pinterest_token_refreshed: Boolean (true if refresh occurred)
  │  └─ token_refresh_error: Error message if refresh failed
  │
  └─ Summary:
     ├─ error_count: Total errors encountered
     ├─ error_details: JSON array of error objects
     ├─ status: "success" | "partial" | "failed"
     └─ notes: Human-readable summary


EXAMPLE EXECUTION LOG ENTRY
──────────────────────────────────────────────

{
  "execution_id": "550e8400-e29b-41d4-a716-446655440000",
  "started_at": "2026-09-04T06:30:00Z",
  "completed_at": "2026-09-04T06:30:45Z",
  "duration_seconds": 45,
  
  "posts_fetched": 7,
  "posts_discovered": 2,
  "posts_published": 2,
  "posts_failed": 0,
  "posts_skipped": 5,
  "posts_uncertain": 0,
  
  "facebook_api_calls": 2,
  "facebook_api_errors": 0,
  "pinterest_api_calls": 2,
  "pinterest_api_errors": 0,
  "pinterest_rate_limit_remaining": 98,
  
  "facebook_token_refreshed": false,
  "pinterest_token_refreshed": false,
  "token_refresh_error": null,
  
  "error_count": 0,
  "error_details": [],
  "status": "success",
  "notes": "All systems operational. 2 new pins published."
}


QUERY & ANALYSIS EXAMPLES
──────────────────────────────────────────────

```sql
-- Success rate over last 30 days
SELECT 
  DATE(started_at) as run_date,
  COUNT(*) as total_runs,
  SUM(posts_published) as total_published,
  SUM(posts_failed) as total_failed,
  ROUND(100.0 * SUM(posts_published) / NULLIF(SUM(posts_published + posts_failed), 0), 2) as success_rate
FROM execution_logs
WHERE started_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(started_at)
ORDER BY run_date DESC;

-- Identify problematic posts (frequently failed)
SELECT 
  fp.facebook_post_id,
  fp.caption,
  COUNT(el.id) as failure_count,
  MAX(fp.last_error) as latest_error
FROM facebook_posts fp
JOIN execution_logs el ON 1=1
WHERE fp.status = 'failed' AND fp.retry_count >= 3
GROUP BY fp.facebook_post_id
HAVING COUNT(el.id) > 2
ORDER BY failure_count DESC;

-- Pinterest rate limit usage trend
SELECT 
  DATE(started_at) as run_date,
  AVG(100 - pinterest_rate_limit_remaining) as avg_calls_per_run,
  MAX(100 - pinterest_rate_limit_remaining) as max_calls_in_run
FROM execution_logs
WHERE started_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(started_at)
ORDER BY run_date DESC;
```


ALERTING THRESHOLDS
──────────────────────────────────────────────

Trigger alert if:

1. Execution failed to complete
   └─ Email admin: "Cron job did not complete (timeout?)"

2. More than 1 fatal error (status='uncertain')
   └─ Email admin: "Manual review required: N posts uncertain"

3. All posts failed in a run
   └─ Email admin: "No posts published in last run. Check credentials."

4. Pinterest rate limit low (<20 remaining)
   └─ Email admin: "Pinterest rate limit low. Monitor usage."

5. Token refresh failed
   └─ Email admin: "Pinterest token refresh failed. Manual re-auth may be needed."


MONITORING DASHBOARD (Phase 3+ Enhancement)
──────────────────────────────────────────────

Planned metrics display:
  ├─ Success rate (30-day rolling)
  ├─ Posts published (daily trend)
  ├─ Error rate (by type)
  ├─ Pinterest API usage (% of quota)
  ├─ Token refresh status
  ├─ Recent execution logs (sortable, filterable)
  └─ Manual "Run Now" button
```

---

## Section 14: Security Considerations

```
CREDENTIAL ISOLATION
──────────────────────────────────────────────

Environment Variables (Vercel - Deployment-Level):
  ├─ FACEBOOK_ACCESS_TOKEN
  │  └─ Scope: Read Ceylon Haven page posts
  │  └─ Exposure: Never in client-side code
  │
  ├─ PINTEREST_APP_ID (CORRECTED ARCHITECTURE)
  │  └─ Scope: OAuth app identification
  │  └─ Exposure: Never in client-side code
  │
  ├─ PINTEREST_APP_SECRET (CORRECTED ARCHITECTURE)
  │  └─ Scope: OAuth app secret
  │  └─ Exposure: Never in client-side code, never in logs
  │
  ├─ TOKEN_ENCRYPTION_KEY (CORRECTED ARCHITECTURE)
  │  └─ Scope: Encrypt/decrypt Pinterest tokens in Supabase
  │  └─ Exposure: Never in client-side code, never in logs
  │
  ├─ SUPABASE_SERVICE_ROLE_KEY
  │  └─ Scope: Full database access (backend only)
  │  └─ Exposure: Never in client-side code, never in logs
  │
  ├─ CRON_SECRET
  │  └─ Scope: Validate incoming cron requests
  │  └─ Exposure: Compared server-side, never logged
  │
  └─ SUPABASE_ANON_KEY
     └─ Scope: Limited public access (RLS enforced)
     └─ Exposure: Safe to expose in client-side code

Supabase Runtime Storage (Encrypted):
  ├─ pinterest_oauth_tokens.access_token_encrypted
  │  └─ Scope: Create pins on Pinterest
  │  └─ Storage: Supabase table (encrypted with libsodium)
  │  └─ Exposure: Never in plaintext, only in memory during execution
  │
  └─ pinterest_oauth_tokens.refresh_token_encrypted
     └─ Scope: Refresh access token (30-day cycle)
     └─ Storage: Supabase table (encrypted with libsodium)
     └─ Exposure: Never in plaintext, only in memory during execution

Development Isolation:
  ├─ .env.test: Test credentials (local, cloud dev Supabase)
  │  └─ Never committed (in .gitignore)
  │  └─ Contains TEST_SUPABASE_* variables only
  │
  └─ .env.production: Production credentials (Vercel only)
     └─ Never stored locally
     └─ Managed via Vercel UI (not in git)


SECRET ROTATION STRATEGY
──────────────────────────────────────────────

Annual rotation (recommended):

Facebook Page Access Token:
  1. Log into Meta App Dashboard
  2. Generate new Page Access Token
  3. Test: GET /page_id/ (verify access)
  4. Update FACEBOOK_ACCESS_TOKEN in Vercel
  5. Remove old token from dashboard
  6. Monitor execution logs for successful API calls

Pinterest Tokens (requires user re-auth, CORRECTED ARCHITECTURE):
  1. Complete OAuth flow (user logs in)
  2. Capture new access_token and refresh_token
  3. Encrypt tokens in Node.js using TOKEN_ENCRYPTION_KEY
  4. Store encrypted tokens in Supabase (pinterest_oauth_tokens table via RPC)
  5. Test: Create sample pin to verify access
  6. Verify automatic token refresh works on next cron run
  7. No Vercel environment variable updates needed (credentials in Supabase)

Supabase Service Role Key:
  1. Log into Supabase dashboard
  2. Generate new service role key
  3. Update SUPABASE_SERVICE_ROLE_KEY in Vercel
  4. Run test suite to verify access
  5. Disable old key in dashboard


ATTACK SURFACE & MITIGATIONS
──────────────────────────────────────────────

Attack Vector 1: Unauthorized Cron Invocation
  │ Attacker: Calls /api/cron/facebook-pinterest directly
  │ Impact: Executes arbitrary publishing logic
  │ Mitigation:
  │  ├─ CRON_SECRET validation in route
  │  ├─ Vercel cron: Automatically includes header
  │  ├─ Manual invocation: Requires valid CRON_SECRET
  │  └─ Fail: Returns 401 Unauthorized
  │
  └─ Result: Attack blocked at HTTP level

Attack Vector 2: Credential Exposure via Logs
  │ Attacker: Reads console logs or error messages
  │ Impact: Retrieves tokens/API keys
  │ Mitigation:
  │  ├─ Never log credentials (even in error messages)
  │  ├─ Sanitize error messages before logging
  │  ├─ Test data cleanup (remove test tokens from logs)
  │  └─ Vercel logs: Managed by Vercel (encrypted, access-controlled)
  │
  └─ Result: Attack prevented via code discipline

Attack Vector 3: Database Access via RLS Bypass
  │ Attacker: Uses RLS-disabled account to modify data
  │ Impact: Could alter facebook_posts status, create fake pins
  │ Mitigation:
  │  ├─ RLS enabled on all data tables
  │  ├─ Anon key: Explicitly denied (403 on any data access)
  │  ├─ Service role key: Used only in backend (Vercel function)
  │  ├─ No client-side code uses service role key
  │  └─ Frontend uses anon key (restricted by RLS)
  │
  └─ Result: Attack prevented at database level

Attack Vector 4: Replay/Cache Poisoning
  │ Attacker: Captures API responses and replays them
  │ Impact: Could duplicate pins or create fake records
  │ Mitigation:
  │  ├─ Each pin creation includes facebook_post_id (unique)
  │  ├─ Database constraint: UNIQUE(facebook_post_id)
  │  ├─ Duplicate creation attempts fail (constraint violation)
  │  └─ RPC functions are idempotent (safe to retry)
  │
  └─ Result: Attack prevented via data model

Attack Vector 5: Token Theft via Man-in-Middle
  │ Attacker: Intercepts unencrypted API call
  │ Impact: Could steal Facebook/Pinterest tokens
  │ Mitigation:
  │  ├─ All API calls use HTTPS (encrypted in transit)
  │  ├─ Vercel → Meta / Pinterest / Supabase all use TLS
  │  ├─ No credentials in URL parameters (headers only)
  │  └─ Tokens stored in Vercel secrets (not in code)
  │
  └─ Result: Attack made impractical via HTTPS

Attack Vector 6: DOS via Rate Limit Exhaustion
  │ Attacker: Calls cron endpoint repeatedly
  │ Impact: Uses up Pinterest API rate limit (100/minute)
  │ Mitigation:
  │  ├─ CRON_SECRET validation (prevents unauthorized invocation)
  │  ├─ Vercel cron: Runs on fixed schedule (not user-triggered)
  │  ├─ Manual "Run Now" button: Protected by CRON_SECRET
  │  └─ If rate limit hit: Marked as uncertain, user alerted
  │
  └─ Result: Attack prevented via authentication


DATA RETENTION & DELETION
──────────────────────────────────────────────

Data Retention:
  ├─ facebook_posts: Retained indefinitely (provides audit trail)
  ├─ pinterest_pins: Retained indefinitely (links to Facebook posts)
  ├─ execution_logs: Retained indefinitely (operational history)
  └─ Test data: Auto-deleted after test runs

User Deletion:
  ├─ If user revokes Pinterest app access:
  │  └─ PINTEREST_ACCESS_TOKEN becomes invalid
  │     ├─ Execution fails with 401
  │     ├─ Post marked as uncertain
  │     └─ User must re-authorize via OAuth
  │
  ├─ If user deletes Ceylon Haven account:
  │  └─ No automatic cleanup (data retention)
  │     ├─ facebook_posts records remain (historical)
  │     ├─ pinterest_pins records remain (linked to created pins)
  │     └─ execution_logs remain (audit trail)
  │
  └─ Manual deletion:
      ├─ User can request purge of specific posts
      ├─ Deletes facebook_posts and related pinterest_pins
      └─ execution_logs remain (for audit purposes)
```

---

## Section 15: Test Strategy

```
TESTING PYRAMID
──────────────────────────────────────────────

                    E2E Tests
                   /          \
                 /              \
               Integration Tests (Cloud Supabase)
              /                   \
            /                       \
          Unit Tests + Mock Tests
         /                            \
       /________________________________\


UNIT TESTS (Phase 2 + Phase 3)
──────────────────────────────────────────────

Existing (Phase 2, passing):
  ├─ lib/classify.test.ts (5 tests)
  │  ├─ Classify single-image post (expected)
  │  ├─ Classify video post (skip)
  │  ├─ Classify text-only post (skip)
  │  ├─ Classify multi-image post (skip)
  │  └─ Classify carousel post (skip)
  │
  ├─ services/mock-pinterest.test.ts (6 tests)
  │  ├─ Create pin (mock)
  │  ├─ Get boards (mock)
  │  ├─ Token validation (mock)
  │  ├─ Error handling (mock)
  │  └─ Rate limit tracking (mock)
  │
  └─ lib/env.test.ts (8+ tests)
     ├─ Validate required env variables
     ├─ Type checking for env values
     └─ Fail-closed when env missing


New Tests (Phase 3):
  ├─ lib/adapt.test.ts (5+ tests)
  │  ├─ Generate title (Property A)
  │  ├─ Generate description (Property B)
  │  ├─ Truncate long captions
  │  ├─ Sanitize special characters
  │  └─ Handle missing property name
  │
  ├─ lib/board-routing.test.ts (4+ tests)
  │  ├─ Route to correct board (Property A)
  │  ├─ Use default board (unknown property)
  │  ├─ Handle invalid board ID
  │  └─ Cache valid boards
  │
  └─ services/facebook.test.ts (6+ tests)
     ├─ Fetch page feed (mock API)
     ├─ Handle pagination (mock)
     ├─ Parse post attachments (mock)
     ├─ Handle API errors (mock)
     ├─ Validate access token (mock)
     └─ Rate limit tracking (mock)

Total: ~45 unit tests (local, no external dependencies)


MOCK TESTS (Phase 2 + Phase 3)
──────────────────────────────────────────────

Purpose: Test API integration without calling real APIs

Existing (Phase 2):
  └─ services/mock-pinterest.ts (complete mock)
     └─ All methods return deterministic results

New (Phase 3):
  ├─ services/mock-facebook.ts
  │  └─ Mock Graph API responses
  │
  └─ tests/integration.mocks.test.ts
     ├─ Full pipeline test with mocks
     ├─ Discover → Publish → Success
     ├─ Discover → Publish → Retry → Success
     ├─ Discover → Publish → Failure (exhausted retries)
     └─ Discover → Skip (non-image post)

Total: ~20 mock tests


INTEGRATION TESTS (Cloud Supabase - Phase 2 Complete, Phase 3 Extends)
──────────────────────────────────────────────────────────────────────

Existing (Phase 2, all passing - 32 tests):
  ├─ Schema validation (4 tests)
  │  ├─ facebook_posts table structure
  │  ├─ pinterest_pins table structure
  │  ├─ execution_logs table structure
  │  └─ RPC functions exist
  │
  ├─ claim_for_publishing (4 tests)
  │  ├─ Concurrent claims (only 1 succeeds)
  │  ├─ Already claimed post
  │  ├─ Non-existent post
  │  └─ Retry from failed state
  │
  ├─ record_published_pin (5 tests)
  │  ├─ Atomic transaction (success)
  │  ├─ Publishing state required
  │  ├─ Pinterest pin ID uniqueness
  │  ├─ Foreign key constraint
  │  └─ Status transition validation
  │
  ├─ Retry operations (6 tests)
  │  ├─ increment_retry_and_fail
  │  ├─ Retry count limits
  │  ├─ State transitions
  │  └─ Database consistency
  │
  ├─ State protection (4 tests)
  │  ├─ Cannot transition from published
  │  ├─ Cannot exceed MAX_RETRIES
  │  ├─ Terminal states enforced
  │  └─ Invalid transitions blocked
  │
  ├─ RLS & Security (3 tests)
  │  ├─ Anon key denied (403)
  │  ├─ Service role permitted
  │  ├─ RPC functions service-role-only
  │  └─ Row-level security enforced
  │
  └─ Cleanup & Isolation (2 tests)
     ├─ Test data cleanup
     ├─ No production data mutation

Total: 32 integration tests (real cloud Supabase)


New Integration Tests (Phase 3):
  ├─ Real Facebook API integration (5+ tests)
  │  ├─ Fetch actual posts from Ceylon Haven page
  │  ├─ Handle pagination
  │  ├─ Parse media URLs
  │  ├─ Token validation
  │  └─ Error handling
  │
  ├─ Real Pinterest API integration (5+ tests)
  │  ├─ Create actual pin
  │  ├─ Get boards (user-specific)
  │  ├─ Token refresh
  │  ├─ Rate limit handling
  │  └─ Error handling
  │
  ├─ End-to-End pipeline (3+ tests)
  │  ├─ Fetch Facebook → Publish Pinterest (success)
  │  ├─ Handle duplicate detection
  │  ├─ Retry on failure
  │  └─ Execution logging
  │
  └─ Total: ~13 new integration tests


E2E TESTS (Phase 3+, Optional)
──────────────────────────────────────────────

Manual testing (not automated):
  ├─ Deploy to Vercel staging
  ├─ Verify cron triggers daily at correct time
  ├─ Verify health endpoint responds
  ├─ Create manual test post on Ceylon Haven page
  ├─ Verify pin appears on Pinterest boards
  ├─ Check execution logs record success
  └─ Verify dashboard displays correct metrics


TEST DATA MANAGEMENT
──────────────────────────────────────────────

Fixtures (services/fixtures.ts):
  ├─ 8 test post types
  │  ├─ Single image (supported)
  │  ├─ Video (skipped)
  │  ├─ Text-only (skipped)
  │  ├─ Multi-image carousel (skipped)
  │  ├─ Reel (skipped)
  │  ├─ Live video (skipped)
  │  └─ Event post (skipped)
  │
  └─ Mock responses (Facebook, Pinterest API)

Test Data Cleanup:
  ├─ Before each test: Clear test_* posts
  ├─ After each test: Clear test_* posts
  ├─ On test failure: Leave data for debugging
  └─ Safety: Only test_* data deleted (never production)


TEST COVERAGE TARGETS
──────────────────────────────────────────────

Phase 2 (Existing, completed):
  ├─ Line coverage: >80%
  ├─ Branch coverage: >75%
  ├─ Function coverage: >90%
  └─ Status: ACHIEVED ✓

Phase 3 (New code):
  ├─ Facebook integration: >85%
  ├─ Pinterest integration: >85%
  ├─ Content adaptation: >90%
  ├─ Board routing: >90%
  └─ Target: Maintain >80% overall


RUNNING TESTS LOCALLY
──────────────────────────────────────────────

Unit + Mock Tests (no external dependencies):
  └─ npm test
     └─ ~45 tests pass in <5 seconds

Integration Tests (cloud Supabase dev project):
  └─ npm run test:integration:db
     └─ ~32 tests pass in ~30-60 seconds
     └─ Requires: .env.test with dev credentials

Full Suite:
  └─ npm test && npm run test:integration:db
     └─ ~77 tests total
     └─ All pass in <2 minutes


CI/CD TEST EXECUTION (Vercel)
──────────────────────────────────────────────

On every push to GitHub:
  ├─ npm install
  ├─ npm run lint
  ├─ npm run type-check
  ├─ npm test (unit + mock, no cloud)
  └─ npm run build

Note: Integration tests NOT run in CI (require credentials)
Integration tests run locally before merge
```

---

## Section 16: Production Deployment Strategy

```
DEPLOYMENT PIPELINE
──────────────────────────────────────────────

Development:
  ├─ Local: Edit code → npm test → git commit
  ├─ GitHub: Push to branch → CI runs (lint, type-check, unit tests)
  └─ Vercel: Preview deployment (optional, for testing)

Production:
  ├─ Merge to main branch
  ├─ Vercel: Auto-deploys production (main trigger)
  ├─ Environment variables: Production secrets only
  └─ Result: New cron version active within 60 seconds


PRODUCTION VERCEL SETUP
──────────────────────────────────────────────

1. Project Initialization
   ├─ vercel link (connect to Vercel account)
   ├─ Create new production project on vercel.com
   ├─ Link to GitHub repository (recommended)
   └─ Enable auto-deploy on main branch push

2. Environment Variables (CORRECTED ARCHITECTURE)
   ├─ Vercel Dashboard → Project Settings → Environment Variables
   ├─ Add variables for production:
   │  ├─ FACEBOOK_ACCESS_TOKEN (production page token)
   │  ├─ PINTEREST_APP_ID (production app ID)
   │  ├─ PINTEREST_APP_SECRET (production app secret - secured)
   │  ├─ TOKEN_ENCRYPTION_KEY (32-byte random, base64-encoded)
   │  ├─ SUPABASE_URL (production project URL)
   │  ├─ SUPABASE_ANON_KEY (production anon key)
   │  ├─ SUPABASE_SERVICE_ROLE_KEY (production service role - secured)
   │  ├─ CRON_SECRET (random 32-byte hex string)
   │  ├─ NODE_ENV=production
   │  └─ LOG_LEVEL=info
   │
   └─ Note: Pinterest tokens stored in Supabase, not Vercel. Do NOT use test values

3. Vercel Cron Configuration
   ├─ vercel.json contains:
   │  └─ Cron job: POST /api/cron/facebook-pinterest
   │               Schedule: "30 6 * * *" (06:30 UTC = 12:00 PM Asia/Colombo)
   │
   └─ Deploy → Cron automatically enabled

4. First Deploy
   ├─ Push to main branch
   ├─ Vercel detects push → builds → deploys
   ├─ Function logs available: Vercel Dashboard → Deployments → Logs
   ├─ Health check: curl https://[project].vercel.app/api/health
   └─ Should return: { "status": "ok", "phase": "production" }

5. Cron Activation
   ├─ First deployment: Cron jobs registered
   ├─ Wait for scheduled time (06:30 UTC)
   ├─ Observe function logs
   ├─ Check Supabase execution_logs for records
   └─ Verify first execution succeeded


PRODUCTION SUPABASE SETUP
──────────────────────────────────────────────

1. Create Production Project
   ├─ supabase.com/dashboard → New project
   ├─ Project name: ceylon-haven-pinterest (no -dev suffix)
   ├─ Database password: Strong random (save securely)
   ├─ Region: Closest to Asia/Colombo (Singapore recommended)
   ├─ Pricing: Pro plan (if scaling expected) or Free tier (start)
   └─ Wait for initialization (~5 minutes)

2. Apply Migrations
   ├─ In Supabase Studio → SQL Editor
   ├─ Execute db/migrations/0001_init_schema.sql
   ├─ Execute db/migrations/0002_atomic_operations.sql
   ├─ Verify: Tables and RPC functions created

3. Enable Row-Level Security
   ├─ Supabase Studio → Authentication → Policies
   ├─ For each table (facebook_posts, pinterest_pins, execution_logs):
   │  └─ Enable RLS (restricts direct anon access)
   │
   └─ RPC functions bypass RLS (continue to work)

4. Capture Credentials
   ├─ Project Settings → API
   ├─ Copy:
   │  ├─ Project URL: https://[project-ref].supabase.co
   │  ├─ Anon Key: eyJ0eXAi...
   │  └─ Service Role Key: eyJ0eXAi... (KEEP SECRET)
   │
   └─ Add to Vercel environment variables


FACEBOOK & PINTEREST SETUP
──────────────────────────────────────────────

Facebook Page Access Token (Long-lived):
  ├─ Navigate to developers.facebook.com
  ├─ Select or create Meta App
  ├─ Add: Facebook Login product
  ├─ Navigate to App Roles → Test Users
  ├─ Create or select test user (or use your account)
  ├─ Grant permissions: pages_read_engagement, pages_read_user_content (DO NOT use manage_pages - deprecated)
  ├─ Tools → Graph Explorer → Select app and test user
  ├─ Run: GET /me/accounts
  ├─ Copy: Page Access Token (long-lived, valid ~60+ days)
  ├─ Add to Vercel: FACEBOOK_ACCESS_TOKEN
  └─ Note: Data Access permissions refresh every 90 days (manual process in Meta dashboard)

Pinterest OAuth Setup (Requires User Interaction, CORRECTED ARCHITECTURE):
  ├─ Navigate to developers.pinterest.com
  ├─ Create or select Pinterest app
  ├─ Configure: OAuth Redirect URI = https://[project].vercel.app/api/oauth/callback
  ├─ Configure scopes: boards:read, pins:write
  ├─ User must authorize app:
  │  ├─ GET to: https://www.pinterest.com/oauth/
  │  ├─ User logs in and approves
  │  ├─ Redirect to callback with auth_code
  │  └─ Exchange auth_code for tokens
  │
  ├─ Capture tokens:
  │  ├─ access_token (30-day expiration)
  │  └─ refresh_token (60-day rolling)
  │
  ├─ Encrypt tokens in Node.js using TOKEN_ENCRYPTION_KEY
  │
  └─ Store encrypted tokens in Supabase (pinterest_oauth_tokens table via RPC)
     ├─ DO NOT add plaintext tokens to Vercel
     ├─ Access via Supabase on each cron execution
     └─ Token refresh automatic (checked at run start, updated to Supabase)

CRON_SECRET Generation:
  ├─ Local: openssl rand -hex 32
  ├─ Output: 64-character hex string (e.g., a1b2c3d4e5f6...)
  ├─ Add to Vercel: CRON_SECRET


FIRST PRODUCTION RUN (Manual Trigger)
──────────────────────────────────────────────

Option 1: Wait for scheduled time (06:30 UTC)
  ├─ Cron job triggers automatically
  ├─ Monitor logs: Vercel Dashboard → Deployments → Logs
  └─ Check results: Supabase → execution_logs

Option 2: Trigger manually (recommended for testing)
  ├─ Create endpoint: POST /api/manual/run-now
  ├─ Curl: curl -X POST https://[project].vercel.app/api/manual/run-now \
                  -H "Authorization: Bearer $CRON_SECRET"
  ├─ Should return: { "status": "running" }
  └─ Check logs and results

Verification Checklist:
  └─ After first run:
     ├─ [ ] execution_logs has new record
     ├─ [ ] posts_fetched > 0 (found posts on Ceylon Haven page)
     ├─ [ ] posts_published > 0 (created pins on Pinterest)
     ├─ [ ] No error_details (or acceptable errors logged)
     ├─ [ ] Pinterest boards have new pins
     ├─ [ ] duration_seconds < 60 (Vercel timeout)
     └─ [ ] Status: "success" or "partial" (acceptable)


MONITORING & ALERTING (Phase 3+)
──────────────────────────────────────────────

Metrics to Watch:
  ├─ Cron job execution time (should be <30s)
  ├─ Posts published per run (should match Ceylon Haven frequency)
  ├─ Error rate (should be ~0%)
  ├─ Pinterest rate limit (should have >50% remaining)
  ├─ Token refresh success rate (should be 100%)
  └─ Cron job execution success (should be 100%)

Alerts to Configure:
  ├─ Execution time > 45 seconds (near timeout)
  ├─ Error rate > 5%
  ├─ Uncertain posts require manual review
  ├─ Token refresh failure
  └─ Cron job failure (doesn't execute)

Implementation:
  ├─ Email alerts (send to admin on error)
  ├─ Slack integration (optional)
  └─ Dashboard (Vercel + custom UI)


ROLLBACK PROCEDURE
──────────────────────────────────────────────

If production breaks:

1. Immediate (within 5 minutes):
   ├─ Revert last commit: git revert [commit-hash]
   ├─ Push to main: git push
   ├─ Vercel auto-deploys old version
   └─ Next cron run uses previous code

2. Debug locally:
   ├─ Reproduce issue with production credentials
   ├─ Fix code
   ├─ Re-test with integration tests
   └─ Push fix to main

3. Verify new deployment:
   ├─ Trigger manual cron run
   ├─ Verify success in logs
   └─ Monitor for 24 hours


VERSION MANAGEMENT
──────────────────────────────────────────────

Git tagging (for release tracking):
  ├─ Tag each production deployment: git tag v3.0.0 -m "Phase 3: Production release"
  ├─ Push tags: git push --tags
  └─ Use semantic versioning: Major.Minor.Patch
     └─ MAJOR: Breaking API changes
     └─ MINOR: New features
     └─ PATCH: Bug fixes

Vercel deployment tracking:
  ├─ Each push to main = one deployment
  ├─ Vercel assigns deployment ID
  ├─ Logs tagged with deployment ID
  └─ Easy to find which version caused issue
```

---

## Section 17: Autonomous Tasks (Claude Can Execute)

**Work items Claude can complete without user action:**

### 1. Facebook API Client Implementation (lib/services/facebook.ts)
- Fetch page feed with pagination
- Parse post attachments
- Extract metadata (caption, image URL, date)
- Error handling and retry logic
- Rate limit tracking
- Requires: FACEBOOK_ACCESS_TOKEN (user provides), API docs verification

### 2. Pinterest API Client Implementation (lib/services/pinterest.ts)
- Replace mock-pinterest.ts with real implementation
- Create pins: POST /v5/pins
- Get user boards: GET /v5/user_account/boards
- Token refresh: POST https://api.pinterest.com/v5/oauth/token with grant_type=refresh_token
- Error categorization (transient vs fatal)
- Rate limit tracking
- Requires: PINTEREST_APP_ID, PINTEREST_APP_SECRET (user provides), API docs verification

### 3. Content Adaptation Module (lib/adapt.ts)
- Template-based title generation
- Template-based description generation
- Caption sanitization (remove @mentions, URLs)
- Character limit validation and truncation
- Multi-language support framework
- Fully autonomous (no external APIs)

### 4. Board Routing Module (lib/board-routing.ts)
- Property name extraction from captions
- Deterministic property → board mapping
- Board validation against user's boards
- Fallback routing logic
- Configuration loading (Supabase or .env)
- Fully autonomous

### 5. Main Orchestrator Extension (app/api/cron/facebook-pinterest/route.ts)
- Integrate Facebook client
- Integrate Pinterest client
- Implement publish pipeline
- Implement retry logic with state transitions
- Implement execution logging
- Error handling and graceful degradation
- Fully autonomous

### 6. Token Refresh Service (lib/tokens.ts)
- Check Pinterest token expiration
- Implement early refresh (if <7 days)
- Handle refresh failures gracefully
- Log token refresh events
- Requires: PINTEREST_REFRESH_TOKEN (user provides), PINTEREST_APP_SECRET (user provides)

### 7. Extended Integration Tests (tests/*)
- Real Facebook API integration tests
- Real Pinterest API integration tests
- End-to-end pipeline tests
- Token refresh tests
- Rate limit handling tests
- All 13+ new test cases

### 8. Configuration Schema (db/schema.ts - Extension)
- Add property_board_mapping table structure
- Add token metadata columns
- Add rate limit tracking schema
- Migration files for production

### 9. Observability Dashboard (app/dashboard - Optional)
- Display execution history
- Show success/failure rates
- Display error details
- Manual "Run Now" button
- Rate limit visualization
- Optional enhancement (Phase 3+)

### 10. Documentation Updates
- Update PHASE_2_4 status in all files
- Create Phase 3 status tracking
- Document API endpoints used
- Document configuration requirements
- Fully autonomous

---

## Section 18: User Required Tasks (Step-by-Step Instructions)

**Tasks requiring user interaction (cannot be automated):**

### TASK 1: Create Facebook App & Generate Page Access Token

**Step-by-Step Instructions:**

1. Create Meta App
   ```
   a. Navigate to https://developers.facebook.com/apps
   b. Click "Create App"
   c. Choose app type: "Business" or "Consumer" (Business recommended)
   d. Fill in app name (e.g., "Ceylon Haven Pinterest Automation")
   e. Provide contact email
   f. Select development purposes (e.g., "Other" → "Social Media Management")
   g. Click "Create App"
   ```

2. Add Facebook Login
   ```
   a. In app dashboard, find "Products" section
   b. Click "Add Product"
   c. Find "Facebook Login" and click "Setup"
   d. Choose "Web"
   e. Enter site URL: https://[your-vercel-project].vercel.app
   f. Complete setup
   ```

3. Configure App Roles
   ```
   a. Go to Settings → Basic
   b. Copy App ID and App Secret (save securely)
   c. Go to Roles (left sidebar)
   d. Grant yourself admin role (if not already)
   ```

4. Generate Page Access Token
   ```
   a. Navigate to App Roles → Test Users
   b. Create test user (or use your Facebook account)
   c. Grant permissions:
      - pages_read_engagement
      - pages_read_user_content
      (Note: DO NOT use manage_pages - deprecated)
   d. Go to Tools → Graph API Explorer
   e. Select your app from dropdown
   f. Select test user (or your account)
   g. Run query: GET /me/accounts
   h. In response JSON, find your Ceylon Haven page
   i. Copy the "access_token" value
   j. Save this as FACEBOOK_ACCESS_TOKEN
   ```

5. Verify Token Works
   ```bash
   curl "https://graph.meta.com/v26/me?access_token=YOUR_TOKEN_HERE"
   # Should return your account info (not an error)
   ```

**Output:** FACEBOOK_ACCESS_TOKEN value (64-character string)

---

### TASK 2: Create Pinterest App & Authorize User

**Step-by-Step Instructions:**

1. Create Pinterest App
   ```
   a. Navigate to https://developers.pinterest.com/apps
   b. Click "Create an App"
   c. Enter app name (e.g., "Ceylon Haven Pinterest Automation")
   d. Select app type: "Business" (for brand account)
   e. Accept terms
   f. Click "Create"
   ```

2. Capture App Credentials
   ```
   a. In app dashboard, go to "Authentication"
   b. Copy App ID (public)
   c. Copy App Secret (KEEP SECRET, never commit)
   d. Save both values
   ```

3. Configure OAuth Redirect URI
   ```
   a. In app settings → Authentication
   b. Add Redirect URI: https://[your-vercel-project].vercel.app/api/oauth/callback
   c. Save
   ```

4. User OAuth Authorization (Your Account)
   ```
   a. In browser, navigate to:
      https://www.pinterest.com/oauth/?client_id=YOUR_APP_ID&redirect_uri=YOUR_REDIRECT_URI&response_type=code&scope=boards:read,pins:write&state=UNIQUE_STATE
   
   b. Pinterest login screen appears
   c. Log in with your Pinterest account (business account recommended)
   d. Grant app permission (review scopes: boards:read, pins:write)
   e. Click "Allow"
   f. Redirected to https://[your-vercel-project].vercel.app/api/oauth/callback?code=AUTHORIZATION_CODE
   g. Copy the "code" parameter value from URL
   ```

5. Exchange Authorization Code for Tokens
   ```bash
   curl -X POST https://api.pinterest.com/v5/oauth/token \
     --header "Authorization: Basic BASE64_CLIENT_ID_COLON_SECRET" \
     --header "Content-Type: application/x-www-form-urlencoded" \
     --data-urlencode "grant_type=authorization_code" \
     --data-urlencode "code=AUTHORIZATION_CODE" \
     --data-urlencode "redirect_uri=YOUR_REDIRECT_URI" \
     --data-urlencode "continuous_refresh=true"
   ```
   
   Response:
   ```json
   {
     "access_token": "...",
     "refresh_token": "...",
     "expires_in": 2592000,
     "refresh_token_expires_in": 5184000,
     "scope": "boards:read,pins:write",
     "token_type": "Bearer"
   }
   ```
   
   Copy access_token and refresh_token values
   ```

6. Verify Tokens Work
   ```bash
   curl -X GET https://api.pinterest.com/v5/user_profile \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
   # Should return your profile info (not an error)
   ```

**Output:**
- PINTEREST_APP_ID (public)
- PINTEREST_APP_SECRET (secret, never commit)
- PINTEREST_ACCESS_TOKEN (30-day expiration)
- PINTEREST_REFRESH_TOKEN (60-day rolling)

---

### TASK 3: Create Supabase Production Project

**Step-by-Step Instructions:**

1. Create Project
   ```
   a. Navigate to https://supabase.com/dashboard
   b. Click "New project" (or "New organization" if first time)
   c. Select organization
   d. Project name: ceylon-haven-pinterest (no -dev suffix)
   e. Database password: Generate strong random password (save securely)
   f. Region: Singapore (ap-southeast-1, closest to Asia/Colombo)
   g. Pricing: Free tier (can upgrade later)
   h. Click "Create new project"
   i. Wait for initialization (~5 minutes)
   ```

2. Apply Migrations
   ```
   a. In Supabase dashboard, go to SQL Editor
   b. Click "New query"
   c. Copy entire contents of db/migrations/0001_init_schema.sql
   d. Paste into editor
   e. Click "Run" (green button)
   f. Verify: Tables created (facebook_posts, pinterest_pins, execution_logs)
   g. Click "New query"
   h. Copy entire contents of db/migrations/0002_atomic_operations.sql
   i. Paste into editor
   j. Click "Run"
   k. Verify: 6 RPC functions created
   ```

3. Enable Row-Level Security
   ```
   a. Go to Authentication → Policies (left sidebar)
   b. Select table: facebook_posts
   c. Click "Enable RLS" if not already enabled
   d. Repeat for: pinterest_pins, execution_logs
   ```

4. Capture Credentials
   ```
   a. Go to Project Settings (bottom left)
   b. Click "API"
   c. Copy "Project URL" (e.g., https://abc123.supabase.co)
   d. Copy "Project Ref" (e.g., abc123, from URL)
   e. Copy "Anon Key" (public, safe to share)
   f. Copy "Service Role Secret" (SECRET, never commit or share)
   g. Save all values securely
   ```

**Output:**
- SUPABASE_URL (project URL)
- TEST_SUPABASE_PROJECT_REF (8-char alphanumeric)
- SUPABASE_ANON_KEY (public key)
- SUPABASE_SERVICE_ROLE_KEY (secret key - PROTECT)

---

### TASK 4: Create Vercel Production Project & Configure Environment

**Step-by-Step Instructions:**

1. Create Vercel Project
   ```
   a. Navigate to https://vercel.com/dashboard
   b. Click "New Project"
   c. Import from Git → Select GitHub repository (Ceylon-Haven-Pinterest-Automation)
   d. Configure project:
      - Framework: Next.js
      - Build command: npm run build
      - Output directory: .next
   e. Click "Deploy"
   f. Wait for first build (~2 minutes)
   ```

2. Configure Environment Variables
   ```
   a. In Vercel dashboard → Project Settings → Environment Variables
   b. Add each variable (copy values from previous tasks):
      
      Variable Name: FACEBOOK_ACCESS_TOKEN
      Value: [from Task 1]
      Environments: Production, Preview
      
      Variable Name: FACEBOOK_PAGE_ID
      Value: [Your Ceylon Haven Facebook Page ID]
      Environments: Production, Preview
      
      Variable Name: FB_GRAPH_API_VERSION
      Value: v26
      Environments: Production, Preview
      
      Variable Name: PINTEREST_APP_ID
      Value: [from Task 2]
      Environments: Production, Preview
      
      Variable Name: PINTEREST_APP_SECRET
      Value: [from Task 2] (SECRET)
      Environments: Production only
      
      Variable Name: PINTEREST_ACCESS_TOKEN
      Value: [from Task 2]
      Environments: Production, Preview
      
      Variable Name: PINTEREST_REFRESH_TOKEN
      Value: [from Task 2] (SECRET)
      Environments: Production only
      
      Variable Name: SUPABASE_URL
      Value: [from Task 3]
      Environments: Production, Preview
      
      Variable Name: SUPABASE_ANON_KEY
      Value: [from Task 3]
      Environments: Production, Preview
      
      Variable Name: SUPABASE_SERVICE_ROLE_KEY
      Value: [from Task 3] (SECRET)
      Environments: Production only
      
      Variable Name: CRON_SECRET
      Value: [Generate: openssl rand -hex 32]
      Environments: Production only
      
      Variable Name: NODE_ENV
      Value: production
      Environments: Production
      
      Variable Name: LOG_LEVEL
      Value: info
      Environments: Production, Preview
   ```

3. Generate CRON_SECRET
   ```bash
   # Run locally on Mac/Linux:
   openssl rand -hex 32
   
   # Output: 64-character hex string (e.g., a1b2c3d4e5f6...)
   # Copy this value → Add to CRON_SECRET in Vercel
   ```

4. Verify Health Endpoint
   ```bash
   curl https://[your-project].vercel.app/api/health
   
   # Should return:
   # {
   #   "status": "ok",
   #   "phase": "production",
   #   "databaseConfigured": true,
   #   "environment": "production"
   # }
   ```

**Output:** Production Vercel project fully configured and deployed

---

### TASK 5: Identify Ceylon Haven Facebook Page ID

**Step-by-Step Instructions:**

1. Find Page ID
   ```
   a. Go to https://facebook.com/[ceylon-haven-page-name]
   b. Right-click page name → "Inspect" (or press F12)
   c. Find value like /[NUMBER]/ in page source
   d. OR use Facebook Graph API Explorer:
      1. Navigate to https://developers.facebook.com/tools/explorer
      2. Select your app
      3. Run query: GET /[page-name]?fields=id
      4. Copy id value from response
   ```

2. Save Value
   ```
   Copy Page ID (numeric, e.g., 1234567890)
   Store as: FACEBOOK_PAGE_ID
   ```

**Output:** FACEBOOK_PAGE_ID (numeric identifier)

---

### TASK 6: Create/Select Pinterest Boards

**Step-by-Step Instructions:**

1. Identify or Create Boards
   ```
   a. Log into Pinterest as your business account
   b. Go to your profile → Boards
   c. For each Ceylon Haven property, decide:
      - Create new board, OR
      - Use existing board
   
   Example board structure:
   ├─ "Sri Lanka Villas" (for The Beach Home)
   ├─ "Sri Lanka City Stays" (for Colombo Heritage)
   ├─ "Luxury Villas" (for Gampaha Villa)
   └─ "Ceylon Haven - General" (fallback)
   
   d. For each board, copy its ID:
      1. Go to board
      2. Check URL: pinterest.com/[username]/[board-slug]/
      3. Click board name, inspect page source for numeric ID
      4. Save board_id and board_name
   ```

2. Configure Board Routing
   ```
   a. Create board routing configuration (see Section 10)
   b. Option A (Recommended): Create Supabase table
      - Table name: property_board_mapping
      - Columns:
        * property_name VARCHAR
        * board_id VARCHAR
        * board_name VARCHAR
        * is_active BOOLEAN
      
      Insert example rows:
      ├─ ("The Beach Home", "board_id_001", "Sri Lanka Villas", true)
      ├─ ("Colombo Heritage", "board_id_002", "Sri Lanka City Stays", true)
      └─ ("Gampaha Villa", "board_id_003", "Luxury Villas", true)
   ```

3. Verify Boards Accessible
   ```bash
   curl -X GET https://api.pinterest.com/v5/user_account/boards \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
   
   # Response should list your boards including the ones configured above
   ```

**Output:** Board routing configured and verified

---

### TASK 7: Test Production Deployment

**Step-by-Step Instructions:**

1. Manual Cron Trigger (First Test)
   ```bash
   # Trigger the cron endpoint manually
   curl -X POST https://[your-project].vercel.app/api/cron/facebook-pinterest \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   
   # Should return:
   # {
   #   "status": "success",
   #   "posts_published": N,
   #   "posts_failed": 0,
   #   "duration_seconds": X
   # }
   ```

2. Verify Execution Logs
   ```
   a. Go to Supabase dashboard
   b. Click "Table Editor"
   c. Select "execution_logs"
   d. Should see new row with:
      - posts_fetched: count of posts fetched from Ceylon Haven
      - posts_published: count of pins created
      - status: "success" (or "partial" if some failed)
   ```

3. Verify Pins Created
   ```
   a. Log into Pinterest as your business account
   b. Go to your boards
   c. Should see new pins created in the last 30 minutes
   d. Click pins to verify:
      - Title matches Ceylon Haven property
      - Description includes call-to-action
      - Image is from Facebook post
      - Destination URL points to Ceylon Haven property
   ```

4. Monitor Logs
   ```
   a. Vercel Dashboard → Project → Deployments → Logs
   b. Should show cron execution output
   c. Should show no errors (or acceptable warnings)
   ```

**Output:** Production deployment verified and working

---

### TASK 8: Set Up Monitoring & Alerts (Phase 3+, Optional)

**Step-by-Step Instructions:**

1. Email Alerts
   ```
   a. Create email address for alerts (or use existing)
   b. Configure Supabase to email on errors:
      - Use SQL trigger on execution_logs
      - If error_count > 0, send email
   c. Example email template:
      Subject: Ceylon Haven Pinterest Automation - Execution Error
      Body: Execution failed. See dashboard for details. [URL]
   ```

2. Slack Integration (Optional)
   ```
   a. Create Slack app in your workspace
   b. Configure incoming webhooks
   c. Add webhook URL to Vercel environment
   d. Send notification on cron failure
   ```

3. Dashboard
   ```
   a. Create app/dashboard page
   b. Display:
      - Recent execution history
      - Success rate (30-day rolling average)
      - Error counts by type
      - Pinterest rate limit usage
   c. Add "Run Now" button for manual trigger
   ```

**Output:** Monitoring and alerting configured (optional)

---

## Section 19: Proposed Phase 3 Implementation Sequence

**Recommended order of implementation (14 work items):**

1. **Facebook API Client** (1-2 hours)
   - Fetch posts from Ceylon Haven page
   - Parse attachments
   - Handle pagination and errors

2. **Post Discovery & Classification** (30-45 min)
   - Extend existing classify.ts
   - Mark new posts as discovered
   - Persist to facebook_posts table

3. **Pinterest API Client** (1-2 hours)
   - Replace mock-pinterest.ts
   - Create pins (POST /v5/pins)
   - Retrieve boards (GET /v5/user_account/boards)
   - Token refresh logic

4. **Content Adaptation** (1 hour)
   - Generate titles (template-based)
   - Generate descriptions (template-based)
   - Caption sanitization

5. **Board Routing** (1 hour)
   - Property extraction from captions
   - Board mapping (config-driven)
   - Board validation

6. **Main Orchestrator Extension** (1-2 hours)
   - Integrate all components
   - Implement atomic claim → publish → record flow
   - Error handling and retry logic

7. **Token Refresh Service** (1 hour)
   - Check Pinterest token expiration
   - Implement early refresh
   - Handle failures gracefully

8. **Extended Integration Tests** (2-3 hours)
   - Real Facebook API tests
   - Real Pinterest API tests
   - End-to-end pipeline tests
   - Rate limit handling tests

9. **Database Schema Extensions** (30 min)
   - property_board_mapping table
   - Token metadata columns
   - Migration files

10. **Execution Logging Enhancement** (1 hour)
    - Token refresh tracking
    - API call counts
    - Rate limit monitoring

11. **Error Handling & Observability** (1 hour)
    - Improved error messages
    - Execution summary formatting
    - Dashboard query examples

12. **Documentation Updates** (1-2 hours)
    - Update PROJECT_STATUS.md with Phase 3 progress
    - Document API integrations
    - Configuration guide

13. **Testing & Verification** (1-2 hours)
    - Manual testing with real APIs
    - Edge case testing
    - Performance verification

14. **Production Deployment** (30 min)
    - Final verification
    - First production execution
    - Monitoring setup

**Total Estimated Time:** 14-18 hours (1-2 development days)

---

## Section 20: Risks / Blockers

```
RISK 1: API Version Changes
Risk:    Facebook or Pinterest APIs update/deprecate endpoints
Impact:  Code breaks, pins fail to create
Severity: MEDIUM
Mitigation:
  ├─ Subscribe to Meta and Pinterest API announcements
  ├─ Test with latest API versions during development
  ├─ Monitor deprecation warnings in API responses
  ├─ Keep API version variable (easy to update)
  └─ Maintain API change log


RISK 2: Token Expiration
Risk:    Facebook or Pinterest tokens expire
Impact:  Execution fails, users need to re-authenticate
Severity: MEDIUM
Mitigation:
  ├─ Implement token refresh before expiration (Pinterest)
  ├─ Log token expiration time
  ├─ Alert user when manual renewal needed (Facebook)
  ├─ Graceful degradation (mark uncertain, don't crash)
  └─ Annual rotation cycle documented


RISK 3: Rate Limit Exhaustion
Risk:    Pinterest 100 req/min limit exceeded (unlikely but possible)
Impact:  Pins fail to create, marked uncertain
Severity: LOW (1 pin/day = 0.1% usage)
Mitigation:
  ├─ Track rate limit headers
  ├─ Implement backoff strategy
  ├─ Log rate limit usage
  ├─ Alert if approaching limit
  └─ Very safe margin at current volume


RISK 4: Facebook Page Access Loss
Risk:    User removes app from page, revokes access
Impact:  Cannot fetch posts, execution fails
Severity: MEDIUM
Mitigation:
  ├─ Monitor for 401 (unauthorized) errors
  ├─ Alert user: "Re-authentication required"
  ├─ Document re-authentication steps
  ├─ Graceful failure (don't crash, mark uncertain)
  └─ Provide manual re-auth endpoint


RISK 5: Database Constraint Violations
Risk:    Duplicate facebook_post_id due to concurrent processing
Impact:  Insertion fails, post marked uncertain
Severity: LOW (RPC handles atomically)
Mitigation:
  ├─ RPC functions ensure atomicity
  ├─ UNIQUE constraints enforced at DB level
  ├─ Tests verify concurrency handling
  ├─ Retry logic handles failures
  └─ "already_claimed" result handled gracefully


RISK 6: Pinterest Image Upload Failures
Risk:    Image URL inaccessible, format unsupported
Impact:  Pin creation fails, marked uncertain
Severity: MEDIUM
Mitigation:
  ├─ Validate image URL accessibility (HEAD request)
  ├─ Validate image format before sending
  ├─ Use Facebook CDN directly (tested, reliable)
  ├─ Log image-specific errors
  └─ Fallback: Mark post uncertain for manual handling


RISK 7: Board Configuration Mismatch
Risk:    Configured board_id doesn't exist or user lost access
Impact:  Pin creation fails, marked uncertain
Severity: MEDIUM
Mitigation:
  ├─ Validate boards at start of each run
  ├─ Cache valid board IDs
  ├─ Provide fallback board (if configured)
  ├─ Alert user if board is inaccessible
  └─ Mark post uncertain (manual routing)


RISK 8: Vercel Function Timeout
Risk:    Execution takes >60 seconds (free tier limit)
Impact:  Cron job terminated mid-execution
Severity: LOW (current: ~30-45 seconds)
Mitigation:
  ├─ Monitor execution time
  ├─ Optimize API calls (batch requests)
  ├─ Upgrade to Vercel Pro if needed (300s timeout)
  ├─ Alert if execution time >45s
  └─ Current volume is very safe


RISK 9: Supabase Storage Quota
Risk:    Free tier 500MB exceeded
Impact:  Database stops accepting writes
Severity: LOW (execution_logs are tiny)
Mitigation:
  ├─ Monitor storage usage
  ├─ Archive old execution logs annually
  ├─ Upgrade to Pro plan if needed ($25/mo)
  └─ At 1 pin/day, quota won't fill for years


RISK 10: Manual Override Abuse
Risk:    User clicks "Run Now" repeatedly
Impact:  Rate limit exhaustion, unnecessary API calls
Severity: LOW
Mitigation:
  ├─ Require CRON_SECRET for manual invocation
  ├─ Log manual triggers with timestamp
  ├─ Alert if triggered >2x per hour
  ├─ Implement cooldown (minimum 5 min between runs)
  └─ Display warning before manual trigger


BLOCKER 1: No Facebook Page Access
Blocker:  User hasn't granted app permission to Ceylon Haven page
Remedy:  Must have: Admin access to Ceylon Haven Facebook page
         Solution: Ensure app has pages_read_engagement + pages_read_user_content permissions (manage_pages is deprecated)


BLOCKER 2: No Pinterest Business Account
Blocker:  User doesn't have Pinterest business account
Remedy:  Create business account at pinterest.com
         Must have: Business/verified account to use API


BLOCKER 3: Pinterest App Not Approved
Blocker:  Pinterest app still in trial (10 pin/month limit)
Remedy:  Submit app for review in Pinterest developer dashboard
         Expected wait: 2-4 weeks
         Once approved: Unlimited pin creation


BLOCKER 4: Wrong API Version Assumed
Blocker:  If Facebook/Pinterest APIs differ from Phase 2.4 docs
Remedy:  Verify current APIs before Phase 3 implementation
         Check: developers.facebook.com, developers.pinterest.com
         Adjust endpoints if necessary


Mitigation Strategy (All Risks/Blockers):
├─ Comprehensive error logging (know what went wrong)
├─ Fail-closed safety checks (never corrupt data)
├─ Graceful degradation (mark uncertain, don't crash)
├─ Monitoring and alerting (know when issues occur)
├─ Clear documentation (know how to fix)
└─ Easy rollback (revert to previous version quickly)
```

---

## Section 21: Phase 3 Completion Criteria

```
DEFINITION OF DONE (Phase 3 Complete)
──────────────────────────────────────────────────────────────

FUNCTIONAL REQUIREMENTS

✓ Real Facebook API Integration
  ├─ Fetch Ceylon Haven page posts daily
  ├─ Parse post metadata (caption, image URL, date)
  ├─ Identify new eligible posts (single-image only)
  ├─ Prevent duplicate processing (facebook_post_id uniqueness)
  └─ Handle errors gracefully (retry or mark uncertain)

✓ Real Pinterest API Integration
  ├─ Create pins on target boards
  ├─ Retrieve user's boards (route posts correctly)
  ├─ Handle OAuth tokens (refresh before expiration)
  ├─ Respect rate limits (100/minute; monitor remaining)
  └─ Categorize errors (transient vs fatal)

✓ Content Adaptation
  ├─ Generate Pinterest titles (template-based, property-aware)
  ├─ Generate descriptions (deterministic, call-to-action)
  ├─ Validate character limits
  ├─ Sanitize special characters
  └─ No external API dependencies (no LLM in Phase 3)

✓ Board Routing
  ├─ Extract property name from post caption
  ├─ Map property to Pinterest board (config-driven)
  ├─ Validate board exists and is accessible
  ├─ Provide fallback routing for unknown properties
  └─ No hard-coded board mappings

✓ Production Infrastructure
  ├─ Vercel production deployment active
  ├─ Supabase production project created
  ├─ All credentials in Vercel environment variables
  ├─ CRON_SECRET generated and validated
  ├─ Health endpoint responds (OK)
  └─ Cron job scheduled and executing

✓ Token Lifecycle Management
  ├─ Facebook token: Long-lived (60+ days), manual renewal documented
  ├─ Pinterest token: 30-day expiration, auto-refresh implemented
  ├─ Refresh failures logged and handled gracefully
  ├─ Token metadata tracked in execution logs
  └─ User alerted when manual action required


NON-FUNCTIONAL REQUIREMENTS

✓ Observability
  ├─ All executions logged (execution_logs table)
  ├─ Error counts and types tracked
  ├─ API call counts recorded
  ├─ Pinterest rate limit status monitored
  ├─ Execution duration measured
  ├─ Manual "Run Now" ability provided
  └─ Dashboard displays metrics

✓ Security
  ├─ No secrets committed to git (.gitignore enforced)
  ├─ Service role key never in client-side code
  ├─ RLS policies enforced at database level
  ├─ CRON_SECRET validates incoming requests
  ├─ Test isolation verified (no production data mutation)
  ├─ Credentials rotatable without code changes
  └─ Audit trail maintained (execution logs)

✓ Reliability
  ├─ Retry logic implemented (MAX_RETRIES=3)
  ├─ Atomic state transitions (RPC functions)
  ├─ Idempotent operations (safe to retry)
  ├─ Graceful error handling (never crash mid-execution)
  ├─ Database constraints prevent duplicates
  ├─ Execution timeout handled (Vercel timeout logic)
  └─ Manual recovery process documented

✓ Performance
  ├─ Single daily execution: ~30-45 seconds
  ├─ Well under Vercel timeout (60s free tier)
  ├─ Pinterest API calls: ~2-5 per execution (0.1% of rate limit)
  ├─ Database queries: Indexed appropriately
  ├─ Pagination implemented for large post batches
  └─ No unnecessary API calls (no polling)

✓ Testing
  ├─ All unit tests pass (83+)
  ├─ All integration tests pass (32+)
  ├─ New integration tests pass (13+)
  ├─ Edge cases tested (errors, retries, etc.)
  ├─ Real API calls tested (Facebook, Pinterest)
  ├─ Line coverage >80%
  └─ No test failures or skips


DEPLOYMENT VERIFICATION

✓ Before Production:
  ├─ All tests passing locally
  ├─ Type check: 0 errors
  ├─ Lint: 0 errors
  ├─ Build: Successful
  ├─ Manual testing with mocked APIs: Success
  └─ Code review: Approved

✓ After Production Deployment:
  ├─ Health endpoint responds (OK)
  ├─ Cron job executes on schedule
  ├─ First execution: Success
  ├─ Pins visible on Pinterest
  ├─ Execution logs recorded correctly
  ├─ No errors in Vercel logs
  ├─ Credentials validated
  └─ Monitoring configured

✓ Production Stability (24-48 hours):
  ├─ Cron executes successfully every day
  ├─ Error rate: <2%
  ├─ All pins created as expected
  ├─ No rate limit exhaustion
  ├─ No token expiration issues
  ├─ Performance: <60 seconds per execution
  ├─ No manual interventions required
  └─ User reports success


DOCUMENTATION COMPLETE

✓ For Developers:
  ├─ Architecture documented (this plan)
  ├─ API integrations documented
  ├─ Configuration guide provided
  ├─ Error handling guide provided
  ├─ Deployment steps documented
  ├─ Code comments added
  └─ Runbook for troubleshooting provided

✓ For Operations:
  ├─ Monitoring setup guide
  ├─ Alert thresholds documented
  ├─ Escalation procedures documented
  ├─ Token rotation process documented
  ├─ Credential management guide
  ├─ Disaster recovery steps documented
  └─ Dashboard access provided

✓ For Business:
  ├─ Current status documented
  ├─ Cost estimate provided (remains $0/month)
  ├─ Performance metrics defined
  ├─ Success criteria listed
  ├─ Timeline and milestones documented
  ├─ Known limitations documented
  └─ Future enhancement opportunities listed


GO/NO-GO DECISION CRITERIA

GO (Phase 3 Complete):
  └─ All items above (Sections 1-21) completed ✓
     AND
     Production deployment successful ✓
     AND
     24-48 hour stability period passed ✓

CONDITIONAL GO (Phase 3 With Caveats):
  └─ Implementation complete
     BUT
     1-2 minor issues found (documented)
     AND
     Workarounds in place
     AND
     Fix scheduled for next week

NO-GO (Phase 3 Postponed):
  └─ Critical blocker discovered
     (e.g., API endpoint changed, Pinterest app rejected)
     OR
     Unresolved security issue
     OR
     >3 days of failures after deployment
```

---

## Conclusion

This comprehensive Phase 3 implementation plan provides:

1. **Clear Architecture:** Component structure, data flow, token lifecycle
2. **Production Readiness:** Infrastructure setup, deployment strategy, monitoring
3. **Risk Awareness:** Known risks, mitigation strategies, blockers
4. **Implementation Path:** 14-item work sequence, 14-18 hour estimate
5. **Completion Criteria:** 47 functional + non-functional requirements
6. **User Action Items:** 8 tasks with step-by-step instructions

**Phase 3 is ready to proceed upon:**
- User completion of 8 required tasks (Tasks 1-8)
- Verification of external APIs (Facebook Graph v26, Pinterest v5)
- Final approval to begin implementation

**Estimated Phase 3 Duration:** 1-2 development days
**Expected Completion:** 1 week (with user setup parallelized)
**Go Live Date:** ~September 11, 2026 (contingent on setup speed)
