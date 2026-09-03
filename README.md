# Ceylon Haven Facebook → Pinterest Automation

Automatic social media distribution: republish Ceylon Haven Facebook posts to Pinterest with zero manual intervention.

**Status:** Phase 2.4 Revised Complete (Cloud Development Environment Ready)  
**Next Step:** Follow [DEVELOPMENT_SETUP.md](DEVELOPMENT_SETUP.md) to set up Supabase and run integration tests

---

## Quick Links

- **[Development Setup Guide](DEVELOPMENT_SETUP.md)** — Setup cloud Supabase + run tests (start here)
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

### Setup (Immediate)

```bash
# 1. Create .env.test with Supabase credentials
cp .env.test.example .env.test
# Edit .env.test with your values (see DEVELOPMENT_SETUP.md Part 2)

# 2. Install dependencies
npm install

# 3. Run integration tests against cloud Supabase
source .env.test
npm run test:integration:db

# Expected: ✓ 29 tests pass
```

### What's Ready

- ✓ Application source code (app/, db/, lib/, services/)
- ✓ Database migrations (Supabase SQL)
- ✓ 29 integration tests (cloud Supabase)
- ✓ RPC functions (atomic state machine)
- ✓ GitHub repository initialized
- ✓ TypeScript + ESLint + Prettier configured
- ✓ Row-Level Security validated

### What's NOT Ready Yet (Phase 3+)

- Real Facebook credentials (Phase 3)
- Real Pinterest credentials (Phase 3)
- Production Supabase project (Phase 3)
- Production Vercel deployment (Phase 3)

**Docker is NOT required.** Development uses cloud Supabase (free tier).

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

## Next Steps

### Immediate (You)
1. Read [DEVELOPMENT_SETUP.md](DEVELOPMENT_SETUP.md) (Part 1-3)
2. Create Supabase development project (free tier, ~5 min)
3. Apply database migrations to dev project (~2 min)
4. Configure .env.test with credentials (~2 min)
5. Run tests: `source .env.test && npm run test:integration:db` (~30 sec)
6. Verify: All 29 tests pass

### Phase 3 Preparation
- Real Facebook Graph API integration
- Real Pinterest API integration
- Production Supabase project setup
- Production Vercel deployment
- Real credentials management

### Timeline
- **Phase 1:** Complete (architecture + research)
- **Phase 2:** Complete (codebase + database)
- **Phase 2.4 Revised:** Complete (cloud dev environment)
- **Phase 3:** API integration (~2-3 sessions)
- **Phase 4 (Optional):** Content adaptation + AI

---

## Support & Questions

If questions arise during Phase 2:
- Reference [DECISIONS.md](DECISIONS.md) for architectural rationale
- Check [PERFORMANCE_LOG.md](PERFORMANCE_LOG.md) for expected costs/latency
- Review [PROJECT_STATUS.md](PROJECT_STATUS.md) for known issues
- All external requirements documented in [PROJECT_STATUS.md](PROJECT_STATUS.md)

---

## Compliance & Security

- ✓ No hardcoded secrets (environment variables only)
- ✓ `.env.example` documents required variables (no values)
- ✓ `.gitignore` prevents accidental secret commits
- ✓ Official APIs only (no TOS violations)
- ✓ No browser automation or scraping
- ✓ Transaction-safe database operations (ACID)
- ✓ Token refresh prevents expiration during execution

---

**Phase 1 Status:** ✓ Complete  
**Ready for Phase 2:** ✓ Yes (pending your approval)

See [ARCHITECTURE_PHASE1.md](ARCHITECTURE_PHASE1.md) to begin review.
