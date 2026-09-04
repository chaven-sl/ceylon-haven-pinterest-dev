/**
 * Pinterest OAuth Callback Endpoint
 * GET /api/pinterest/callback
 * Exchanges authorization code for access token and stores encrypted in Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidatedEnv } from '@/lib/env';
import { createPinterestTokenManager } from '@/lib/pinterest-token-manager';

/**
 * GET /api/pinterest/callback?code=...&state=...
 * Handles Pinterest OAuth redirect
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Check for user denial or errors
    if (error) {
      return NextResponse.json(
        {
          error: 'Pinterest authorization denied',
          details: errorDescription || error,
        },
        { status: 401 },
      );
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.json(
        {
          error: 'Invalid callback',
          message: 'Missing code or state parameter',
        },
        { status: 400 },
      );
    }

    // Verify CSRF state
    const storedState = request.cookies.get('pinterest_oauth_state')?.value;
    if (!storedState || storedState !== state) {
      return NextResponse.json(
        {
          error: 'CSRF validation failed',
          message: 'State mismatch or expired',
        },
        { status: 403 },
      );
    }

    // Get environment variables
    const env = getValidatedEnv();

    if (!env.PINTEREST_APP_ID || !env.PINTEREST_APP_SECRET || !env.TOKEN_ENCRYPTION_KEY) {
      return NextResponse.json(
        {
          error: 'Server not configured',
          message: 'Pinterest OAuth credentials not available',
        },
        { status: 503 },
      );
    }

    // Determine redirect URI (must match what was sent to Pinterest)
    const baseUrl = request.url.split('/api/')[0];
    const redirectUri = `${baseUrl}/api/pinterest/callback`;

    // Exchange code for tokens
    const tokensResponse = await exchangeAuthorizationCode(
      code,
      env.PINTEREST_APP_ID,
      env.PINTEREST_APP_SECRET,
      redirectUri,
    );

    // Store encrypted tokens in Supabase
    const tokenManager = createPinterestTokenManager();
    const expiresAtTime = new Date(Date.now() + tokensResponse.expires_in * 1000);
    const refreshExpiresAtTime = new Date(Date.now() + tokensResponse.refresh_token_expires_in * 1000);

    await tokenManager.insertTokenState({
      accessToken: tokensResponse.access_token,
      refreshToken: tokensResponse.refresh_token,
      accessTokenExpiresAt: expiresAtTime,
      refreshTokenExpiresAt: refreshExpiresAtTime,
    });

    // Return success response
    const response = NextResponse.json({
      success: true,
      message: 'Pinterest authorization complete. Tokens securely stored.',
      expiresIn: tokensResponse.expires_in,
      scope: tokensResponse.scope,
    });

    // Clear state cookie
    response.cookies.delete('pinterest_oauth_state');

    return response;
  } catch (error) {
    console.error('[Pinterest Callback] Error:', error);
    return NextResponse.json(
      {
        error: 'Token exchange failed',
        message: (error as Error).message,
      },
      { status: 500 },
    );
  }
}

/**
 * Exchange Pinterest authorization code for access and refresh tokens
 */
async function exchangeAuthorizationCode(
  code: string,
  appId: string,
  appSecret: string,
  redirectUri: string,
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_token_expires_in: number;
  scope: string;
  token_type: string;
}> {
  // Build Basic Auth header
  const credentials = Buffer.from(`${appId}:${appSecret}`).toString('base64');

  const response = await fetch('https://api.pinterest.com/v5/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      continuous_refresh: 'true',
    }).toString(),
  });

  if (!response.ok) {
    const errorData = (await response.json()) as Record<string, string>;
    throw new Error(`Token exchange failed (${response.status}): ${errorData['error_description'] || 'unknown error'}`);
  }

  return await response.json();
}
