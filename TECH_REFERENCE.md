# Technology Reference Guide

Quick reference for Phase 2 implementation. For full details, see ARCHITECTURE_PHASE1.md.

---

## Facebook Graph API

### Endpoint: Retrieve Page Posts

```
GET https://graph.facebook.com/v26/{PAGE_ID}/feed
Authorization: Bearer {PAGE_ACCESS_TOKEN}
Query Parameters:
  - fields=id,message,created_time,picture,images,permalink,link,attachments
  - limit=25 (max posts per call)
  - after={cursor} (for pagination)
```

**Current API Version:** v26 (released July 2026)

**Response Example:**
```json
{
  "data": [
    {
      "id": "1234567890_9876543210",
      "message": "Breakfast overlooking the ocean...",
      "created_time": "2026-09-03T10:30:00+0000",
      "picture": "https://platform.instagram.com/...",
      "permalink": "https://www.facebook.com/ceylonhaven/posts/9876543210",
      "link": "https://example.com"
    }
  ],
  "paging": {
    "cursors": {
      "before": "...",
      "after": "..."
    }
  }
}
```

### Token Refresh (Facebook)

**Status:** Page Access Tokens do NOT expire (permanent)  
**Data Access:** Permissions must be renewed every 90 days

**If token needs refresh:**
```
POST https://graph.facebook.com/v26/oauth/access_token
  grant_type=fb_exchange_token
  client_id={APP_ID}
  client_secret={APP_SECRET}
  fb_exchange_token={SHORT_LIVED_TOKEN}
```

---

## Pinterest API

### Endpoint: Create Pin

```
POST https://api.pinterest.com/v5/pins
Authorization: Bearer {PINTEREST_ACCESS_TOKEN}
Content-Type: application/json

Body:
{
  "title": "Beachfront Villa in Galle, Sri Lanka",
  "description": "Wake up beside the Indian Ocean...",
  "media_source": {
    "source_type": "image_url",
    "url": "https://example.com/image.jpg"
  },
  "board_id": "board_id_string",
  "link": "https://ceylonhaven.com/properties/the-beach-home"
}
```

**Important:** Use `media_source` object with `source_type: "image_url"`, not a top-level `image_url` field.

**Response Example:**
```json
{
  "id": "1234567890123456789",
  "created_at": "2026-09-03T10:35:22.000Z",
  "link": "https://www.pinterest.com/pin/1234567890123456789/",
  "title": "Beachfront Villa in Galle, Sri Lanka",
  "description": "Wake up beside the Indian Ocean...",
  "board_id": "board_id_string"
}
```

### Token Refresh (Pinterest)

**Access Token Lifespan:** 30 days  
**Refresh Token:** Continuous (60-day rolling refresh)

**Refresh Access Token:**
```
POST https://api.pinterest.com/v5/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
refresh_token={PINTEREST_REFRESH_TOKEN}
client_id={APP_ID}
client_secret={APP_SECRET}
```

**Response:**
```json
{
  "access_token": "new_access_token",
  "refresh_token": "new_refresh_token",
  "expires_in": 2592000,
  "token_type": "Bearer"
}
```

### Rate Limits

| Limit | Value | Applies To |
|-------|-------|-----------|
| Write Ops | 100/minute | POST/PUT/DELETE |
| Daily Limit | 1000/day | All operations |
| Burst Limit | 10 concurrent requests | All operations |

**At 1 pin/day:** 0.1% of limits (sustainable indefinitely)

### List Available Boards

```
GET https://api.pinterest.com/v5/user_profile/boards
Authorization: Bearer {PINTEREST_ACCESS_TOKEN}
Query Parameters:
  - bookmark={cursor} (pagination)
```

**Response:**
```json
{
  "items": [
    {
      "id": "board_id_123",
      "name": "Sri Lanka Villas",
      "url": "https://www.pinterest.com/..."
    }
  ]
}
```

---

## Supabase / PostgreSQL

### Connection String

```
postgresql://[user]:[password]@[host]:5432/[database]
```

Available from Supabase project settings.

### Environment Variables

```
SUPABASE_URL=https://[project-id].supabase.co
SUPABASE_ANON_KEY=[anon-key]  # Client-side code with RLS policies
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]  # Server-side only; bypasses RLS
SUPABASE_PASSWORD=[postgres-password]  # For migrations only; never in app
```

