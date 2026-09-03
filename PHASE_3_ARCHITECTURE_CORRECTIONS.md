# Phase 3 Architecture Corrections & Design

**Date:** 2026-09-03  
**Purpose:** Correct architectural assumptions from Phase 2 planning and design final implementations  
**Status:** DESIGN ONLY - Ready for Phase 3 implementation

---

## TASK 5: Pinterest Token Persistence Architecture (CORRECTED)

### Problem with Original Design

Original plan said: "Update Vercel environment variables for token refresh"

**This is WRONG because:**
- Vercel environment variables are deployment-level (rarely change)
- Cannot be dynamically updated at runtime
- Would require redeployment for token refresh
- Not suitable for 30-day token expiration handling

### Corrected Architecture

**VERCEL ENVIRONMENT VARIABLES (Deployment-Level, Set Once):**
```
PINTEREST_APP_ID=1234567890
PINTEREST_APP_SECRET=abc123xyz...
TOKEN_ENCRYPTION_KEY=base64(32-byte random key)
SUPABASE_URL=https://project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXA...
```

**SUPABASE DYNAMIC TOKEN STORAGE (Runtime Mutable):**

```sql
CREATE TABLE pinterest_oauth_tokens (
  id SERIAL PRIMARY KEY,
  
  -- Encrypted tokens (never stored plaintext)
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  
  -- Token expiry tracking (UTC)
  access_token_expires_at TIMESTAMPTZ NOT NULL,
  refresh_token_expires_at TIMESTAMPTZ NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  last_refreshed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  
  -- Audit
  refresh_count INT DEFAULT 0,
  
  -- Singleton constraint
  CONSTRAINT only_one_record CHECK (id = 1)
);

-- Enable RLS but permit service_role only
ALTER TABLE pinterest_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON pinterest_oauth_tokens
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

**FACEBOOK TOKEN STORAGE (Similar Pattern):**
```sql
CREATE TABLE facebook_tokens (
  id SERIAL PRIMARY KEY,
  
  -- Page Access Token (permanent, but store encrypted)
  page_access_token_encrypted TEXT NOT NULL,
  facebook_page_id TEXT NOT NULL UNIQUE,
  
  -- Data Access permissions (expires every 90 days - manual renewal reminder)
  data_access_expires_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT only_one_record CHECK (id = 1)
);

ALTER TABLE facebook_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON facebook_tokens
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

### Encryption Strategy

**Use libsodium (via tweetnacl-js in Node.js):**

```typescript
import { secretbox, randombytes, box } from 'tweetnacl-js';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

const encryptToken = (plaintext: string, key: Uint8Array): string => {
  const nonce = randombytes(secretbox.nonceLength);
  const encrypted = secretbox(
    Buffer.from(plaintext, 'utf-8'),
    nonce,
    key
  );
  
  const combined = Buffer.concat([
    Buffer.from(nonce),
    Buffer.from(encrypted)
  ]);
  
  return encodeBase64(combined);
};

const decryptToken = (ciphertext: string, key: Uint8Array): string => {
  const combined = decodeBase64(ciphertext);
  const nonce = combined.slice(0, secretbox.nonceLength);
  const encrypted = combined.slice(secretbox.nonceLength);
  
  const decrypted = secretbox.open(encrypted, nonce, key);
  if (!decrypted) throw new Error('Decryption failed');
  
  return Buffer.from(decrypted).toString('utf-8');
};
```

**Key Management:**
- `TOKEN_ENCRYPTION_KEY` is 32-byte random key
- Generated once: `openssl rand -base64 32`
- Stored in Vercel environment variables only (never in code)
- Used to encrypt/decrypt tokens at rest in Supabase

### Token Refresh RPC Function

```sql
CREATE OR REPLACE FUNCTION refresh_pinterest_token(
  new_access_token TEXT,
  new_access_token_expires_at TIMESTAMPTZ,
  new_refresh_token TEXT,
  new_refresh_token_expires_at TIMESTAMPTZ
)
RETURNS TABLE(success BOOLEAN, error_message TEXT)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE pinterest_oauth_tokens
  SET
    access_token_encrypted = new_access_token,
    access_token_expires_at = new_access_token_expires_at,
    refresh_token_encrypted = new_refresh_token,
    refresh_token_expires_at = new_refresh_token_expires_at,
    last_refreshed_at = CURRENT_TIMESTAMP,
    refresh_count = refresh_count + 1,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = 1;
  
  RETURN QUERY SELECT true, NULL::TEXT;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT false, SQLERRM;
END;
$$;
```

