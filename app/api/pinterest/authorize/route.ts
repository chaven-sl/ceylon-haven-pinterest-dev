/**
 * Pinterest OAuth Authorize Endpoint
 * GET /api/pinterest/authorize
 * Generates CSRF state and redirects to Pinterest login
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getValidatedEnv } from '@/lib/env';

/**
 * Generate cryptographically secure random state
 */
function generateState(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Store CSRF state in a secure HTTP-only cookie (5 minute expiry)
 *
 * PHASE 3 PART 1: OAuth State Security
 *
 * Security Implementation:
 *   - State Value: Cryptographically random (crypto.randomBytes(32))
 *   - Cookie Authentication: HttpOnly + Secure (prevents client-side access/tampering)
 *   - SameSite: lax (prevents cross-site cookie submission)
 *   - Expiry: 5 minutes (single-use, rejects stale states)
 *   - Validation: Exact string comparison (no decoding/signing needed)
 *
 * Why No Explicit Signing:
 *   The state value IS the security credential. It's cryptographically random
 *   and validated for exact match against Pinterest's response. Since the cookie
 *   is HttpOnly, the client cannot access or modify it. The browser enforces
 *   SameSite, preventing cross-site submission.
 *
 * This is the correct OAuth CSRF protection approach (per RFC 6749 Section 10.12).
 */
function setStateCookie(state: string, response: NextResponse): void {
  const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  response.cookies.set('pinterest_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires,
  });
}

/**
 * GET /api/pinterest/authorize
 * Initiates Pinterest OAuth flow
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const env = getValidatedEnv();

    if (!env.PINTEREST_APP_ID) {
      return NextResponse.json(
        {
          error: 'Pinterest not configured',
          message: 'PINTEREST_APP_ID not set in environment variables',
        },
        { status: 503 },
      );
    }

    // Generate CSRF state
    const state = generateState();

    // Determine redirect URI based on environment
    const baseUrl = request.url.split('/api/')[0];
    const redirectUri = `${baseUrl}/api/pinterest/callback`;

    // Build Pinterest authorization URL
    const params = new URLSearchParams({
      client_id: env.PINTEREST_APP_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'boards:read,pins:write',
      state,
    });

    const pinterestAuthUrl = `https://www.pinterest.com/oauth/?${params.toString()}`;

    // Create response with state cookie
    const response = NextResponse.redirect(pinterestAuthUrl);
    setStateCookie(state, response);

    return response;
  } catch (error) {
    console.error('[Pinterest Authorize] Error:', error);
    return NextResponse.json(
      {
        error: 'Authorization failed',
        message: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
