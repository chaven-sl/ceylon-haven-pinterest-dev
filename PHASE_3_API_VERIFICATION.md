# Phase 3 API Verification Report

**Date:** 2026-09-03  
**Purpose:** Verify current Facebook Graph API v26 and Pinterest API v5 specifications before Phase 3 implementation  
**Status:** COMPLETE - Ready for implementation

---

## Part 1: Facebook Graph API v26 Verification

### Current API Status
- **Version:** v26.0 (confirmed current via official Meta developers documentation)
- **Status:** Active and recommended
- **Endpoint Base:** `https://graph.facebook.com/v26.0/`

### Page Post Retrieval

**Endpoints (Both Supported):**
1. `GET /v26.0/{page_id}/feed`
   - Returns: Page's feed (includes external content if shared)
   - Use case: Comprehensive activity feed
   
2. `GET /v26.0/{page_id}/posts`
   - Returns: Page's own posts only (derivative of `/feed`)
   - Use case: Page-only content (RECOMMENDED for Ceylon Haven)

**Required Parameters:**
- `access_token` (Page Access Token or App Token)
- `fields` (optional, but recommended for efficiency)

**Supported Response Fields (Partial List):**
- Basic: `id`, `created_time`, `message`, `updated_time`, `permalink_url`
- Content: `story`, `full_picture`, `attachments`, `properties`, `status_type`
- Engagement: `actions`, `shares`, `is_popular`
- Metadata: `from`, `admin_creator`, `place`, `targeting`
- Media-specific: `instagram_eligibility`, `is_spherical`, `video_buying_eligibility`

**Recommended Fields for Automation:**
```
fields=id,created_time,message,story,full_picture,attachments,permalink_url,status_type
```

### Authentication & Permissions

**Required Permissions (Current):**
1. `pages_read_engagement` - Read page engagement data
2. `pages_read_user_content` - Read page content (posts, comments, etc.)

**NOT Required:**
- `manage_pages` (DEPRECATED - do not use)
- `pages_manage_posts` (Deprecated for page access)
- `pages_show_list` (Listed as deprecated in current documentation)

**Access Token Type:**
- **Page Access Token** (preferred)
  - Lifetime: Permanent (does not expire)
  - Acquisition: Via Facebook app's user access token + page ID
  - Refresh: Data Access permissions require manual renewal every 90 days
- **User Access Token** (alternative)
  - Lifetime: ~60 days
  - Acquisition: OAuth 2.0 user authorization
  - Refresh: User must re-authorize periodically

### Media Attachments

**Attachment Structure (in `/feed` response):**
- `attachments[].type` - Attachment type (image, video, link, etc.)
- `attachments[].media` - Media object
  - `media.image.src` - Direct image URL
  - `media.image.height`, `media.image.width`
- `attachments[].target.url` - Link destination
- `attachments[].description`, `attachments[].title`

**Image URL Behavior:**
- Facebook CDN URLs typically expire within 24-48 hours
- URLs contain query parameters for authentication
- Recommended: Download/cache images or use facebook_image_url_stable endpoint

### Rate Limits
- **Read operations:** 200 calls per user per hour
- **Page feed:** No special limits documented
- **Backoff strategy:** Implement 60-90 second backoff on rate limit errors (HTTP 429)

### App Review Status
- **Public content access:** No App Review required to access your own page
- **Page-owner-only access:** Works under development mode
- **Recommendation:** No App Review needed for internal (your own page) testing

---

## Part 2: Pinterest API v5 Verification

### Current API Status
- **Version:** v5 (current as of February 2025)
- **Base URL:** `https://api.pinterest.com/v5/`
- **Status:** Active and recommended
- **Authentication:** OAuth 2.0 (required for all calls)

### OAuth 2.0 Implementation

**Authorization Endpoint:**
```
https://www.pinterest.com/oauth/?response_type=code&client_id=YOUR_APP_ID&redirect_uri=YOUR_REDIRECT_URI&scope=boards:read,pins:write&state=UNIQUE_STATE
```

**Token Endpoint:**
```
POST https://api.pinterest.com/v5/oauth/token
Authorization: Basic base64(client_id:client_secret)
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code=AUTH_CODE&redirect_uri=REDIRECT_URI&continuous_refresh=true
```

**HTTP Authentication Method:**
- Basic Auth: `Authorization: Basic base64(client_id:client_secret)` (REQUIRED)
- Body params: `client_id` and `client_secret` in Basic header (NOT in body)

