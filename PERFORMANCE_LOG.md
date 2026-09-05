# Performance Log

Records of system testing, benchmarking, and major execution events.

**Note:** All Phase 1 performance metrics are ESTIMATED (based on API documentation and industry benchmarks). Phase 2 will include MEASURED values from actual function executions.

---

## Phase 3: Production Health Endpoint Diagnosis (2026-09-05)

**Timestamp:** 2026-09-05 17:00 UTC  
**Operation:** Production health endpoint verification  
**Result:** Code verified correct, Vercel deployment issue identified  
**Duration:** ~45 minutes (local testing + git history analysis + Vercel API calls)  
**API Calls Made:** 0 (no external APIs called, diagnosis only)  
**Errors Found:** 1 (Vercel production returns 404 despite working code)

**Findings:**
- Local build includes `/api/health` route ✅
- Local runtime returns HTTP 200 ✅
- Code quality: type-check ✅, lint ✅, audit ✅
- Git history: all commits include health route ✅
- Vercel production: HTTP 404 NOT_FOUND ❌

**Root Cause:** Vercel deployment configuration or stale artifact (not code issue)

**Next Action:** Access Vercel dashboard to verify/reset build configuration

**Detailed Report:** See HEALTH_ENDPOINT_DIAGNOSIS.md

---

## Phase 1.5: Infrastructure Revision (2026-09-03)

**Summary of Changes:**
- Vercel function timeout: 60 seconds (Hobby tier)
- Documented UTC timezone for Vercel Cron (06:30 UTC = 12:00 PM Asia/Colombo)
- Removed obsolete Netlify timeout references

**Vercel Function Timeout:**
- Hobby plan: 60 seconds maximum (published limit)
- Pro plan: 300 seconds maximum (published limit)
- Typical execution expected: ~2-3 seconds
- Actual latencies to be measured during Phase 2 integration testing

---

## Phase 1: Architecture Research

**Timestamp:** 2026-09-03  
**Operation:** API capability assessment and infrastructure evaluation  
**Result:** All research objectives completed successfully  
**Duration:** ~45 minutes (8 targeted web searches + analysis)  
**API Calls Made:** 0 (research phase only; no live testing)  
**Errors:** None  
**Warnings:** None  

**Observations:**
- Facebook Graph API documentation current (updated May 2026)
- Pinterest API documentation current (multiple 2026 sources)
- No deprecated endpoints identified
- All required permissions available in current API versions
- No technical blockers identified

---

## Phase 2: Projected Execution Performance (Estimated)

Based on API documentation and industry benchmarks:

### Facebook Feed Retrieval
- Estimated: 500ms - 1500ms per request (depends on network latency to Meta CDN)
- Typical: ~1000ms
- Worst-case (timeout): 15,000ms (function timeout limit)

### Pinterest Pin Creation
- Estimated: 800ms - 2000ms per request
- Typical: ~1200ms
- Worst-case: 15,000ms (function timeout limit)

### Database Operations (Supabase)
- Duplicate check (SELECT by id): ~20ms
- Write post record (INSERT): ~30ms
- Write pin record (INSERT): ~30ms
- Estimated total: ~80ms for database layer

### Projected End-to-End (Single Post - ESTIMATED)
- Facebook retrieval: 1000ms (estimate)
- Duplicate check: 20ms (estimate)
- Image processing: 0ms (use image URL directly; no re-hosting)
- Pinterest creation: 1200ms (estimate)
- Database write: 80ms (estimate)
- **Total per post: ~2300ms (estimated)**
- **Actual measurements to be recorded in Phase 2**

### Scheduled Function Resource Usage (Vercel)
- Memory: ~64MB (Node.js + minimal dependencies)
- CPU time: expected ~2-3 seconds for end-to-end flow
- Function timeout: 60 seconds (Vercel Hobby, published limit)
- Cost: within free tier allocation

---

## Retry & Backoff Strategy (Simulated)

Projected exponential backoff behavior:

| Attempt | Backoff Delay | Total Elapsed | Expected Outcome |
|---------|---------------|-----------------|------------------|
| 1       | Immediate     | 2.3s            | Healthy API succeeds |
| 2       | 3s            | 5.3s            | Transient failure recovered |
| 3       | 9s            | 14.3s           | Rate limit recovered |
| Failed  | Logged        | 14.3s           | Permanent failure; manual review |

All attempts complete well within 60-second Vercel Hobby function timeout.

---

## Rate Limit Sustainability Check

**Pinterest Rate Limits:**
- 100 write ops/minute per user per app
- 1000 ops/day limit on Standard tier
- Ceylon Haven usage: ~1 pin/day = 0.1% of daily limit
- **Conclusion:** Sustainable indefinitely at current volume

**Facebook Rate Limits:**
- Graph API rate limits (undocumented exact values, ~200 requests/hour typical)
- Ceylon Haven usage: ~1 feed retrieval/day = 0.04% of hourly limit
- **Conclusion:** Sustainable indefinitely at current volume

---

## Storage Projection (Supabase)

**Base Schema Size:**
- One `facebook_posts` record: ~300 bytes
- One `pinterest_pins` record: ~200 bytes
- One `execution_logs` record: ~500 bytes

**Growth at 1 post/day (Estimated):**
- Daily storage growth: ~1000 bytes
- Monthly growth: ~30KB
- Annual growth: ~365KB
- Free tier limit: 500MB
- **Projected scaling point:** At current rate, storage limit would be reached after many years

**Conclusion:** Supabase free tier expected to be sufficient for extended operation at current volume. When growth accelerates significantly (10+ pins/day or more complex content), upgrade to production tier ($25/mo) at that time.

---

## Error Rate Projections (ESTIMATED - based on industry benchmarks)

API availability based on published SLA data:

| Service         | Published SLA | Typical Implications |
|-----------------|---------------|----------------------|
| Meta (Facebook) | 99.99%        | High reliability expected |
| Pinterest       | 99.9%         | Occasional brief outages expected |
| Supabase        | 99.9%         | Occasional brief outages expected |

**Retry Strategy Impact:** Exponential backoff retry logic with 3 attempts expected to recover majority of transient failures. Permanent failures (invalid credentials, API changes) require manual intervention.

**Actual failure rates to be measured during Phase 2 integration testing.**

---

## Notes for Phase 2 Testing

When Phase 2 implementation completes:

1. **Integration Test:** Execute one full pipeline (Facebook post → Pinterest pin) against development credentials
   - Target: <5000ms end-to-end latency
   - Success metric: pin visible on Pinterest board within 60 seconds
   
2. **Deduplication Test:** Manually trigger function twice against same Facebook post
   - Target: only one Pinterest pin created
   - Verify: database transaction prevents race condition
   
3. **Failure Handling Test:** Simulate network timeout mid-flow
   - Target: graceful retry, no duplicate pins created
   - Verify: error logged with retry count

4. **Token Refresh Test:** Force token expiration, verify automatic refresh
   - Target: function succeeds without manual re-auth
   - Verify: refresh event logged

5. **Load Test:** Simulate rapid scheduling (10+ runs)
   - Target: no race conditions, duplicates, or cascading failures
   - Verify: each run completes independently

---

## Optimization Opportunities (Future)

- **Image optimization:** If image URLs become bottleneck, implement local caching or CDN mirroring
- **Batch processing:** If frequency increases significantly, batch API calls to reduce latency
- **Caching layer:** If post fetching becomes bottleneck, implement in-memory caching
- **Async notifications:** Implement webhook to notify Ceylon Haven team when pin published (currently logs only)
