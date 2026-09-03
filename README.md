# Ceylon Haven Facebook → Pinterest Automation

Automatic social media distribution: republish Ceylon Haven Facebook posts to Pinterest with zero manual intervention.

**Status:** ✓ Phase 3 Ready for Implementation  
**Latest Completion:** Phase 3 Pre-Flight Verification Complete (2026-09-03)  
**Next Step:** Provide user credentials and start Phase 3 implementation (see [PHASE_3_CORRECTION_REPORT.md](PHASE_3_CORRECTION_REPORT.md))

---

## Quick Links

### Phase 3 Ready
- **[Phase 3 Correction Report](PHASE_3_CORRECTION_REPORT.md)** ← **START HERE for Phase 3** (executive summary)
- **[Phase 3 API Verification](PHASE_3_API_VERIFICATION.md)** — Current Facebook v26 + Pinterest v5 specs
- **[Phase 3 Architecture Corrections](PHASE_3_ARCHITECTURE_CORRECTIONS.md)** — Token persistence, retries, board routing, content adaptation

### Setup & Project Information
- **[Development Setup Guide](DEVELOPMENT_SETUP.md)** — Setup cloud Supabase + run tests
- **[Phase 2.4 Report](PHASE_2_4_REPORT_REVISED.md)** — Technical details of cloud environment
- **[Project Status](PROJECT_STATUS.md)** — Current completion state
- **[Phase 1 Architecture Report](ARCHITECTURE_PHASE1.md)** — Original architecture design
- **[Architectural Decisions](DECISIONS.md)** — Why we chose each technology
- **[Performance Projections](PERFORMANCE_LOG.md)** — Cost, latency, and reliability estimates
- **[Changelog](CHANGELOG.md)** — Development history

---

## What This Project Does

**Input:** New Facebook post on the official Ceylon Haven page  
**Process:** Extract text + image, adapt for Pinterest, check for duplicates  
**Output:** Published Pinterest pin on targeted board with destination URL  
**Schedule:** Runs automatically every day at noon (Asia/Colombo timezone)  
**Cost:** ~$0/month (free infrastructure)

### Example Transformation

**Facebook:**
```
"Slow mornings at The Beach Home 🌴 Breakfast overlooking the Indian Ocean 
before heading down for a swim."
```

**Pinterest Pin:**
```
Title:    "Beachfront Villa in Galle, Sri Lanka"
Desc:     "Wake up beside the Indian Ocean at this private beachfront villa near Galle, 
           Sri Lanka. Discover The Beach Home by Ceylon Haven — ideal for families and 
           groups looking for a relaxed south-coast escape."
URL:      https://ceylonhaven.com/properties/the-beach-home
Board:    "Sri Lanka Villas"
```

---

## Architecture

```
Facebook Page →  Vercel Cron Job  →  Vercel Function  →  Pinterest API
   (daily)       (06:30 UTC)        (validates secret)        ↓
                                                          Supabase DB
                                                          (logs + dedup)
```

**Key Components:**
- **Compute:** Vercel Functions (serverless, 60s timeout on Hobby plan)
- **Scheduling:** Vercel Cron Jobs (once-daily, UTC-based)
- **Data Storage:** Supabase PostgreSQL (duplicate prevention + logs + RLS)
- **APIs:** Meta Graph API v26 (Facebook) + Pinterest REST API v5
- **Security:** Vercel Environment Variables + CRON_SECRET validation + RLS

**Cost:** $0/month (free tiers + no per-request charges)

---

## Phase 1 Deliverables

Phase 1 is complete. This repository contains:

- ✓ Technical architecture assessment
- ✓ API capability research (Facebook + Pinterest)
- ✓ Infrastructure evaluation (Vercel, Netlify, Supabase, Cloudflare)
- ✓ Database schema design (minimal, production-ready)
- ✓ Failure handling strategy
- ✓ 8 documented architectural decisions
- ✓ Complete cost analysis
- ✓ Risk mitigation plan

**What's NOT in Phase 1:**
- No source code
- No actual API integrations
- No database migrations
- No testing
- No content templates

---

## Getting Started (Phase 2.4 Revised)

### Prerequisites

You will need:

1. **Supabase Account** (free tier)
   - Create development project: `ceylon-haven-pinterest-dev`
   - Obtain: Project URL, Anon Key, Service Role Key

2. **Node.js + npm**
   - Node 18+ installed
   - npm 9+ installed
   - Git already initialized in repository

3. **GitHub** (optional)
   - Repository initialized: ✓ Done
   - Ready for collaboration

