# Phase 1.5: Infrastructure Revision Summary

**Date:** 2026-09-03  
**Status:** Complete  
**Changes:** Netlify → Vercel + Technical Corrections

---

## Overview

Phase 1.5 is a post-Phase-1 architectural revision triggered by two factors:
1. Business feedback: Vercel is the approved platform for Ceylon Haven applications
2. Technical research: Discovered and incorporated current API versions + security best practices

**Result:** Architecture now aligns with business infrastructure and incorporates latest technical standards.

---

## Major Changes

### 1. Infrastructure Platform: Netlify → Vercel

**Original (Phase 1):**
- Netlify Scheduled Functions for compute
- Netlify free tier: 300 credits/month
- Netlify function timeout: 15 minutes

**Revised (Phase 1.5):**
- Vercel Functions for serverless compute
- Vercel Cron Jobs for scheduling
- Vercel Hobby plan: free tier, supports once-daily cron
- Vercel function timeout: 60 seconds (sufficient for this workload)

**Why:**
- Business already maintains Vercel account with existing applications
- Operational consolidation: reduces infrastructure fragmentation
- Technical adequacy confirmed: 60s timeout sufficient for ~2-3s typical operations

**Decision documented in:** DECISIONS.md (new Decision 1 with historical note on Decision 1.5)

---

### 2. API Versions Updated

**Facebook Graph API:**
- v19.0 → v26 (current as of July 2026)
- All endpoint references updated
- No breaking changes identified in migration

**Pinterest API:**
- Confirmed v5 is current
- Corrected media_source payload structure (critical fix)
- Documented carousel pin support

---

### 3. Pinterest API Payload Correction

**Error Found:** TECH_REFERENCE.md documented incorrect payload structure

**Before:**
```json
{
  "title": "...",
  "description": "...",
  "image_url": "https://...",  // ❌ Wrong
  "board_id": "..."
}
```

**After:**
```json
{
  "title": "...",
  "description": "...",
  "media_source": {
    "source_type": "image_url",
    "url": "https://..."  // ✓ Correct
  },
  "board_id": "..."
}
```

**Impact:** Phase 2 implementation will use correct payload structure from the start.

---

### 4. Supabase Security Improvements

**Added Distinction:**

| Key | Type | Usage | Security |
|-----|------|-------|----------|
| Anon Key | Public | Client-side code + RLS | Safe to expose |
| Service Role Key | Secret | Server-side only | Never expose publicly |

**Best Practice Implemented:**
- Environment variables: `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`
- Service role key stored only in Vercel Environment Variables
- Never use `NEXT_PUBLIC_` prefix for secrets
- Future admin dashboard will use anon key + RLS policies

**Impact:** Phase 2 database operations will be secure by design.

---

### 5. Cron Scheduling Clarification

**Vercel Cron Timezone:** Always UTC (not Asia/Colombo)

**Calculation:**
- Desired: 12:00 PM Asia/Colombo (UTC+5:30)
- UTC Equivalent: 6:30 AM UTC
- Vercel Cron Expression: `30 6 * * *`

**Documented in:** ARCHITECTURE_PHASE1.md Appendix B, TECH_REFERENCE.md

---

### 6. Database Schema Enhancements

**Table Naming:**
- `processed_posts` → `facebook_posts_processed` (clearer intent)

**New Fields:**
- `idempotency_key` (VARCHAR UNIQUE): enables safe retries
- `execution_id` in logs: traceability for Vercel function executions

**Enhanced Relationships:**
- Foreign key: ON DELETE CASCADE for data integrity
- Indexes added for performance

**Impact:** Phase 2 schema implementation starts with production-ready design.

---

### 7. CRON_SECRET for Cron Job Protection

**New Requirement:** Vercel Cron security mechanism

**How It Works:**
1. Generate: `openssl rand -hex 32` (32-byte hex string)
2. Store: Vercel Environment Variable `CRON_SECRET`
3. Validate: Function checks `Authorization: Bearer ${CRON_SECRET}` header
4. Benefit: Prevents unauthorized invocation; protects API quotas