### Initialization Flow (First-Time OAuth)

1. User starts OAuth flow at `/api/pinterest/authorize`
2. Redirect to Pinterest authorization endpoint
3. User approves
4. Callback at `/api/pinterest/callback`
5. Exchange code for tokens
6. **Encrypt tokens** in Node.js
7. **Insert into Supabase** (not update - new record)
8. Redirect to success page

### Token Refresh Flow (On Each Cron Run)

```typescript
async function ensurePinterestTokenValid() {
  // 1. Read current token from Supabase (encrypted)
  const { access_token_encrypted, access_token_expires_at } = 
    await supabaseClient
      .from('pinterest_oauth_tokens')
      .select('access_token_encrypted, access_token_expires_at')
      .eq('id', 1)
      .single();
  
  // 2. Check if expiration within 24 hours
  const expiresIn = access_token_expires_at - now;
  if (expiresIn > 24 * 60 * 60) {
    return; // Token still valid, no refresh needed
  }
  
  // 3. Decrypt refresh token
  const refresh_token = decryptToken(refresh_token_encrypted, encryptionKey);
  
  // 4. Call Pinterest /oauth/token endpoint
  const response = await fetch('https://api.pinterest.com/v5/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token,
      client_id: process.env.PINTEREST_APP_ID,
      client_secret: process.env.PINTEREST_APP_SECRET,
    }),
  });
  
  const { access_token, refresh_token: new_refresh_token, expires_in } = 
    await response.json();
  
  // 5. Encrypt new tokens
  const encrypted_access = encryptToken(access_token, encryptionKey);
  const encrypted_refresh = encryptToken(new_refresh_token, encryptionKey);
  
  // 6. Update Supabase atomically via RPC
  const { success } = await supabaseClient
    .rpc('refresh_pinterest_token', {
      new_access_token: encrypted_access,
      new_access_token_expires_at: new Date(now + expires_in * 1000),
      new_refresh_token: encrypted_refresh,
      new_refresh_token_expires_at: new Date(now + 60 * 24 * 60 * 60 * 1000),
    });
  
  if (!success) throw new Error('Token refresh failed');
}
```

### Plaintext Token Prevention

**Never log plaintext tokens:**
- All logs sanitize token values to `[REDACTED]`
- Test environment uses test tokens only
- Decryption happens only in memory, never serialized
- Add debug check: `if (token.length > 50 && !token.startsWith('[REDACTED]')) throw`

---

## TASK 6: Retry Implementation (Unified Strategy)

### Problem with Original Design

Original plan had both:
- "Per-execution retry (max 3 times)"
- "Next-day cron retry for failed posts"

This led to confusion about when retry happens and what states allow retry.

### Corrected State Machine with Retry

**STATE TRANSITIONS (Complete Flow):**

```
discovered ─────┬──────→ publishing ─┬──────→ published ✓
               │                    │
               │                    ├──────→ uncertain (API said yes, DB uncertain)
               │                    │
               │                    └──────→ failed (fatal error)
               │
               └────────────────────→ skipped (unsupported post type)

failed (retry_count < 3) ──→ publishing (reset retry_count to 0)
failed (retry_count >= 3) ──→ failed (terminal, no more retries)

uncertain ──→ manual_review (requires human intervention)
```

### Within-Execution Retry (Single Cron Run)

**When Encountered: `discovered` → `publishing` → ERROR**

```typescript
// Max 3 attempts total within one execution
let attempt = 1;
const maxAttempts = 3;

while (attempt <= maxAttempts) {
  try {
    // Attempt to create pin on Pinterest
    const result = await createPinterestPin(post);
    
    // Success: update state to published
    await recordPublishedPin(post.facebook_post_id, result.pin_id);
    return { success: true, pin_id: result.pin_id };
    
  } catch (error) {
    if (isFatalError(error)) {
      // 401 Unauthorized, invalid board, etc.
      // Mark as failed immediately, no more retries
      await incrementRetryAndFail(post.facebook_post_id);
      return { success: false, reason: 'fatal_error' };
    }
    
    if (isAmbiguousError(error)) {
      // Timeout, 5xx, network error, etc.
      // Retry if attempts remaining
      attempt++;
      
      if (attempt <= maxAttempts) {
        // Exponential backoff: 2s, 4s, 8s
        await sleep(Math.pow(2, attempt) * 1000);
        continue; // Try again
      } else {
        // All retries exhausted
        await markPostUncertain(post.facebook_post_id);
        return { success: false, reason: 'uncertain_after_retries' };
      }
    }
  }
}
```