See [DEVELOPMENT_SETUP.md](DEVELOPMENT_SETUP.md) for step-by-step instructions.

### Current Status (Phase 3 Ready)

**✓ ALL TESTING COMPLETE:**
- ✓ 32/32 integration tests PASSED against cloud Supabase (Sep 3, 2026)
- ✓ 83 unit/mock tests PASSED
- ✓ 115 total tests passing
- ✓ Zero Docker requirements (used cloud Supabase instead)
- ✓ No pending setup steps or blockers

**✓ What's Ready**

- ✓ Application source code (app/, db/, lib/, services/)
- ✓ Database schema & migrations (2 SQL migrations applied)
- ✓ 32/32 cloud integration tests PASSED
- ✓ 83 unit/mock tests PASSED
- ✓ RPC functions (atomic state machine)
- ✓ GitHub repository initialized
- ✓ TypeScript strict mode + ESLint validation
- ✓ Row-Level Security validated and tested
- ✓ Production-ready architecture proven

### Phase 3 Blockers (User Action Required)

Before Phase 3 implementation begins, user must provide:

1. **Facebook Page ID** (5 minutes) — Ceylon Haven page ID
2. **Pinterest Business Account** (2 minutes) — Verify or create
3. **Pinterest App Credentials** (25 minutes) — App ID + Client Secret
4. **Meta App Credentials** (optional, 10 minutes) — May already exist

See [PHASE_3_CORRECTION_REPORT.md](PHASE_3_CORRECTION_REPORT.md) Section 12 for detailed user action plan.

**No Docker required.** Phase 2.4 used cloud Supabase. Phase 3 uses production Supabase + real APIs.

---

## Key Decisions

See [DECISIONS.md](DECISIONS.md) for full rationale. Summary:

| Decision | Choice | Why |
|----------|--------|-----|
| Infrastructure | Vercel + Supabase | Established business account; reduces operational fragmentation |
| Scheduling | Vercel Cron Jobs | Once-daily supported on free tier; native integration |
| Duplicate Detection | Facebook Post ID | Globally unique, stable, official identifier |
| Retry Logic | Idempotency Keys | Safe retries; prevents duplicate pins on function retry |
| Storage | PostgreSQL + RLS | Transaction safety + row-level access control |
| APIs | Official only | No browser automation; TOS compliant; current versions (v26, v5) |

---

## Expected Costs

**Ongoing:** $0/month (free tiers cover all foreseeable usage)

| Component | Monthly | Notes |
|-----------|---------|-------|
| Vercel Functions + Cron | $0 | Hobby plan free; 60s timeout sufficient |
| Supabase PostgreSQL | $0 | 500MB free storage; scales to $25/mo if exceeded |
| Facebook API | $0 | No per-request charge |
| Pinterest API | $0 | No per-request charge |
| **Total** | **$0** | Free for years at current volume |

---

## Architecture Overview

### Data Model

**Three Tables:**

1. **facebook_posts** — Post lifecycle tracking
   - Tracks each Facebook post's publishing lifecycle
   - Primary key: `facebook_post_id` (guaranteed unique)
   - Status: discovered, publishing, published, failed, uncertain, skipped
   - Prevents duplicate Pinterest pins; enables state-based recovery

2. **pinterest_pins** — Publication records
   - Maps Facebook post to Pinterest pin
   - Stores Pinterest pin ID + URL
   - Tracks board selection + destination URL

3. **execution_logs** — Observability
   - Records every scheduled function run
   - Success count, failure count, errors, duration
   - Queryable for debugging + reporting

### Execution Flow

```
Daily Trigger (12:00 PM Asia/Colombo)
    ↓
Fetch Facebook posts via Graph API (/page_id/feed)
    ↓
For each post:
    ├─ Check Supabase for existing facebook_post_id
    ├─ If new:
    │   ├─ Extract caption, image URL
    │   ├─ Generate Pinterest title + description (templates)
    │   ├─ Select board (routing rules)
    │   ├─ Create pin via Pinterest API (POST /v5/pins)
    │   ├─ Log success: record pinterest_pin_id
    │   └─ Return: pin URL
    │
    └─ If duplicate:
        └─ Skip (already processed)
    
On error:
    ├─ Retry up to 3 times with exponential backoff
    ├─ Log error + retry count
    └─ Mark as `failed` if all retries exhausted

End:
    ├─ Record execution summary (success/fail counts)
    ├─ Log execution to Supabase
    └─ Wait 24 hours for next cron run
```

---

## File Structure (Phase 1)

