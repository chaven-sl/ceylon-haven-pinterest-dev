/**
 * Pinterest Token Manager
 * Handles OAuth token lifecycle: load, validate, refresh, and persist
 * All tokens stored encrypted in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { getValidatedEnv } from './env';
import { encryptToken, decryptToken, validateEncryptionKey } from './encryption';

export interface PinterestTokenState {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

export interface TokenRefreshRequest {
  grantType: 'authorization_code' | 'refresh_token';
  code?: string; // For authorization_code flow
  refreshToken?: string; // For refresh_token flow
  redirectUri?: string; // For authorization_code flow
}

/**
 * Response from Pinterest OAuth token endpoint
 */
interface PinterestOAuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_token_expires_in: number;
  scope: string;
  token_type: string;
}

export class PinterestTokenManager {
  private supabaseUrl: string;
  private supabaseServiceRoleKey: string;
  private encryptionKey: string;
  private appId: string;
  private appSecret: string;

  constructor(
    supabaseUrl: string,
    supabaseServiceRoleKey: string,
    encryptionKey: string,
    appId: string,
    appSecret: string,
  ) {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Supabase credentials are required');
    }

    if (!validateEncryptionKey(encryptionKey)) {
      throw new Error('TOKEN_ENCRYPTION_KEY must be a valid base64-encoded 32-byte key');
    }

    if (!appId || !appSecret) {
      throw new Error('PINTEREST_APP_ID and PINTEREST_APP_SECRET are required');
    }

