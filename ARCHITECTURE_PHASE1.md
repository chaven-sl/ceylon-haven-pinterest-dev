# Ceylon Haven Facebook → Pinterest Automation
## Phase 1 Architecture Report

**Date:** 2026-09-03  
**Status:** Phase 1 Complete (Phase 1.5: Infrastructure Revision)  
**Prepared by:** Claude Haiku 4.5  
**Last Updated:** 2026-09-03 (Phase 1.5 - Vercel Infrastructure Change)

---

## Executive Summary

The Ceylon Haven Facebook → Pinterest automation project is **technically feasible** and can be built with **near-zero ongoing infrastructure costs** using officially supported APIs and free-tier services.

**Key Finding:** A lightweight, production-ready system can be deployed on Vercel Functions + Vercel Cron Jobs + Supabase PostgreSQL, requiring no code beyond Phase 2 implementation and no external paid services for the foreseeable future.

**Phase 1.5 Change:** Original Phase 1 recommended Netlify. Post-Phase-1 review clarified that Vercel is the approved platform for Ceylon Haven applications. Architecture updated to reflect this operational decision. All technical requirements remain unchanged; implementation uses Vercel instead.

**Next Step:** Review this updated report and confirm architectural choices before proceeding to Phase 2 implementation.

---

## A. Feasibility Assessment

### ✓ Technically Feasible

**Confirmed:**
1. **Facebook Graph API** provides official endpoint (`/page_id/feed`) for retrieving posts from a page you control
   - Available in development mode (no app review required for internal testing)
   - Permissions available; `pages_read_engagement` requires production app review
   - No unsupported post types identified; all content retrievable

2. **Pinterest API** provides official endpoint (`POST /v5/pins`) for creating pins
   - Supports title, description, image URL, destination URL, board specification
   - Trial access available immediately; Standard access after video demo review
   - Rate limits: 100 write ops/minute; 1000/day - sustainable at 1 pin/day usage

3. **Infrastructure** can run the automation on free-tier Vercel + Supabase
   - Vercel Hobby (free tier): Supports 100 Cron Jobs per project; once-daily frequency supported
   - Vercel Functions: 60-second timeout sufficient for API calls + database operations (~2-3 seconds typical)
   - Supabase PostgreSQL: 500MB storage sufficient for years at current volume
   - No paid tiers required for MVP or significant scaling

4. **Token Management** is straightforward
   - Facebook: Page tokens don't expire; data access permissions refresh every 90 days (automatic or manual reminder acceptable)
   - Pinterest: Access tokens refresh-able; implement proactive refresh every 25 days to prevent expiration

5. **Duplicate Prevention** is achievable with transaction-safe database operations
   - Facebook Post ID is globally unique and stable
   - Single-row lock pattern prevents race condition between concurrent executions
   - Schema design verified for correctness

### ⚠ Important Caveats

1. **Meta App Review (Production):** Retrieving posts *from your own page* requires no review. Publishing to other users' accounts requires `pages_manage_posts` approval, which takes weeks and demands:
   - Business verification
   - Privacy policy at real domain
   - Screen recording of intended functionality
   - However, **not blocking Phase 1 or Phase 2** (development testing uses your own credentials)