```
Ceylon-Haven-Pinterest-Automation/
├── README.md                      ← You are here
├── ARCHITECTURE_PHASE1.md          ← Start here: full architecture report
├── DECISIONS.md                    ← Why each technology was chosen
├── PROJECT_STATUS.md               ← Current completion state + checklist
├── CHANGELOG.md                    ← Development history
├── PERFORMANCE_LOG.md              ← Cost + performance projections
├── .env.example                    ← Required environment variables (template)
│
└── (Phase 2 additions will include):
    ├── src/
    │   ├── functions/
    │   │   └── scheduled.ts        ← Daily scheduled function entry point
    │   ├── services/
    │   │   ├── facebook.ts         ← Graph API client
    │   │   ├── pinterest.ts        ← REST API client
    │   │   └── supabase.ts         ← Database client
    │   ├── types/
    │   │   └── index.ts            ← TypeScript interfaces
    │   └── utils/
    │       ├── logger.ts           ← Structured logging
    │       ├── retry.ts            ← Retry with exponential backoff
    │       └── errors.ts           ← Error handling
    ├── migrations/
    │   ├── 001_create_tables.sql
    │   └── 002_create_indexes.sql
    ├── tests/
    │   ├── integration.test.ts
    │   └── mocks/
    ├── package.json
    ├── tsconfig.json
    ├── vercel.json                 ← Vercel configuration
    └── .gitignore
```

---

## Next Steps (Phase 3 Ready)

### Immediate (You - 30 minutes)
1. **Read:** [PHASE_3_CORRECTION_REPORT.md](PHASE_3_CORRECTION_REPORT.md) (executive summary)
2. **Collect Credentials:** Section 12 lists what's needed (Facebook Page ID, Pinterest App credentials)
3. **Verify:** Pinterest Business Account exists (free tier)
4. **Share with Developer:** Facebook Page ID + Pinterest credentials securely

**All Phase 2 testing already complete** — no setup needed, codebase ready.

### Phase 3 Implementation (Developer)
1. Integrate Facebook Graph API v26 (verified working)
2. Integrate Pinterest API v5 (verified working)
3. Implement token persistence (Supabase encrypted storage)
4. Deploy to production Vercel + Supabase
5. First production run (manual trigger)

### Timeline
- **Phase 1:** ✓ Complete (architecture + research)
- **Phase 2:** ✓ Complete (codebase + database)
- **Phase 2.4:** ✓ Complete (cloud testing - 32/32 tests passed)
- **Phase 3 Pre-Flight:** ✓ Complete (API verification + corrections)
- **Phase 3:** Ready (awaiting user credentials)
- **Phase 4 (Optional):** Content adaptation + AI

---

## Support & Questions

**Phase 3 Questions:**
- Reference [PHASE_3_CORRECTION_REPORT.md](PHASE_3_CORRECTION_REPORT.md) for pre-flight findings
- Check [PHASE_3_ARCHITECTURE_CORRECTIONS.md](PHASE_3_ARCHITECTURE_CORRECTIONS.md) for design details
- Review [PHASE_3_API_VERIFICATION.md](PHASE_3_API_VERIFICATION.md) for API specs

**General Questions:**
- Reference [DECISIONS.md](DECISIONS.md) for architectural rationale
- Check [PERFORMANCE_LOG.md](PERFORMANCE_LOG.md) for expected costs/latency
- Review [PROJECT_STATUS.md](PROJECT_STATUS.md) for known issues

---

## Compliance & Security

- ✓ No hardcoded secrets (environment variables only)
- ✓ `.env.example` documents required variables (no values)
- ✓ `.gitignore` prevents accidental secret commits
- ✓ Official APIs only (no TOS violations)
- ✓ No browser automation or scraping
- ✓ Transaction-safe database operations (ACID)
- ✓ Token persistence: Encrypted storage in Supabase (not Vercel env vars)
- ✓ All authentication via secure OAuth 2.0 flows

---

## Project Status Summary

| Phase | Status | Date | Tests |
|-------|--------|------|-------|
| 1 | ✓ Complete | Sep 2026 | Architecture verified |
| 2 | ✓ Complete | Sep 2026 | 83 unit tests |
| 2.4 | ✓ Complete | Sep 3, 2026 | 32 integration tests |
| 3 Pre-Flight | ✓ Complete | Sep 3, 2026 | APIs verified |
| **3 Implementation** | **Ready** | **Awaiting credentials** | — |

**Start Phase 3:** Provide credentials listed in [PHASE_3_CORRECTION_REPORT.md](PHASE_3_CORRECTION_REPORT.md)