**Code Pattern:**
```typescript
if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Impact:** Phase 2 will include CRON_SECRET validation middleware by default.

---

## Files Updated

| File | Changes |
|------|---------|
| **ARCHITECTURE_PHASE1.md** | Complete revision: Netlify → Vercel throughout; updated cost analysis; enhanced risk section with Vercel-specific risks |
| **DECISIONS.md** | New Decision 1 (Vercel); moved original to Decision 1.5 (historical) |
| **TECH_REFERENCE.md** | Comprehensive Netlify → Vercel migration; updated API versions; fixed Pinterest media_source payload; added Vercel Cron configuration |
| **.env.example** | Added `FB_GRAPH_API_VERSION`, `CRON_SECRET`; distinguished anon vs service role keys |
| **CHANGELOG.md** | Added Phase 1.5 entry documenting all changes |
| **PERFORMANCE_LOG.md** | Updated timeout references; clarified estimated vs measured metrics |
| **PROJECT_STATUS.md** | Updated Netlify references to Vercel; updated external requirements checklist |
| **README.md** | Updated architecture diagram, cost table, Phase 2 plan; revised Key Decisions |
| **PHASE_1_5_SUMMARY.md** | This file (new) |

---

## What Did NOT Change

- ✓ Core business logic (Facebook → Pinterest pipeline)
- ✓ Duplicate prevention strategy (Facebook Post ID)
- ✓ Database schema fundamentals (3 tables)
- ✓ Supabase persistence layer
- ✓ API integration approach (official APIs only)
- ✓ Retry/error handling strategy
- ✓ Cost structure (~$0/month)

---

## External Requirements Checklist

Before Phase 2, you will need:

**Vercel:**
- [ ] Account created/access confirmed
- [ ] New project created
- [ ] GitHub connection established (recommended)
- [ ] Deployed at least once (enables Cron)

**Environment Variables (Vercel UI):**
- [ ] `FB_GRAPH_API_VERSION=v26`
- [ ] `FACEBOOK_PAGE_ID=...`
- [ ] `FACEBOOK_ACCESS_TOKEN=...`
- [ ] `PINTEREST_APP_ID=...`
- [ ] `PINTEREST_APP_SECRET=...`
- [ ] `PINTEREST_ACCESS_TOKEN=...`
- [ ] `PINTEREST_REFRESH_TOKEN=...`
- [ ] `SUPABASE_URL=...`
- [ ] `SUPABASE_ANON_KEY=...`
- [ ] `SUPABASE_SERVICE_ROLE_KEY=...`
- [ ] `CRON_SECRET=<32-byte-hex>`

**Supabase:**
- [ ] New PostgreSQL project
- [ ] All three keys captured (URL, anon, service role)

**Facebook & Pinterest:**
- [ ] Apps created (no changes from Phase 1)
- [ ] Tokens/credentials ready

---

## Timeline

- **Phase 1:** 2026-09-03 (original architecture)
- **Phase 1.5:** 2026-09-03 (infrastructure revision, ~1 hour)
- **Phase 2:** Ready to proceed (2-3 sessions, 4-6 hours estimated)

---

## Next Steps

1. **Review** this summary
2. **Review** updated [ARCHITECTURE_PHASE1.md](ARCHITECTURE_PHASE1.md)
3. **Confirm** Vercel infrastructure choice aligns with business
4. **Gather** credentials (Vercel, Facebook, Pinterest, Supabase)
5. **Approve** Phase 2 implementation

---

## Quality Assurance

All Phase 1.5 changes are **documentation-only** (no code changes):
- ✓ Verified all Netlify references replaced with Vercel equivalents
- ✓ Confirmed API versions current as of September 2026
- ✓ Cross-checked Pinterest API payload specification
- ✓ Validated Vercel Cron timeout adequacy for workload
- ✓ Documented UTC timezone calculation (06:30 UTC = 12:00 PM Asia/Colombo)
- ✓ Enhanced security documentation (RLS, service role key, CRON_SECRET)

All changes preserve Phase 1 historical context for future reference.

---

**End of Phase 1.5 Summary**

*Ready for Phase 2 implementation. See ARCHITECTURE_PHASE1.md for complete technical details.*