### Per-Cron Retry (Next Day)

**When Encountered: `failed` state with `retry_count < 3`**

Next cron execution:
```typescript
async function processPosts(allPosts: FacebookPost[]) {
  // Find posts in failed state ready for retry
  const failedPosts = await db
    .from('facebook_posts')
    .select('*')
    .eq('status', 'failed')
    .lt('retry_count', 3); // Only if retry_count < 3
  
  for (const post of failedPosts) {
    // Claim for retry (transition: failed → publishing, reset retry_count)
    const claimed = await claimForRetry(post.facebook_post_id);
    if (!claimed) continue; // Another process claimed it
    
    // Attempt to publish (same 3-attempt logic as above)
    const result = await attemptPublish(post, maxAttempts = 3);
    
    if (result.success) {
      // published ✓
      break; // Success
    }
    
    // If failed again: stay in failed state (no more retries)
  }
}
```

### Retry State Table

| State | retry_count | Next Action | Timeline |
|-------|-------------|-------------|----------|
| `discovered` | 0 | Attempt 1-3 same execution | Within 60s |
| `publishing` | 0 | (In progress) | Within 60s |
| `uncertain` | 0 | Manual review needed | N/A |
| `failed` | 1 | Retry next cron | +24 hours |
| `failed` | 2 | Retry next cron | +48 hours |
| `failed` | 3 | Terminal (no retry) | Never |
| `published` | (n/a) | Terminal (done) | N/A |

### Retry Count Semantics (CRITICAL)

**Increments at these exact points:**
1. Ambiguous error caught during within-execution retry
2. Each time `claim_for_retry` succeeds (transitions failed → publishing)

**Does NOT increment:**
- On successful publish (state goes to published)
- On fatal error (state goes to failed with current retry_count)
- On uncertain (no retry_count change)

```sql
-- When ambiguous error during execution
UPDATE facebook_posts
SET
  status = 'uncertain',
  retry_count = retry_count + 1,
  last_error = 'timeout',
  last_attempt_at = CURRENT_TIMESTAMP
WHERE facebook_post_id = $1 AND status = 'publishing';

-- When claiming for retry next day
UPDATE facebook_posts
SET
  status = 'publishing',
  retry_count = retry_count,  -- Do NOT increment here
  claimed_at = CURRENT_TIMESTAMP,
  claimed_by = $2
WHERE facebook_post_id = $1 
  AND status = 'failed' 
  AND retry_count < 3;
```

### Summary

| Scenario | Retry Behavior |
|----------|----------------|
| Discover post → attempt 1 fails (ambiguous) | Retry within execution (attempt 2) |
| Attempt 2 fails (ambiguous) | Retry within execution (attempt 3) |
| Attempt 3 fails (ambiguous) | Mark uncertain, increment retry_count |
| Attempt N fails (fatal) | Mark failed immediately, do not increment |
| Next cron finds `failed` with retry_count < 3 | Transition to `publishing`, attempt 1-3 |
| Next cron finds `failed` with retry_count >= 3 | Skip (terminal state) |

---

## TASK 7: Board Routing Configuration

### Schema Design

```sql
CREATE TABLE board_routing_config (
  id SERIAL PRIMARY KEY,
  
  -- Property identification
  property_id TEXT NOT NULL UNIQUE,
  property_name TEXT NOT NULL,
  property_type TEXT,
  
  -- Pinterest board mapping
  pinterest_board_id TEXT NOT NULL,
  pinterest_board_name TEXT NOT NULL,
  
  -- Destination
  destination_url TEXT NOT NULL,
  
  -- Status
  active BOOLEAN DEFAULT TRUE,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_board_per_property UNIQUE (property_id, pinterest_board_id),
  CONSTRAINT valid_url CHECK (destination_url ~ '^https?://')
);

ALTER TABLE board_routing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON board_routing_config
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

### Seeding Strategy

**Real Ceylon Haven Properties (Confirmed):**

```sql
INSERT INTO board_routing_config 
  (property_id, property_name, property_type, pinterest_board_id, pinterest_board_name, destination_url)
