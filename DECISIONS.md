# Architecture Decisions

## Decision 1: Infrastructure Platform - Vercel + Supabase (Phase 1.5 Revision)

**Decision:** Use Vercel Functions for compute + Vercel Cron Jobs for scheduling + Supabase PostgreSQL for data storage.

**Reason:**
- Ceylon Haven business already maintains an established Vercel account with successfully deployed applications
- Keeping automation on existing application platform reduces operational fragmentation and eliminates account management overhead
- Vercel Cron Jobs support once-daily execution on free tier (Hobby plan, limit: 100 jobs per project as of 2026)
- Vercel Functions timeout: 60 seconds free tier (sufficient for 2-3s API operations + DB writes)
- Supabase free tier: 500MB storage, sufficient for deduplication log + execution logs indefinitely at current volume
- Vercel environment variable management integrated; secrets never exposed in code or logs

**Why Selected:**
Operational continuity. The business has existing infrastructure investment and operational familiarity with Vercel. Reduces toolchain fragmentation vs. introducing separate Netlify account. Cron Jobs feature is sufficiently mature for once-daily scheduling.

**Note on Phase 1 Revision:**
Phase 1 originally recommended Netlify + Supabase. This was a reasonable recommendation at the time. However, post-Phase-1 business input clarified that Vercel is the approved platform for new Ceylon Haven applications. This decision overrides the earlier Netlify recommendation. No technical limitation prevents Vercel from supporting this workload; the change is operational/business-driven.

**Potential Future Implications:**
- If usage scales significantly (>1000 pins/month), consider Vercel Pro plan for extended function timeout (300s) if processing becomes complex
- Cron job execution times governed by UTC; must calculate appropriate UTC schedule for desired Asia/Colombo local time
- Service role key (Supabase) must never be exposed in client-side code; scheduled function runs server-side and uses service role key safely
- CRON_SECRET environment variable recommended for authorization header validation; prevents unauthorized invocation

---

## Decision 1.5 (HISTORICAL - Phase 1, Superseded by Decision 1): Infrastructure Platform - Netlify Functions + Supabase

**HISTORICAL NOTE:** This decision was made in Phase 1 and has been superseded by Decision 1 (Vercel + Supabase). Retained for project history only.

**Original Phase 1 Decision:** Use Netlify Scheduled Functions for compute + Supabase PostgreSQL for data storage.

**Original Reason:**
- Ceylon Haven website already hosted on Netlify (reduces operational fragmentation)
- Netlify Free plan includes 300 credits/month (~1-2 scheduled function invocations daily at no cost)
- Supabase free tier: 500MB storage, 500K edge functions, infinite projects (adequate for logging + deduplication)
- Both platforms have generous free tiers aligned with low-volume usage
- Netlify Functions integrate seamlessly with the existing website deployment pipeline

**Alternatives Considered at the Time:**
1. Cloudflare Workers + Durable Objects - Rejected for insufficient free tier and complex scaling
2. AWS Lambda + DynamoDB - Rejected for eventual paid tier costs after 12-month free period
3. Self-hosted scheduler - Rejected for violating cloud-independence requirement

**Status:** Superseded by Decision 1 (Vercel). Retained for historical reference. Implementation should use Vercel, not Netlify.

---

---

## Decision 2: Data Model - Facebook Post ID as Duplicate Prevention Key

**Decision:** Use Facebook Post ID as the primary unique identifier for duplicate prevention.

**Reason:**
- Facebook Post ID is stable, globally unique, and returned by official Graph API
- Post permalink is derived from Post ID, so ID serves as proxy for both
- Pinterest Pin ID cannot be pre-predicted; generated only after successful publication
- Comparing timestamps/captions insufficient (edited posts would be flagged as duplicates)

**Alternatives Considered:**
1. Caption + image hash deduplication
   - Rejected: Captions can be edited; edited posts become false positives
   - Image hash collision risk if same promotional image used for multiple villas
   
2. Timestamp-based uniqueness
   - Rejected: Fails if Facebook posts are retrieved out of order during retry
   - Doesn't prevent accidental re-processing from manual "run now" triggers

**Why Selected:**
Simplest, most reliable, requires no computation. One-to-many mapping: each Facebook post maps to at most one Pinterest pin.

**Potential Future Implications:**
- If Pinterest allows multiple pins per Facebook post (different boards), schema must be updated to composite key (facebook_post_id, board_id)
- If Facebook post deletion occurs, audit trail maintenance becomes necessary

---

## Decision 3: Content Adaptation Strategy - Defer to Phase 2

**Decision:** Phase 1 will publish minimal adapted content (title + description template). Full AI-driven adaptation deferred to Phase 2.

**Reason:**
- Lightweight content adaptation (deterministic templates) requires no API calls
- Eliminates Claude API dependency for Phase 1 validation
- Allows testing of full pipeline before investing in LLM costs
- Business can evaluate template output before committing to AI approach

**Alternatives Considered:**
1. Claude API for every pin caption
   - Deferred to Phase 2 due to: per-request cost (unlikely to exceed $1/month at 1 pin/day), dependency on API availability, and requirement to evaluate effectiveness first
   
2. Hardcoded templates only
   - Rejected: No property/location awareness; generic captions reduce click-through
   
3. Keyword extraction from post metadata
   - Deferred: Adds complexity without clear ROI in Phase 1

**Why Selected:**
Balances MVP viability with cost discipline. Template-based approach is reversible; can switch to Claude after Phase 1 validation.

**Potential Future Implications:**
- If template CTR proves inadequate (<2%), migration to Claude API becomes business priority
- Keyword routing logic (board selection) becomes more important with deterministic templates