    this.supabaseUrl = supabaseUrl;
    this.supabaseServiceRoleKey = supabaseServiceRoleKey;
    this.encryptionKey = encryptionKey;
    this.appId = appId;
    this.appSecret = appSecret;
  }

  /**
   * Get current Pinterest OAuth token state from Supabase
   * Decrypts tokens for use in API calls
   */
  async getTokenState(): Promise<PinterestTokenState | null> {
    const client = createClient(this.supabaseUrl, this.supabaseServiceRoleKey);

    try {
      const { data, error } = await client.from('pinterest_oauth_tokens').select('*').eq('id', 1).single();

      if (error || !data) {
        // No tokens stored yet
        return null;
      }

      return {
        accessToken: decryptToken(data.access_token_encrypted, this.encryptionKey),
        refreshToken: decryptToken(data.refresh_token_encrypted, this.encryptionKey),
        accessTokenExpiresAt: new Date(data.access_token_expires_at),
        refreshTokenExpiresAt: new Date(data.refresh_token_expires_at),
      };
    } catch (error) {
      throw new Error(`Failed to retrieve token state: ${(error as Error).message}`);
    }
  }

  /**
   * Store encrypted tokens in Supabase (initial OAuth handshake)
   */
  async insertTokenState(state: PinterestTokenState): Promise<void> {
    const client = createClient(this.supabaseUrl, this.supabaseServiceRoleKey);

    try {
      const { error } = await client.from('pinterest_oauth_tokens').insert({
        id: 1, // Singleton
        access_token_encrypted: encryptToken(state.accessToken, this.encryptionKey),
        refresh_token_encrypted: encryptToken(state.refreshToken, this.encryptionKey),
        access_token_expires_at: state.accessTokenExpiresAt.toISOString(),
        refresh_token_expires_at: state.refreshTokenExpiresAt.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) {
        throw new Error(`Database insert failed: ${error.message}`);
      }
    } catch (error) {
      throw new Error(`Failed to store token state: ${(error as Error).message}`);
    }
  }

  /**
   * Update tokens in Supabase (after refresh)
   * Atomically updates both tokens and refresh timestamp
   */
  async updateTokenState(state: PinterestTokenState): Promise<void> {
    const client = createClient(this.supabaseUrl, this.supabaseServiceRoleKey);

    try {
      const { error } = await client
        .from('pinterest_oauth_tokens')
        .update({
          access_token_encrypted: encryptToken(state.accessToken, this.encryptionKey),
          refresh_token_encrypted: encryptToken(state.refreshToken, this.encryptionKey),
          access_token_expires_at: state.accessTokenExpiresAt.toISOString(),
          refresh_token_expires_at: state.refreshTokenExpiresAt.toISOString(),
          updated_at: new Date().toISOString(),
          last_refreshed_at: new Date().toISOString(),
          refresh_count: this.increment('refresh_count'),
        })
        .eq('id', 1);

      if (error) {
        throw new Error(`Database update failed: ${error.message}`);
      }
    } catch (error) {
      throw new Error(`Failed to update token state: ${(error as Error).message}`);
    }
  }

  /**
   * Get valid access token, refreshing if necessary
   * Call this at the start of each cron execution
   *
   * @returns Valid access token ready for API use
   */
  async getValidAccessToken(): Promise<string> {
    const state = await this.getTokenState();

    if (!state) {
      throw new Error(
        'No Pinterest tokens found. User must complete OAuth authorization first. ' +
          'Visit /api/pinterest/authorize to start.',
      );
    }

    // Check if token is expired or within 24 hours of expiration
    const now = new Date();
    const hoursUntilExpiry = (state.accessTokenExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilExpiry < 0) {
      // Token expired, refresh required
      return await this.refreshAccessToken(state.refreshToken);
    }

    if (hoursUntilExpiry < 24) {
      // Token expiring within 24 hours, refresh proactively
      return await this.refreshAccessToken(state.refreshToken);
    }

    // Token still valid
    return state.accessToken;
  }

  /**
   * Refresh the access token using refresh token
   * Endpoint: POST /v5/oauth/token with grant_type=refresh_token
   *
   * @param refreshToken - Current refresh token
   * @returns New valid access token
   */
  private async refreshAccessToken(refreshToken: string): Promise<string> {
    try {
      // Build Basic Auth header
      const credentials = Buffer.from(`${this.appId}:${this.appSecret}`).toString('base64');

      const response = await fetch('https://api.pinterest.com/v5/oauth/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }).toString(),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as Record<string, string>;
        throw new Error(`Token refresh failed (${response.status}): ${errorData['error_description'] || 'unknown error'}`);
      }

      const data: PinterestOAuthResponse = await response.json();

      // Calculate expiration times
      const now = new Date();
      const accessTokenExpiresAt = new Date(now.getTime() + data.expires_in * 1000);
      const refreshTokenExpiresAt = new Date(now.getTime() + data.refresh_token_expires_in * 1000);

      // Update stored tokens
      const newState: PinterestTokenState = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token, // Pinterest may return new refresh token
        accessTokenExpiresAt,
        refreshTokenExpiresAt,
      };

      await this.updateTokenState(newState);

      return data.access_token;
    } catch (error) {
      throw new Error(`Failed to refresh Pinterest token: ${(error as Error).message}`);
    }
  }

  /**
   * Clear stored tokens (when user revokes access or reauthorization needed)
   */
  async clearTokenState(): Promise<void> {
    const client = createClient(this.supabaseUrl, this.supabaseServiceRoleKey);

    try {
      const { error } = await client.from('pinterest_oauth_tokens').delete().eq('id', 1);

      if (error) {
        throw new Error(`Database delete failed: ${error.message}`);
      }
    } catch (error) {
      throw new Error(`Failed to clear token state: ${(error as Error).message}`);
    }
  }

  /**
   * Helper for atomic increment in Supabase
   */
  private increment(field: string): string {
    return `${field} + 1`;
  }
}

/**
 * Factory function to create token manager with validated environment variables
 */
export function createPinterestTokenManager(): PinterestTokenManager {
  const env = getValidatedEnv();

  if (!env.PINTEREST_APP_ID || !env.PINTEREST_APP_SECRET || !env.TOKEN_ENCRYPTION_KEY) {
    throw new Error(
      'Pinterest token management requires PINTEREST_APP_ID, PINTEREST_APP_SECRET, and TOKEN_ENCRYPTION_KEY. ' +
        'See .env.example for setup instructions.',
    );
  }

  return new PinterestTokenManager(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    env.TOKEN_ENCRYPTION_KEY,
    env.PINTEREST_APP_ID,
    env.PINTEREST_APP_SECRET,
  );
}