**CRITICAL:** Service role key must only be used server-side. Never expose in NEXT_PUBLIC_ or client-side code.

### Node Client (Server-Side)

```typescript
import { createClient } from "@supabase/supabase-js";

// Server-side: use service role key (has full access, bypasses RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // Never expose publicly
);
```

### Query Examples

```typescript
// Fetch existing Facebook post state
const { data, error } = await supabase
  .from("facebook_posts")
  .select("id, status")
  .eq("facebook_post_id", facebook_post_id)
  .single();

// Insert new Facebook post (discovered state)
const { data, error } = await supabase
  .from("facebook_posts")
  .insert({
    facebook_post_id: "1234567890_9876543210",
    facebook_permalink: "https://facebook.com/...",
    caption: "Post text...",
    image_url: "https://...",
    date_published: new Date(),
    status: "discovered"
  });

// Record Pinterest pin
const { data, error } = await supabase
  .from("pinterest_pins")
  .insert({
    facebook_post_id: "1234567890_9876543210",
    pinterest_pin_id: "1234567890123456789",
    pinterest_pin_url: "https://www.pinterest.com/pin/...",
    board_name: "Sri Lanka Villas",
    destination_url: "https://ceylonhaven.com/properties/the-beach-home",
    status: "published"
  });

// Log execution
const { data, error } = await supabase
  .from("execution_logs")
  .insert({
    execution_timestamp: new Date(),
    posts_fetched: 3,
    posts_new: 2,
    pins_created: 2,
    pins_failed: 0,
    duration_ms: 2500,
    status: "success"
  });
```

---

## Vercel Functions & Cron Jobs

### Route Handler Template (App Router)

```typescript
// app/api/cron/facebook-pinterest/route.ts

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs'; // Required for long-running functions

// Validate CRON_SECRET
function validateCronSecret(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;
  
  if (!authHeader || !expectedSecret) {
    console.error('Missing authorization header or CRON_SECRET');
    return false;
  }

  const token = authHeader.replace('Bearer ', '');
  return token === expectedSecret;
}

export async function POST(req: NextRequest) {
  try {
    // Validate CRON_SECRET
    if (!validateCronSecret(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Your orchestration logic here
    const result = await orchestratePipeline();
    
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Function error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

### Configure Cron in `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/facebook-pinterest",
      "schedule": "30 6 * * *"
    }
  ]
}
```

**Schedule Explanation:**
- `30 6 * * *` = Daily at 06:30 UTC (= 12:00 PM Asia/Colombo UTC+5:30)
- Minute: 30
- Hour: 6 (UTC)
- Day: * (every day)
- Month: * (every month)
- Day of Week: * (every day)

### Vercel Environment & Context

```typescript
// Access environment variables via process.env
const facebookAccessToken = process.env.FACEBOOK_ACCESS_TOKEN;
const cronSecret = process.env.CRON_SECRET;