---

## Decision 4: Scheduling - Daily Noon (Asia/Colombo)

**Decision:** Run scheduled function daily at 12:00 PM Asia/Colombo time.

**Reason:**
- Low-volume use case (1 run/day) requires no sub-daily precision
- Noon chosen: business-hour visibility for logs/debugging, avoids night-time API instability
- Timezone explicit: prevents midnight-edge-case issues common in international deployments

**Alternatives Considered:**
1. Per-minute granularity (Cloudflare Workers default)
   - Rejected: Unnecessary overhead; Facebook posts published infrequently
   
2. Webhook-based (on Facebook post publish)
   - Rejected: Requires Facebook Webhook subscription, function URL exposure to internet, and production app review
   - Adds infrastructure complexity for minimal latency benefit
   
3. Variable schedule (adaptive based on post frequency)
   - Rejected: Adds state management; returns diminishing value at current volume

**Why Selected:**
Simplest to understand and operate. Single daily run allows manual override via "Run Now" button.

**Potential Future Implications:**
- If post velocity increases (>3/day), finer-grained scheduling becomes necessary
- Timezone maintenance required if Ceylon Haven business expands to multiple countries

---

## Decision 5: Token Refresh Strategy - Refresh Every 25 Days

**Decision:** Implement proactive token refresh logic for both Facebook and Pinterest tokens.

**Reason:**
- Facebook Page tokens don't expire (long-lived), but Data Access permissions refresh every 90 days
- Pinterest access tokens expire in 30 days; refresh tokens are continuous (60-day rolling)
- Proactive refresh prevents runtime failures during scheduled execution
- Refresh logic sits in application layer (not infrastructure), survives graceful if called unnecessarily

**Alternatives Considered:**
1. React to expiration (catch error, refresh)
   - Rejected: Breaks scheduled job execution; loses data until manual intervention
   
2. Manual token rotation every 30 days
   - Rejected: Error-prone; requires human memory and deployment

**Why Selected:**
Automatic, predictable, low-complexity. Refresh calls are cheap (one HTTP request); retry logic simple.

**Potential Future Implications:**
- If refresh token revoked by user, proactive refresh fails silently; second failure on API call detected and logged
- Rate limit on refresh endpoint (unlikely, but undocumented) could cause cascading failures; implement exponential backoff

---

## Decision 6: Storage Platform - Supabase PostgreSQL Over Simple Key-Value

**Decision:** Use Supabase PostgreSQL (not lightweight KV store) for transaction safety and query flexibility.

**Reason:**
- Duplicate detection requires ACID guarantees (prevent race condition: two invocations creating duplicate pins)
- Pinterest board routing logic benefits from flexible schema (add columns without migration)
- Log querying enables debugging without file parsing
- Supabase free tier adequate (500MB storage, ~10K rows at 50KB/row)

**Alternatives Considered:**
1. Cloudflare Durable Objects KV
   - Rejected: Free tier (3 per billing period) too limited for production state
   - No SQL, query flexibility limited
   
2. Firebase Realtime Database
   - Rejected: External platform adds operational complexity
   - Adds vendor lock-in beyond Vercel + Supabase
   
3. File-based or blob storage
   - Rejected: No transaction support; duplicate detection would require full-file lock

**Why Selected:**
Supabase PostgreSQL is battle-tested for ACID operations. JSON fields enable semi-structured data without schema redesign. Environment variables managed via Vercel for secure credential storage.

**Potential Future Implications:**
- If data volume exceeds 500MB, migration to Supabase Pro ($25/mo) automatic
- If analytics queries dominate (slow full table scans), partitioning strategy becomes necessary

---

## Decision 7: Failure Handling - Fail Safe with Exponential Backoff

**Decision:** On API failure, log error, increment retry counter, return gracefully (don't throw). Retry up to 3 times before marking pin as `failed`.

**Reason:**
- Facebook/Pinterest rate limits typically temporary; transient failures expected to recover with backoff
- Duplicate prevention table locked during retry; same pin cannot create multiple duplicates
- Exponential backoff prevents cascading failures (don't hammer API during outage)

**Alternatives Considered:**
1. Fail fast (throw, crash entire job)
   - Rejected: Single API failure blocks entire batch
   - Creates operational noise (alerts for every transient failure)
   
2. Infinite retry with jitter
   - Rejected: Can exceed function timeout on some serverless platforms
   - Difficult to diagnose stuck jobs

**Why Selected:**
Balances reliability (captures transient failures) with observability (failed pins visible in logs).

**Potential Future Implications:**
- If function timeout is enforced shorter than 60 seconds, backoff window must shrink
- If Pinterest API throttle is aggressive, jitter strategy (randomize retry time) becomes necessary

---

## Decision 8: No Browser Automation - Official APIs Only

**Decision:** Use Meta Graph API + Pinterest REST API exclusively. No Selenium, Puppeteer, or browser-based scraping.

**Reason:**
- Official APIs available, documented, and supported
- Browser automation fragile (UI changes break immediately)
- Facebook/Pinterest terms of service prohibit scraping
- Serverless platforms impose constraints and costs on browser automation

**Alternatives Considered:**
1. Browser automation (Playwright, Puppeteer)
   - Rejected: Maintenance burden, fragility, TOS violations

**Why Selected:**
Only viable option given infrastructure constraints and legal requirements.

**Potential Future Implications:**
- If APIs sunset (low probability), project becomes unmaintainable
- If API rate limits tightened, performance isolation becomes necessary (queue-based architecture)