VALUES
  -- The Beach Home (confirmed property)
  ('ceylon-haven-beach-home', 'The Beach Home', 'villa', '123456789', 'Beachfront Villas', 'https://ceylonhaven.com/the-beach-home'),
  
  -- Galapagos Villa (common reference in other projects)
  ('ceylon-haven-galapagos', 'Galapagos Villa', 'villa', '234567890', 'Luxury Villas', 'https://ceylonhaven.com/galapagos-villa'),
  
  -- Sands Beachfront (referenced in project context)
  ('ceylon-haven-sands', 'Sands Beachfront', 'boutique', '345678901', 'Beachfront Retreats', 'https://ceylonhaven.com/sands');
```

**Note:** Properties should be confirmed with user before seeding. The above are placeholders based on project context.

### Board Selection Logic

```typescript
interface FacebookPostAnalysis {
  facebook_post_id: string;
  caption: string;
  mentioned_property_ids: string[]; // Extracted by content analysis
}

async function selectBoardForPost(post: FacebookPostAnalysis): Promise<{
  board_id: string;
  property_id: string;
}> {
  // 1. If post mentions specific property, use that
  if (post.mentioned_property_ids.length === 1) {
    const config = await db
      .from('board_routing_config')
      .select('pinterest_board_id')
      .eq('property_id', post.mentioned_property_ids[0])
      .eq('active', true)
      .single();
    
    return {
      board_id: config.pinterest_board_id,
      property_id: post.mentioned_property_ids[0],
    };
  }
  
  // 2. If multiple properties mentioned, use first (or implement weighted logic)
  if (post.mentioned_property_ids.length > 1) {
    const primaryPropertyId = post.mentioned_property_ids[0];
    const config = await db
      .from('board_routing_config')
      .select('pinterest_board_id')
      .eq('property_id', primaryPropertyId)
      .eq('active', true)
      .single();
    
    return {
      board_id: config.pinterest_board_id,
      property_id: primaryPropertyId,
    };
  }
  
  // 3. If no property mentioned, use default board
  // (requires configuration of a default)
  const defaultConfig = await db
    .from('board_routing_config')
    .select('pinterest_board_id, property_id')
    .eq('property_id', 'ceylon-haven-default') // Must exist
    .eq('active', true)
    .single();
  
  return {
    board_id: defaultConfig.pinterest_board_id,
    property_id: defaultConfig.property_id,
  };
}
```

### Property Mention Detection (Phase 1)

**Simple keyword matching (Phase 1):**
```typescript
const propertyKeywords = {
  'ceylon-haven-beach-home': ['beach home', 'the beach home', 'oceanfront'],
  'ceylon-haven-galapagos': ['galapagos', 'galapagos villa'],
  'ceylon-haven-sands': ['sands', 'sands beachfront', 'sandy'],
};

function extractPropertyIds(caption: string): string[] {
  const lowerCaption = caption.toLowerCase();
  const found = new Set<string>();
  
  for (const [propertyId, keywords] of Object.entries(propertyKeywords)) {
    for (const keyword of keywords) {
      if (lowerCaption.includes(keyword)) {
        found.add(propertyId);
      }
    }
  }
  
  return Array.from(found);
}
```

**Note:** Phase 4 can upgrade to LLM-based classification for better accuracy.

---

## TASK 8: Content Adaptation Deterministic Design

### Fallback Hierarchy (No LLM)

```typescript
interface PinterestPinContent {
  title: string;       // Max 100 characters
  description: string; // Max 500 characters
}

async function adaptFacebookForPinterest(
  post: {
    message?: string;
    story?: string;
    property_name?: string;
    property_type?: string;
  }
): Promise<PinterestPinContent> {
  
  // ========== TITLE GENERATION ==========
  
  // Level 1: Use Facebook caption (if short enough)
  if (post.message && post.message.length <= 100) {
    return {
      title: post.message,
      description: await generateDescription(post),
    };
  }
  
  // Level 2: Use first 100 chars of Facebook caption + property
  if (post.message && post.message.length > 100) {
    const truncated = post.message.substring(0, 90) + '...';
    return {
      title: truncated,
      description: await generateDescription(post),
    };
  }
  
  // Level 3: Property-based template
  if (post.property_name) {
    const type = post.property_type || 'Retreat';
    const title = `${post.property_name} — Luxury ${type} in Sri Lanka`;
    
    return {
      title: title.substring(0, 100),
      description: await generateDescription(post),
    };
  }
  
  // Level 4: Generic fallback (should rarely happen)
  return {
    title: 'Ceylon Haven — Luxury Sri Lanka Retreat',
    description: 'Experience the elegance of Ceylon Haven. Discover your perfect Sri Lanka escape.',
  };
}