// Vercel provides execution context
const deploymentId = process.env.VERCEL_DEPLOYMENT_ID;
const environment = process.env.VERCEL_ENV; // 'production', 'preview', 'development'
```

---

## Environment Variables (Required)

**Vercel Dashboard → Settings → Environment Variables**

Store these as environment variables (never hardcode, never use NEXT_PUBLIC_ prefix for secrets):

```
FB_GRAPH_API_VERSION=v26
FACEBOOK_PAGE_ID=1234567890
FACEBOOK_ACCESS_TOKEN=EAAx...
PINTEREST_APP_ID=12345
PINTEREST_APP_SECRET=abcdef...
PINTEREST_ACCESS_TOKEN=pinr_...
PINTEREST_REFRESH_TOKEN=pinr_...
SUPABASE_URL=https://project.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
CRON_SECRET=<32-byte-hex-string>
ENVIRONMENT=production
LOG_LEVEL=info
NODE_ENV=production
```

**Local Development (.env.local)**

```
FB_GRAPH_API_VERSION=v26
FACEBOOK_PAGE_ID=1234567890
FACEBOOK_ACCESS_TOKEN=EAAx...
PINTEREST_APP_ID=12345
PINTEREST_APP_SECRET=abcdef...
PINTEREST_ACCESS_TOKEN=pinr_...
PINTEREST_REFRESH_TOKEN=pinr_...
SUPABASE_URL=https://project.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGM...
CRON_SECRET=<32-byte-hex-string>
ENVIRONMENT=development
LOG_LEVEL=debug
NODE_ENV=development
```

**Security Notes:**
- Service role key only for server-side code (never expose to client)
- CRON_SECRET generated via: `openssl rand -hex 32`
- All secrets stored in Vercel UI, never in `.env.local` for production

---

## Error Codes & Recovery

### Facebook Graph API

| Status | Meaning | Recovery |
|--------|---------|----------|
| 200 | Success | — |
| 400 | Bad request (invalid token/fields) | Check token; verify page ID |
| 401 | Unauthorized (token expired/revoked) | Refresh token |
| 403 | Forbidden (insufficient permissions) | Request page permissions |
| 429 | Rate limit exceeded | Retry with exponential backoff |
| 500 | Server error | Retry with exponential backoff |

### Pinterest API

| Status | Meaning | Recovery |
|--------|---------|----------|
| 201 | Pin created | — |
| 400 | Invalid pin data (missing fields) | Validate before POST |
| 401 | Unauthorized (invalid token) | Refresh access token |
| 403 | Forbidden (rate limit or policy) | Retry later; check rate limits |
| 429 | Rate limit exceeded | Retry with backoff; check limits |
| 500 | Server error | Retry with exponential backoff |

### Supabase / PostgreSQL

| Error | Meaning | Recovery |
|-------|---------|----------|
| 23505 | Unique constraint violation | Post already processed; skip |
| 28P01 | Authentication failure | Check DB credentials |
| 08006 | Disconnection during query | Retry with connection pool |
| PGRST | Generic API error | Log and retry |

---

## Retry Strategy

**Default: Exponential Backoff**

```
Attempt 1: Immediate
Attempt 2: After 3 seconds
Attempt 3: After 9 seconds (3 * 3)

Max retries: 3
Max duration: ~15 seconds (safe within 60-second Vercel Hobby function timeout)
```

**Example Implementation:**

```typescript
async function retryWithBackoff(fn, maxRetries = 3) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const delay = Math.pow(3, i) * 1000; // 1s, 3s, 9s
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}
```

---

## Testing Against Real APIs (Development)

### Facebook Graph API - Development Mode

- Requires your personal account to have admin access to Ceylon Haven page
- Test API calls directly against your own page
- No app review required for internal testing
- Permissions automatically granted to page admins

**Test with curl:**
```bash
curl -X GET "https://graph.facebook.com/v19.0/{PAGE_ID}/feed?access_token={TOKEN}&fields=id,message,created_time"
```

### Pinterest API - Trial Access

- App starts in Trial access (sandbox)
- Created pins NOT visible publicly
- Same API as Standard access (no feature difference)
- Use for full development + testing
- Request Standard access when ready to go live

**Test with curl:**
```bash
curl -X POST "https://api.pinterest.com/v5/pins" \
  -H "Authorization: Bearer {ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Pin",
    "description": "Test",
    "image_url": "https://example.com/image.jpg",
    "board_id": "board_123",
    "link": "https://ceylonhaven.com"
  }'
```

---

## Useful Tools

- **Postman** — Test APIs interactively before coding
- **Meta Graph API Explorer** — https://developers.facebook.com/tools/explorer/
- **Pinterest API Sandbox** — https://developers.pinterest.com/
- **Supabase Studio** — View/edit database from web UI
- **Vercel CLI** — `vercel dev` to test functions locally; `vercel logs` to view function logs
- **cron-job.org** — Verify cron expression syntax before deployment

---

## Key Dates & Reminders

- **Facebook Data Access Renewal:** Every 90 days (manual or automatic)
- **Pinterest Token Refresh:** Every 30 days (automatic via refresh token)
- **Vercel Cron Timezone:** Always UTC; calculate local offset (06:30 UTC = 12:00 PM Asia/Colombo)
- **CRON_SECRET Rotation:** Consider rotating every 90 days for security
- **Supabase Auto-Pause:** Free tier pauses after 1 week inactivity (cron execution resets timer)

---

See ARCHITECTURE_PHASE1.md for full technical details.