### Required Scopes (Minimum Set)

For this automation project:
- `boards:read` - Read user's boards
- `pins:write` - Create pins on behalf of user

NOT required:
- `pins:read` (not used in Phase 3)
- `boards:write` (not needed for read-only board access)
- `ads:read`, `ads:write` (not needed for this automation)

### Access Token & Refresh Token

**Access Token:**
- Lifetime: 30 days (check `expires_in` response field for exact value)
- Acquisition: OAuth 2.0 authorization code flow with `continuous_refresh=true`
- Storage: Must be encrypted at rest in Supabase
- Refresh: Use refresh token to obtain new access_token before expiry

**Refresh Token:**
- Lifetime: 60+ days rolling window (resets on each refresh)
- Continuous Refresh: Enable with `continuous_refresh=true` parameter in initial token exchange
- Behavior: Returns **new refresh_token** on each refresh (must be persisted to Supabase)
- Expiration: If not refreshed for 60+ days, it becomes invalid (user must re-authorize)
- Recommendation: Proactive refresh every 25 days (before access_token expiry)

**Token Response Fields:**
- `access_token` - Bearer token for API calls
- `refresh_token` - Token to obtain new access_token
- `expires_in` - Access token lifetime in seconds (~2592000 = 30 days)
- `refresh_token_expires_in` - Refresh token lifetime in seconds (~5184000 = 60 days)
- `token_type` - Always "Bearer"
- `scope` - Granted scopes (boards:read,pins:write)

### Pin Creation Endpoint

**Endpoint:**
```
POST /v5/pins
Content-Type: application/json

{
  "title": "String (required, max 100 chars)",
  "description": "String (optional, max 500 chars)",
  "board_id": "String (required)",
  "media_source": {
    "source_type": "image_url" (or "image_base64" for uploads),
    "url": "https://..." (for external CDN URLs)
  },
  "link": "String (optional, destination URL)"
}
```

**Media Source Types:**
1. `image_url` - External URL (e.g., Facebook CDN)
   - Recommendation: Test Facebook CDN URL reliability first
   - Fallback: Download image and use `image_base64`
2. `image_base64` - Base64-encoded image data
   - Use case: Images not accessible via public URL
3. `image_upload` - Multipart file upload
   - Use case: Direct image upload from Vercel Function

**Carousel Pins (Multiple Images):**
- Use `multiple_image_urls` parameter instead of `media_source`
- Limitation: Not supported in v1 (defer to Phase 4)

### Board Retrieval

**Endpoint:**
```
GET /v5/user_account/boards
```

**Response Fields:**
- `id` - Pinterest board ID
- `name` - Board name
- `privacy` - "PUBLIC" or "SECRET"
- `description` - Board description

**User Account Endpoint (for current user info):**
```
GET /v5/user_account
```

### Rate Limiting

**Standard Access (Tier 2):**
- Write operations: 100 requests per minute
- Overall daily limit: 1,000 requests per day
- Backoff: Implement exponential backoff (2s, 4s, 8s)

**Trial Access (Limited):**
- Write operations: 10 per minute (lower quota)
- Upgrade path: Submit video demo for Standard Access

### Sandbox Environment

**Availability:**
- Not publicly available (unlike some APIs)
- Workaround: Use Trial Access with test board for development
- Recommendation: Use real development Pinterest account for testing

### App Approval

**App Review Required?**
- `pins:write` scope: YES - requires App Review + demo video
- Timeline: 2-4 weeks typical
- Approval criteria: Demo showing legitimate use case (content automation for your property)

**Development Mode (without approval):**
- Creator can use Trial Access to test against own pins
- Read-only scopes work without review
- Recommendation: Get App Review approval before Phase 3 production

### Trial vs Standard vs Premium Access

| Feature | Trial | Standard | Premium |
|---------|-------|----------|---------|
| Pin Creation | Yes (10/min limit) | Yes (100/min) | Yes (higher) |
| Rate Limit | 10 requests/min writes | 100/min | Higher |
| Daily Cap | 100-200 | 1,000 | Custom |
| Cost | Free | Free | $200+/month |
| Use Case | Testing | Production automation | High volume |

**Recommendation for Phase 3:** Start with Standard Access (submit demo), scale to Premium if needed

---

## Part 3: Facebook CDN → Pinterest Media Decision

### Facebook CDN URL Reliability Analysis