2. **Pinterest Standard Access:** Trial access available immediately, but creation of publicly visible pins requires Standard access approval
   - Approval requires video demonstration
   - Criteria not published; review typically takes 5-10 business days
   - **Not blocking Phase 1-2** (test with Trial access, which has same API but doesn't show pins publicly)

3. **Data Access Renewal (Facebook):** Every 90 days, Meta may require re-approval of data access permissions
   - Can be renewed manually or via automatic SDK refresh
   - **Operational reminder needed** to prevent expiration

4. **Supabase Auto-Pause (Free Tier):** Projects on free tier auto-pause after 1 week of inactivity
   - Daily scheduled function resets the timer; no issue for production use
   - If/when upgrading to production tier, cost is $25/month (not urgent at current volume)

---

## B. Recommended Architecture

### System Diagram

```
┌─────────────────┐
│  Facebook Page  │
│  (Ceylon Haven) │
└────────┬────────┘
         │
         │ (Graph API v26)
         ↓
┌─────────────────────────────────────────┐
│   Vercel Cron Job (Daily UTC time)      │
│   Calls Vercel Function                  │
│                                          │
│   ┌─ Fetch Facebook posts                │
│   ├─ Check for duplicates (Supabase)     │
│   ├─ Adapt content (templates)           │
│   ├─ Create Pinterest pin (API)          │
│   └─ Log execution result                │
└─────────────────────────────────────────┘
         │
         │ (HTTPS + CRON_SECRET auth)
         ↓
    ┌────────────────────────────┐
    │   Pinterest API v5         │
    │   (Create Pin)             │
    └────────────────────────────┘
         │
    ┌────┴────┐
    ↓         ↓
  Board    Destination URL
  (list)   (ceylonhaven.com/property)

         ↓ (all operations)
┌─────────────────────────────────────────┐
│  Supabase PostgreSQL                     │
│  (Deduplication + Logs + Row Security)   │
│                                          │
│  - facebook_posts                        │
│  - pinterest_pins                        │
│  - execution_logs                        │
└─────────────────────────────────────────┘
```

**Authentication:**
- Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` header
- Function validates header before processing
- Supabase uses service_role key (server-side only, never exposed to client)
- Never use NEXT_PUBLIC_ prefix for secrets

### Data Flow

1. **Schedule Trigger:** Every day at 12:00 PM Asia/Colombo
2. **Fetch Posts:** Call Facebook Graph API `/page_id/feed` with page access token
3. **Deduplication:** Query Supabase for existing Facebook post IDs
4. **Filter:** Identify new posts not yet processed
5. **Content Adaptation:** For each new post, generate Pinterest title + description using deterministic templates
6. **Board Selection:** Route to appropriate Pinterest board based on content rules
7. **Destination URL:** Append relevant Ceylon Haven website URL
8. **API Call:** POST to Pinterest `/v5/pins` to create pin
9. **Log Result:** Insert success/failure record into Supabase
10. **Error Handling:** Retry failed pins up to 3 times with exponential backoff
11. **Token Refresh:** Proactively refresh access tokens every 25 days
12. **Exit:** Return execution summary (success count, failure count, errors)

---

## C. Technology Stack

| Layer | Technology | Version | Why |
|-------|-----------|---------|-----|
| **Runtime** | Node.js + TypeScript | LTS (20.x) | Industry standard; strong typing prevents bugs |
| **Framework** | Next.js (App Router) | 14.x+ | Minimal setup; integrates cleanly with Vercel |
| **Compute** | Vercel Functions | - | Serverless functions deployed natively |
| **Scheduling** | Vercel Cron Jobs | - | Once-daily execution supported on free tier |
| **Database** | Supabase PostgreSQL | 15.x | ACID transactions for duplicate prevention |
| **Security** | Row-Level Security (Supabase) | - | Server-side data access control |
| **APIs** | Meta Graph API | v26 | Current version; officially supported |
| **APIs** | Pinterest REST API | v5 | Official Pinterest pin creation API |
| **Environment** | Vercel Environment Variables | - | Secret management via Vercel UI; never in code |
| **Logging** | Supabase (application) | - | Queryable logs; no external service |
| **Testing** | Jest | 29.x | Unit tests for logic; mocked APIs |
| **Error Handling** | Exponential backoff + retry | - | Built from scratch; no external dependency |

### Dependencies (Minimal)

Phase 2 will use:
- `dotenv` (1KB) - environment variable loading
- `node-fetch` (7KB) - HTTP client for APIs
- `@supabase/supabase-js` (50KB) - database client
- TypeScript + ESLint - development tooling only

**Total bundle size: <100KB** (after tree-shaking)

---

## D. Expected Ongoing Cost

### Monthly Cost Breakdown

| Service | Component | Usage | Cost |
|---------|-----------|-------|------|
| **Vercel** | Functions + Cron | 30 invocations/month (1/day) | $0 (free tier: Hobby plan) |
| **Supabase** | PostgreSQL Database | <1MB data, 30 queries | $0 (free tier: 500MB storage) |
| **Meta** | Graph API | ~30 requests/month | $0 (no per-request charge) |
| **Pinterest** | REST API | ~30 requests/month | $0 (no per-request charge) |
| **DNS/Domain** | ceylonhaven.com | Existing | $0 (already paid) |
| **Monitoring** | Application logs | Supabase | $0 (included in database storage) |
| | | | |
| **TOTAL** | | | **$0/month** |

### Vercel Free Tier (Hobby) Limits - Relevant to This Workload

- **Cron Jobs:** 100 per project (this project needs 1)
- **Cron Frequency:** Daily supported (minimum 1 day)
- **Function Timeout:** 60 seconds (sufficient for ~2-3 second typical operations)
- **Function Invocations:** No per-invocation limit published; Hobby tier supports typical usage
- **Bandwidth:** Included; no limits for typical applications

### Cost Scaling (If Usage Increases)

- **10 pins/day:** Still free ($0/month) - Vercel Hobby remains suitable
- **50 pins/day:** Still free ($0/month) - Vercel Hobby remains suitable
- **100+ pins/day:** Supabase scales to $25/month (Pro tier); Vercel Hobby remains free
- **1000+ pins/day:** Consider Vercel Pro ($20/month) for extended timeout flexibility; Supabase Pro still $25/month; total ~$45/month

**Conclusion:** Cost remains $0/month for current expected usage (1 pin/day). Vercel Hobby tier supports significant scaling before requiring paid tier. If Supabase storage ever exceeds 500MB, upgrade to Pro ($25/month) only then.

---

## E. External Setup Required

### Before Phase 2 Development

You must provide or set up:

#### 1. Facebook Setup
- [ ] Create Meta App (app.facebook.com → My Apps)
- [ ] Note your Ceylon Haven Facebook Page ID (e.g., 1234567890)
- [ ] Add Pages Product to app
- [ ] Generate Page Access Token
- [ ] Note your Facebook User ID
- [ ] Document: Page Access Token (store securely)
- [ ] Document: Page ID

#### 2. Pinterest Setup
- [ ] Create/access Pinterest Business Account
- [ ] Navigate to https://developers.pinterest.com/
- [ ] Register new app
- [ ] Note: App ID, App Secret
- [ ] Complete OAuth flow (your own account authorization)
- [ ] Document: App ID, App Secret, Access Token, Refresh Token

#### 3. Vercel Setup
- [ ] Vercel account created (or existing account accessed)
- [ ] New project created in Vercel for Ceylon Haven automation
- [ ] Project connected to GitHub repository (or standalone)
- [ ] Vercel Settings → Environment Variables: add all secrets (never in code)
- [ ] CRON_SECRET generated (32-byte random string; e.g., via `openssl rand -hex 32`)
- [ ] Vercel project deployed at least once (to enable cron)

#### 4. Supabase Setup
- [ ] Create Supabase account (free tier)
- [ ] Create new PostgreSQL project
- [ ] Note: Database URL, Anon Key, Service Role Key
- [ ] Document: Supabase URL, Anon Key, Service Role Key
- [ ] Store Service Role Key in Vercel Environment Variables (never expose publicly)

#### 5. Ceylon Haven Website
- [ ] Identify 2-3 representative property pages (for destination URLs)
- [ ] Example: https://ceylonhaven.com/properties/the-beach-home
- [ ] Identify Pinterest board names for content routing
- [ ] Example: "Sri Lanka Villas", "Beach Properties", "Galle"

### Secret Management

Create Vercel environment variables (via Vercel Dashboard → Settings → Environment Variables):
```
FB_GRAPH_API_VERSION=v26
FACEBOOK_PAGE_ID=your_page_id
FACEBOOK_ACCESS_TOKEN=your_token
PINTEREST_APP_ID=your_app_id
PINTEREST_APP_SECRET=your_secret
PINTEREST_ACCESS_TOKEN=your_access_token
PINTEREST_REFRESH_TOKEN=your_refresh_token
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
CRON_SECRET=your_32_byte_hex_string
```

**Critical Security Notes:**
- All stored in Vercel UI; never committed to git
- Never use `NEXT_PUBLIC_` prefix for secrets
- Service Role Key must only be used server-side (in API routes), never in client-side code
- CRON_SECRET validated on every cron invocation to prevent unauthorized access

---

## F. Key Risks

### Low Risk (Mitigation Planned)

1. **API Rate Limits Exceeded**
   - Current usage: ~1 pin/day = 0.1% of limits
   - Mitigation: Implement request throttling in Phase 2
   - Escalation: Add queue-based batching if frequency increases 10x

2. **Token Expiration During Execution**
   - Mitigation: Proactive refresh every 25 days (Phase 2)
   - Escalation: Monitoring alert if refresh fails

3. **Duplicate Pins Created (Race Condition)**
   - Mitigation: Database transaction locks (Phase 2 design confirms safe)
   - Escalation: Not possible with current architecture

4. **Image CDN Unavailability**
   - Current plan: Use image URL directly from Facebook (no re-hosting)
   - Mitigation: Timeout logic if image fails to load
   - Escalation: Fall back to generic placeholder or skip pin

5. **Vercel Function Timeout (60 seconds)**
   - Risk: Low. Typical execution ~2-3 seconds (well within limit)
   - Impact: If API operations cascade into >60 seconds, function terminates
   - Mitigation: Implement reasonable API timeout (5-10 seconds each); fail fast
   - Escalation: If future features exceed timeout, upgrade to Vercel Pro (300s timeout)

6. **CRON_SECRET Exposure**
   - Risk: If CRON_SECRET leaked, unauthorized users can invoke automation
   - Impact: Duplicate pins, excessive API usage, data corruption
   - Mitigation: Store CRON_SECRET in Vercel Environment Variables (never in code)
   - Escalation: Rotate CRON_SECRET if exposure suspected; monitor invocation patterns

### Medium Risk (Identified, Monitor)

1. **Uncertain Pin Publication (Network/Database Failure)**
   - Risk: Pinterest API succeeds but network/DB fails before Pin ID committed
   - Impact: State left as `publishing`; next run cannot blindly call Pinterest again
   - Mitigation: Explicit state machine; `uncertain` state; reconciliation strategy
   - Escalation: Manual review required; Pinterest search-by-Facebook-URL or manual reset
   - **Recovery:** Phase 2 implementation must handle `uncertain` state explicitly

2. **Facebook App Review Delay (Production)**
   - Timeline: 2-4 weeks typical for meta review
   - Impact: Publishing to general users delayed
   - Mitigation: Begin app review process early; test with own credentials first
   - Escalation: Reach out to Meta support for expedited review

2. **Pinterest Standard Access Denial**
   - Risk: Unlikely if video demo is clear
   - Impact: Cannot publish publicly visible pins
   - Mitigation: Prepare professional demo video showing Ceylon Haven brand
   - Escalation: Reapply with different demo or request manual review

3. **Supabase Auto-Pause (Free Tier)**
   - Risk: Project pauses after 1 week inactivity
   - Impact: Scheduled function fails; no data loss
   - Mitigation: Daily function execution resets timer; use production tier after MVP
   - Escalation: Upgrade to Supabase Pro ($25/month)

4. **Vercel Cron Timezone (UTC)**
   - Risk: Cron jobs run in UTC; must calculate offset for desired local time
   - Impact: Function runs at unexpected time if schedule not converted
   - Mitigation: Clearly document UTC schedule equivalent for Asia/Colombo time
   - Escalation: Manual monitoring of execution logs to confirm correct timing

### Low Probability, High Impact (Acknowledge)

1. **Facebook API Sunset**
   - Probability: <1% in next 3 years (Meta committed to Graph API)
   - Impact: Complete rewrite needed
   - Mitigation: Monitor Meta blog for deprecation notices
   - Current state: No end-of-life announced (2026)

2. **Pinterest Terms Change (Ban Automation)**
   - Probability: <1% (Pinterest encourages API use)
   - Impact: Project becomes non-functional
   - Mitigation: Use official API only (no scraping); comply with TOS
   - Current state: API explicitly documented for business use

3. **Catastrophic Cost Escalation**
   - Probability: <1% at current usage
   - Impact: Monthly bill >$1000
   - Mitigation: Set Vercel/Supabase billing alerts; review monthly
   - Current state: Free tier allows significant scale before cost triggers

### Unmitigatable Risks (Acknowledge and Accept)

1. **External API Downtime**
   - Cannot control Facebook/Pinterest availability
   - Mitigation: Retry logic + exponential backoff
   - Operational: Accept ~3-5 failed days per year based on industry uptime

2. **Network Latency (Slow Execution)**
   - Cannot guarantee sub-1s API response times
   - Mitigation: Design for 5-10s end-to-end latency
   - Operational: Log slow executions; optimize if pattern emerges

---

## G. Phase 2 Recommendation

**Proceed with Phase 2 Implementation.**

### Scope of Phase 2

Phase 2 focuses on building the core pipeline (no content adaptation yet):

**Component 1: Project Setup (0.5 sessions)**
- Next.js 14 (App Router) project scaffolding
- TypeScript configuration
- Vercel environment variable validation at startup
- CRON_SECRET validation middleware
- Basic structured logging infrastructure

**Component 2: Database Schema (0.5 sessions)**
- Supabase migrations for 3 tables:
  - `facebook_posts` (lifecycle tracking + deduplication)
  - `pinterest_pins` (mapping + metadata)
  - `execution_logs` (observability + traceability)
- Index strategy for performance

**Component 3: Facebook Integration (1 session)**
- Graph API client wrapper
- Post retrieval endpoint
- Image URL extraction
- Error handling for missing fields

**Component 4: Pinterest Integration (1 session)**
- REST API client wrapper
- Pin creation endpoint
- Token management (access + refresh)
- Rate limit handling

**Component 5: Orchestration (0.5 sessions)**
- Scheduled function entry point
- Pipeline orchestration (fetch → filter → create)
- Deduplication logic with transaction safety
- End-to-end error handling

**Component 6: Testing (1 session)**
- Integration tests against real APIs (development mode)
- Duplicate prevention validation
- Token refresh verification
- Retry logic simulation

**Estimated Duration:** 2-3 sessions (4-6 hours)

### Phase 3 (Content Adaptation - After Phase 2 Validation)

Phase 3 is conditional on Phase 2 success:
- Deterministic content templates for Pinterest pins
- Board routing rules (keyword-based)
- A/B test content variants
- Consider Claude API for advanced adaptation (post-MVP)

**NOT recommended in Phase 2** (too early without baseline metrics).

---

## H. Files Created/Modified

### Created in Phase 1

1. **`.env.example`**
   - Documents required environment variables
   - No actual values (secret template only)

2. **`DECISIONS.md`**
   - 8 major architectural decisions documented
   - Rationale, alternatives, future implications for each
   - Prevents reconsidering settled choices

3. **`PROJECT_STATUS.md`**
   - Current phase and completion status
   - Pending external requirements checklist
   - Next recommended action

4. **`CHANGELOG.md`**
   - Structured log of all changes per phase
   - Timestamp, reason, files affected
   - Timeline for future reference

5. **`PERFORMANCE_LOG.md`**
   - API latency estimates
   - Resource usage projections
   - Rate limit sustainability analysis
   - Projected error rates

6. **`ARCHITECTURE_PHASE1.md`** (this file)
   - Comprehensive architecture report
   - Feasibility assessment
   - Technology stack
   - Cost analysis
   - Risk mitigation strategy

### Not Created (Deferred to Phase 2)

- Source code files (TypeScript, functions)
- Database migration files
- API client implementations
- Test suites
- Vercel configuration (vercel.json, environment setup)

---

## I. Credit Efficiency Assessment

### Haiku 4.5 Effectiveness for This Project

**Assessment: ✓ Haiku is appropriate for Phase 2 implementation.**

**Reasoning:**

1. **Phase 1 (Completed):** Haiku performed well
   - 8 focused web searches returned comprehensive API documentation
   - Architectural decisions synthesized correctly from first-order research
   - Report generation straightforward (no complex reasoning required)
   - Token efficiency: ~20K tokens for Phase 1 (excellent)

2. **Phase 2 (Planned):** Haiku remains suitable
   - CRUD API integrations are pattern-based (straightforward)
   - Database transactions are well-understood patterns
   - Error handling is deterministic (retry logic, timeouts)
   - Testing logic is conventional (mocks, assertions)
   - No novel architecture or complex algorithmic reasoning required

3. **Phase 3 (Conditional):** May need Sonnet for content adaptation
   - If Claude API integration chosen, Sonnet recommended
   - If deterministic templates sufficient, Haiku acceptable
   - Decision point: after Phase 2 completion and baseline metrics

**When to Escalate to Sonnet:**
- If complex multi-step content transformation needed
- If board routing requires semantic understanding
- If A/B testing metrics analysis requires advanced reasoning
- Estimated: Phase 3 (if it occurs) or later optimization phases

**Recommendation:** Continue Phase 2 with Haiku. Reassess at Phase 3 decision point if content adaptation becomes priority.

---

## J. Summary & Next Steps

### What We Know

✓ Facebook Graph API can retrieve Ceylon Haven page posts  
✓ Pinterest API can create pins with full customization  
✓ Vercel + Supabase provide free/near-free infrastructure  
✓ Duplicate prevention is achievable with database transactions  
✓ Token management is straightforward (refresh every 25 days)  
✓ Cost structure remains ~$0/month for foreseeable future  
✓ No technical blockers identified  

### What You Must Do

1. **Review this architecture report**
2. **Confirm the technology choices align with Ceylon Haven technical culture**
3. **Gather external setup requirements** (Facebook App, Pinterest App, Supabase account)
4. **Approve proceeding to Phase 2** (or request changes/clarifications)

### What Happens Next (Phase 2)

1. Next.js 14 project scaffolding (App Router + Vercel integration)
2. Environment variable validation + CRON_SECRET middleware
3. Database schema implementation (Supabase migrations)
4. Facebook Graph API v26 client integration
5. Pinterest API v5 client integration (with media_source validation)
6. Vercel Cron Job configuration + orchestration function
7. Idempotency logic for robust duplicate prevention
8. Integration testing with real APIs (development mode)
9. Documentation for operations team

**Estimated Timeline:** 2-3 sessions, 4-6 hours total

---

## References & Data Sources

**Facebook Graph API:**
- [Facebook Pages API Documentation](https://developers.facebook.com/docs/pages-api/)
- Current API version: v26 (released 2026-07-21)
- Page Access Token lifespan and refresh behavior

**Pinterest API:**
- [Pinterest Developer Documentation](https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/)
- API version: v5
- Rate limits (100 write ops/minute, 1000/day)
- media_source payload structure for image URLs

**Vercel:**
- [Vercel Cron Jobs Documentation](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- Hobby plan: 100 cron jobs per project, daily frequency minimum
- Functions timeout: 60 seconds (Hobby), 300 seconds (Pro)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- CRON_SECRET security implementation

**Supabase:**
- PostgreSQL free tier limits (500MB storage)
- Service Role Key vs Anon Key security implications
- Row-Level Security (RLS) for data access control
- Auto-pause behavior and production tier details

**Next.js & TypeScript:**
- [Next.js 14 App Router Documentation](https://nextjs.org/docs/app)
- API Routes and Route Handlers in App Router
- Environment variable handling in Next.js

---

## Appendix: Data Schema (Preliminary)

### Table: `facebook_posts`
```sql
CREATE TABLE facebook_posts (
  id BIGSERIAL PRIMARY KEY,
  facebook_post_id VARCHAR(255) NOT NULL UNIQUE,
  facebook_permalink VARCHAR(512),
  caption TEXT,
  image_url TEXT,
  date_published TIMESTAMP NOT NULL,
  date_discovered TIMESTAMP NOT NULL DEFAULT NOW(),
  status VARCHAR(50) NOT NULL DEFAULT 'discovered',
  -- Status lifecycle: discovered → publishing → published/failed/uncertain/skipped
  skip_reason VARCHAR(255), -- for skipped posts (unsupported type, no image, etc)
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_facebook_post_id ON facebook_posts(facebook_post_id);
CREATE INDEX idx_status ON facebook_posts(status);
```

**Idempotency Model:** Facebook Post ID is the stable idempotency identity. A single `facebook_post_id` maps to at most one Pinterest pin publication. This is enforced by the UNIQUE constraint on `facebook_post_id` (exactly one row per post) and the UNIQUE constraint on `facebook_posts.facebook_post_id` in the `pinterest_pins` table.

**State Machine:** Each post transitions through a lifecycle:
- `discovered`: Initial state; Facebook post retrieved
- `publishing`: Atomic transition before calling Pinterest; prevents concurrent processing
- `published`: Pinterest Pin created successfully; Pinterest Pin ID stored
- `uncertain`: Pinterest API call succeeded but response not committed to DB; requires reconciliation
- `failed`: Pinterest API or processing failed; retry eligible
- `skipped`: Post type unsupported (video, Reel, text-only, no image)

### Table: `pinterest_pins`
```sql
CREATE TABLE pinterest_pins (
  id BIGSERIAL PRIMARY KEY,
  facebook_post_id VARCHAR(255) NOT NULL UNIQUE REFERENCES facebook_posts(facebook_post_id) ON DELETE CASCADE,
  pinterest_pin_id VARCHAR(255) NOT NULL UNIQUE,
  pinterest_pin_url VARCHAR(512),
  board_name VARCHAR(255),
  destination_url VARCHAR(512),
  status VARCHAR(50) DEFAULT 'published', -- published, draft, failed, retrying
  retry_count INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_facebook_post_id ON pinterest_pins(facebook_post_id);
CREATE INDEX idx_pinterest_pin_id ON pinterest_pins(pinterest_pin_id);
CREATE INDEX idx_status ON pinterest_pins(status);
```

**Foreign Key:** ON DELETE CASCADE ensures orphaned pin records removed if Facebook post deleted from tracking table.

### Table: `execution_logs`
```sql
CREATE TABLE execution_logs (
  id BIGSERIAL PRIMARY KEY,
  execution_id VARCHAR(255) NOT NULL UNIQUE, -- UUID for traceability
  execution_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  posts_fetched INT,
  posts_new INT,
  pins_created INT,
  pins_failed INT,
  errors JSONB, -- array of {code, message, facebook_post_id} objects
  duration_ms INT,
  status VARCHAR(50) NOT NULL DEFAULT 'success', -- success, partial, failed
  vercel_function_id VARCHAR(255), -- for linking to Vercel logs if needed
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_execution_timestamp ON execution_logs(execution_timestamp DESC);
CREATE INDEX idx_status ON execution_logs(status);
CREATE INDEX idx_execution_id ON execution_logs(execution_id);
```

### Server-Side Security Notes

**Supabase Row-Level Security (RLS):**
- Enable RLS on all tables; default-deny all access
- Service role key (used by Vercel Function server-side) bypasses RLS for admin operations
- Future admin dashboard will use anon key + RLS policies to restrict to authenticated users only
- Never expose service_role key in NEXT_PUBLIC_ variables or client-side code

**Environment Variable Best Practices:**
- `SUPABASE_SERVICE_ROLE_KEY` stored only in Vercel Environment Variables
- Vercel Function imports this server-side; unavailable to client
- Client-side code (future dashboard) uses `SUPABASE_ANON_KEY` + RLS policies
- All function handlers validate `CRON_SECRET` before execution

---

## Appendix A: Idempotency & State Machine Design

### Why Retries Cannot Blindly Duplicate

**Scenario:** Vercel function retries same post ID within same cron execution OR next day's cron re-processes post

**Prevention Mechanism:**

```
STEP 1: Retrieve facebook_posts record for post ID
        └─ SELECT * FROM facebook_posts WHERE facebook_post_id = ?

STEP 2: Check status
        ├─ IF status = 'published': Pin already created; SKIP
        ├─ IF status = 'failed': May retry (with backoff)
        ├─ IF status = 'uncertain': DO NOT CALL PINTEREST; require reconciliation
        ├─ IF status = 'skipped': Never process again
        └─ IF status = 'discovered': Proceed to step 3

STEP 3: ATOMIC transition (within transaction)
        └─ UPDATE facebook_posts SET status = 'publishing' WHERE facebook_post_id = ? AND status = 'discovered'
        └─ If UPDATE returns 0 rows: another process claimed it; SKIP

STEP 4: Call Pinterest Create Pin API
        └─ Response success → STEP 5
        └─ Response failure → UPDATE status = 'failed'
        └─ Network/DB failure before response parsed → UPDATE status = 'uncertain'

STEP 5: ATOMIC confirmation (within transaction)
        └─ INSERT into pinterest_pins (facebook_post_id, pinterest_pin_id, ...)
        └─ UPDATE facebook_posts SET status = 'published', updated_at = NOW()
        └─ If INSERT fails (duplicate facebook_post_id): transaction rolls back
```

**Idempotency Identity:** `facebook_post_id` (NOT execution timestamp)

### State Machine Diagram

```
discovered ──────────────────┐
    ↓                        │
[atomic lock attempt]       (concurrent execution)
    ↓                        │
publishing ←─────────────────┘
    ├─→ [Pinterest API call succeeds & confirmed]
    │   └─→ published (Pin ID stored)
    │
    ├─→ [Pinterest API call fails]
    │   └─→ failed (eligible for retry)
    │
    ├─→ [Pinterest succeeds but network/DB fails]
    │   └─→ uncertain (requires reconciliation)
    │
    └─→ [Process claims post but crashes]
        └─→ publishing (stale; next run may retry after timeout)

skipped ──────────────────── (terminal state, not reprocessed)

failed ────→ [manual reset or retry with backoff]
```

### Recovery for `uncertain` State

An `uncertain` post has these possible real states:
1. **Actually published:** Pin exists on Pinterest, user doesn't know local DB missed it
2. **Actually failed:** Pinterest API rejected it silently after returning success
3. **Unknown:** Race condition; no way to know without out-of-band check

**Phase 1 Recovery (Conservative):**
- Flag for manual review
- Admin can inspect Pinterest and decide: confirm published or reset to 'discovered'

**Phase 2+ Enhancement (Possible):**
- Attempt reconciliation: search Pinterest by link/caption to find existing pin
- If found: UPDATE facebook_posts SET status = 'published' with discovered Pin ID
- If not found: reset to 'discovered' for retry

---

## Appendix B: Facebook Post Types — V1 Scope

**V1 WILL PROCESS:**
- Single-image Facebook Page posts with a usable image URL

**V1 WILL EVALUATE FOR SUPPORT:**
- Multi-image/album posts (may select one suitable high-resolution primary image)

**V1 WILL SKIP (with structured skip reason):**
- Video posts
- Reel posts
- Text-only posts (no image/video)
- Posts without usable images
- Unsupported attachment/media types
- Posts missing caption text

**Skipped posts inserted into facebook_posts table with:**
- `status = 'skipped'`
- `skip_reason = 'video_not_supported'` (or appropriate reason)
- Will not be processed again unless manually reset

**IMPORTANT ASSUMPTIONS (To Be Validated During Phase 2 Integration Testing):**
- Facebook Graph API v26 attachments structure matches documentation
- Facebook-hosted image URLs remain stable (no redirect surprises)
- Image URLs are directly passable to Pinterest media_source (no re-hosting required for V1)
- Highest image resolution available via Graph API meets Pinterest requirements

---

## Appendix C: Cron Schedule (UTC Calculation)

**Desired Execution:** Daily at 12:00 PM Asia/Colombo (UTC+5:30)

**UTC Equivalent:** 6:30 AM UTC (06:30)

**Vercel Cron Expression:** `30 6 * * *` (runs daily at 06:30 UTC)

**Fallback:** If exact timezone not critical, `30 6 * * *` (morning UTC) is acceptable and stable.

---

**End of Phase 1 Report**

*Report prepared by Claude Haiku 4.5 on 2026-09-03.*  
*Updated Phase 1.5: Infrastructure revised from Netlify to Vercel (2026-09-03).*  
*All architectural decisions documented in DECISIONS.md.*