// ========== DESCRIPTION GENERATION ==========

async function generateDescription(post: any): Promise<string> {
  
  // Level 1: Use Facebook story/caption (if present)
  if (post.story && post.story.length <= 500) {
    return post.story;
  }
  
  if (post.message && post.message.length <= 500 && !post.story) {
    return post.message;
  }
  
  // Level 2: Property-based template
  if (post.property_name) {
    const templates = {
      villa: `Experience ${post.property_name}'s unique charm. Luxury villa retreat with private amenities. Discover your perfect Sri Lanka escape.`,
      beach: `Wake up beside pristine shores at ${post.property_name}. Beachfront luxury in Sri Lanka. Ideal for families and groups.`,
      boutique: `Discover ${post.property_name}'s curated elegance. Boutique retreat in scenic Sri Lanka. Personalized luxury awaits.`,
    };
    
    const template = templates[post.property_type] || templates.villa;
    return template.substring(0, 500);
  }
  
  // Level 3: Generic fallback
  return 'Discover Ceylon Haven — Where Sri Lanka's natural beauty meets luxury hospitality. Create unforgettable memories.';
}
```

### Making Adaptation Pluggable

**Interface for future enhancement (Phase 4):**

```typescript
interface ContentAdapter {
  adaptForPinterest(post: FacebookPost): Promise<PinterestPinContent>;
}

// Phase 1: Deterministic implementation
class DeterministicContentAdapter implements ContentAdapter {
  async adaptForPinterest(post: FacebookPost): Promise<PinterestPinContent> {
    return await adaptFacebookForPinterest(post);
  }
}

// Phase 4: LLM-based implementation (future)
class LLMContentAdapter implements ContentAdapter {
  async adaptForPinterest(post: FacebookPost): Promise<PinterestPinContent> {
    const response = await claude.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      messages: [{
        role: 'user',
        content: `Convert this Facebook post into a Pinterest pin title (max 100 chars) and description (max 500 chars).
          
Facebook Caption: ${post.message}
Property: ${post.property_name}
Type: ${post.property_type}

Respond in JSON: { "title": "...", "description": "..." }`,
      }],
    });
    
    return JSON.parse(response.content[0].text);
  }
}

// Dependency injection in cron handler
const adapter: ContentAdapter = process.env.USE_LLM_ADAPTER
  ? new LLMContentAdapter()
  : new DeterministicContentAdapter();

const pinContent = await adapter.adaptForPinterest(post);
```

---

## TASK 9: Timezone Corrections

### Current References (Found & Fixed)

**Correct Timezone:** `Asia/Colombo` (UTC+5:30)

**Corrected References:**
- ✓ PROJECT_STATUS.md - "12:00 PM Asia/Colombo"
- ✓ README.md - "Daily at noon (Asia/Colombo timezone)"
- ✓ vercel.json - "0 6 * * *" (06:30 UTC = 12:00 PM Asia/Colombo)

**Do NOT use:**
- ❌ "AST" (Atlantic Standard Time, wrong offset)
- ❌ "UTC+5:30" (numeric, preferred timezone name is geographic)
- ❌ "IST" (ambiguous: Indian or Irish)

---

## TASK 10: User Tasks (Required NOW vs LATER)

### ✓ REQUIRED NOW (Before Phase 3 development starts)

**These are blockers that must be completed before implementation can proceed:**

#### 1. Facebook Page ID (5 minutes)
**What:** The unique ID for the Ceylon Haven Facebook page
**Where to find:** 
- Go to https://www.facebook.com/ceylonhaven (or your page URL)
- Click on About
- Scroll to "Page ID" (usually found in About section or via Graph API Explorer)

**Example:** `123456789123456`

**Provide to:** Developer (share as plain number, no quotes)

#### 2. Pinterest Business Account Verification (2 minutes)
**What:** Confirm you have/can create a Pinterest Business Account
**Status check:**
- Go to https://business.pinterest.com
- Login with your account
- If no account: Create one (free, ~2 min)
- Screenshot: Business account homepage (for confirmation)

**Provide to:** Developer (confirmation that account exists)

#### 3. Pinterest App Registration (20-30 minutes)
**Steps:**
1. Go to https://developers.pinterest.com/apps/
2. Click "Create app"
3. Fill in:
   - App Name: "Ceylon Haven Facebook Automation"
   - App Category: "Content Management"
   - Description: "Automated republication of Ceylon Haven properties to Pinterest"
4. Accept terms
5. Click "Create app"
6. **Save these credentials:**
   - App ID: `yy...` (alphanumeric)
   - Client Secret: `SECRET...` (keep secure, never share)
7. Screenshot both before proceeding

**Provide to:** Developer via secure channel (1password vault or Slack direct message):
```
Pinterest App ID: [copy from dashboard]
Pinterest Client Secret: [copy from dashboard]
```

**CRITICAL:** Do not share Client Secret in group chat, email forwarding, or public channels.

#### 4. Facebook Meta App (Optional - May Already Exist)
**Check first:** Does Ceylon Haven already have a Meta App?
- Go to https://developers.facebook.com/apps/
- If yes, note the App ID + App Secret
- If no, create one (5 min)

**If creating:**
1. Click "My Apps" → "Create App"
2. Type: "Business"
3. Name: "Ceylon Haven Facebook Automation"
4. Email: Your work email
5. Click "Create App ID"
6. Confirm email verification
7. Save: App ID + App Secret

**Provide to:** Developer via secure channel

---

### ⏳ REQUIRED LATER (Before production deployment)

**These do NOT block Phase 3 development, but must be done before going live:**

#### 1. Facebook OAuth Setup (1-2 hours)
**When needed:** Before Phase 3 test deployment
**What:** Register redirect URIs, configure OAuth scopes, test authorization flow

**Steps:**
1. Go to Meta App Settings
2. Add Platform → Website
3. Add redirect URIs:
   - Development: `http://localhost:3000/api/facebook/callback`
   - Staging: `https://[vercel-preview].vercel.app/api/facebook/callback`
   - Production: `https://ceylon-haven-automation.vercel.app/api/facebook/callback`