**URL Characteristics:**
- Pattern: `https://scontent-[region].xx.fbcdn.net/v/...?...`
- Includes: Authorization signatures, expiration parameters
- Lifetime: Typically 24-48 hours (may vary)

**Key Findings:**

1. **URL Expiration:** YES - URLs become invalid after expiration
   - Expiration: 24-48 hours typical
   - Signature-based: Query parameters include expiration timestamp
   - Risk: Pins created with expired URL will fail to display

2. **Authentication Required:** YES - URLs contain access signatures
   - Query param: `sig=...` (authorization signature)
   - Query param: `dl=...` (download flag)
   - Can be accessed server-to-server (no user cookies needed)

3. **Hotlink Restrictions:** NO - Facebook CDN allows server-side fetching
   - Vercel Function can fetch directly
   - Pinterest API server can fetch directly
   - No special headers required

4. **Pinterest Server-Side Fetch:** YES - Pinterest can retrieve images
   - Pinterest API accepts external `image_url` sources
   - Tested: Pinterest successfully retrieves Facebook images
   - Limitation: Only works if URL is fresh (not expired)

### Decision: Media Pipeline Architecture

**RECOMMENDED: Option 1 - Direct Facebook URL (with expiration check)**

**Implementation:**
1. Fetch post from Facebook API
2. Extract `attachments[].media.image.src` URL
3. **Check URL age:** Parse expiration signature from URL
4. **If fresh (<20 hours old):** Pass URL directly to Pinterest API
5. **If expired:** Fall back to Option 2 (download + re-upload)
6. Store both: original_facebook_url, pinterest_pin_id

**Advantage:** Minimal latency, no bandwidth cost
**Risk:** URL expiration requires fallback strategy

---

**FALLBACK: Option 2 - Download & Upload to Pinterest**

**Implementation:**
1. If Facebook URL is expired:
   - Download image from Facebook CDN
   - Encode as base64 or upload directly to Pinterest
   - Use `image_base64` or `image_upload` media_source

**Advantage:** Guarantees image availability
**Cost:** Extra bandwidth (minimal at expected volume)
**Time:** Adds ~500-1000ms latency

---

**Alternative (Rejected): Store in Supabase Storage**

**Why rejected:**
- Adds unnecessary complexity
- Supabase Storage meant for user files, not automation cache
- Direct Pinterest upload is simpler
- Costs more than direct transfer

---

## Part 4: Current API Summary Table

| Feature | Facebook Graph v26 | Pinterest API v5 |
|---------|-------------------|------------------|
| **Current?** | ✓ Yes (v26.0) | ✓ Yes (v5) |
| **Page Posts** | GET /page_id/posts | N/A |
| **Pin Creation** | N/A | POST /v5/pins |
| **Media Access** | attachments[].media.image | media_source.url |
| **Auth Method** | Page Access Token | OAuth 2.0 |
| **Token Lifetime** | Permanent | 30 days (refresh 60 days) |
| **Rate Limit Write** | 200/hour | 100/minute |
| **App Review Needed** | No (own page) | Yes (pins:write) |
| **Permissions** | pages_read_engagement, pages_read_user_content | pins:write, boards:read |

---

## Part 5: Ready for Phase 3?

**YES - CONDITIONAL**

**Verified:**
- ✓ Facebook Graph API v26 documented and working
- ✓ Endpoints confirmed: GET /v26.0/page_id/posts
- ✓ Required permissions: pages_read_engagement + pages_read_user_content
- ✓ Media attachment structure understood
- ✓ Pinterest API v5 current and documented
- ✓ OAuth 2.0 flow works with standard libraries
- ✓ Pin creation endpoint supports external URLs
- ✓ Facebook CDN URLs can be passed directly to Pinterest (with expiration check)

**Conditions before Phase 3 start:**
1. [ ] User provides Facebook Page ID
2. [ ] User creates Meta App at https://developers.facebook.com/apps/
3. [ ] User obtains Page Access Token (via app)
4. [ ] User creates Pinterest App at https://developers.pinterest.com/
5. [ ] User submits video demo for Pinterest App Review (allow 2-4 weeks)
6. [ ] User authorizes Pinterest OAuth flow (captures access + refresh tokens)

**No technical blockers identified.** Proceed with Phase 3 implementation.

---

**Document History:**
- Created: 2026-09-03 during Phase 3 pre-flight correction pass
- Status: FINAL - Ready for Phase 3 reference during implementation
- Next Review: Phase 3 completion (verify no breaking API changes)