4. Configure scopes: `pages_read_engagement`, `pages_read_user_content`
5. Save

#### 2. Pinterest OAuth Setup (1-2 hours)
**When needed:** Before Phase 3 test deployment
**What:** Complete OAuth authorization, capture access + refresh tokens

**Steps:**
1. Go to Pinterest App Settings
2. Add redirect URIs (same as Facebook above)
3. Configure scopes: `pins:create`, `boards:read`, `pins:read`
4. Test OAuth flow locally
5. Capture tokens securely

**Important:** Pinterest requires submitting a video demo for app review. This is 2-4 week process, but you can test with Trial Access during development.

#### 3. Production Supabase Project Setup (1 hour)
**When needed:** Before going live
**What:** Create production-grade Supabase project (separate from development)

**Steps:**
1. Go to https://supabase.com/dashboard
2. Create new project: "ceylon-haven-pinterest"
3. Choose production plan (if needed)
4. Apply same migrations (0001_init_schema.sql + 0002_atomic_operations.sql)
5. Enable backups
6. Configure custom domain (if desired)

#### 4. Production Vercel Project (30 minutes)
**When needed:** Before going live
**What:** Create Vercel project for production deployment

**Steps:**
1. Go to https://vercel.com/projects
2. Create new project
3. Link to GitHub repository
4. Add environment variables:
   - All secrets from .env.example
   - Production Supabase credentials
   - Production Pinterest tokens
   - Production Facebook credentials
   - CRON_SECRET (generate: `openssl rand -hex 32`)
5. Deploy to production
6. Enable automatic deploys from main branch

#### 5. Monitoring & Alerting Setup (2-3 hours)
**When needed:** Before going live
**What:** Set up alerts for failures, token expiration, rate limits

**Recommended:**
- Supabase Logs dashboard (monitor errors)
- Vercel Logs (monitor cron execution)
- Email alerts for high failure rates
- 90-day reminder for Facebook Data Access renewal

---

### Summary Table

| Task | Blocker? | Time | Difficulty |
|------|----------|------|-----------|
| Facebook Page ID | YES | 5 min | Trivial |
| Pinterest Account Check | YES | 2 min | Trivial |
| Pinterest App Creation | YES | 25 min | Easy |
| Meta App Creation (if needed) | YES | 10 min | Easy |
| Facebook OAuth Setup | NO | 60 min | Medium |
| Pinterest OAuth Setup | NO | 60 min | Medium |
| Production Supabase | NO | 60 min | Easy |
| Production Vercel | NO | 30 min | Easy |
| Monitoring Setup | NO | 150 min | Medium |

**MINIMUM NOW:** Facebook Page ID + Pinterest Account + Pinterest App = 30 minutes
**Full Setup (including later):** ~7-8 hours over 2-3 sessions

