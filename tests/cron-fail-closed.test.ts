/**
 * Fail-closed safety tests for the production cron orchestrator.
 *
 * These tests verify that:
 * 1. Invalid CRON_SECRET returns 401 with zero side effects
 * 2. Valid CRON_SECRET + Pinterest unavailable returns 503 with zero side effects
 * 3. Fully mocked environment allows normal orchestration
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/facebook-pinterest/route';

// Mock all external services
vi.mock('@/lib/env', () => ({
  getValidatedEnv: vi.fn(),
}));

vi.mock('@/db/supabase', () => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock('@/lib/pinterest-token-manager', () => ({
  createPinterestTokenManager: vi.fn(),
}));

vi.mock('@/services/facebook', () => ({
  FacebookClient: vi.fn(),
  FacebookNetworkError: class extends Error {
    override name = 'FacebookNetworkError';
  },
  FacebookRateLimitError: class extends Error {
    override name = 'FacebookRateLimitError';
  },
}));

vi.mock('@/services/pinterest', () => ({
  PinterestClient: vi.fn(),
  PinterestValidationError: class extends Error {
    override name = 'PinterestValidationError';
  },
}));

vi.mock('@/lib/board-routing', () => ({
  createBoardRouter: vi.fn(),
}));

vi.mock('@/lib/content-adapter', () => ({
  createContentAdapter: vi.fn(),
}));

vi.mock('@/db/operations', () => ({
  claimForPublishing: vi.fn(),
  recordPublishedPin: vi.fn(),
  markPostUncertain: vi.fn(),
  markPostSkipped: vi.fn(),
  incrementRetryAndFail: vi.fn(),
}));

import { getValidatedEnv } from '@/lib/env';
import { getSupabaseAdmin } from '@/db/supabase';
import { createPinterestTokenManager } from '@/lib/pinterest-token-manager';

describe('Cron Fail-Closed Safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('A. Invalid CRON_SECRET → 401, zero side effects', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/cron/facebook-pinterest', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(getSupabaseAdmin).not.toHaveBeenCalled();
      expect(createPinterestTokenManager).not.toHaveBeenCalled();
    });

    it('should return 401 when CRON_SECRET is invalid', async () => {
      const mockEnv = {
        CRON_SECRET: 'valid_secret_123456789',
        FACEBOOK_ACCESS_TOKEN: 'test_token',
        FACEBOOK_PAGE_ID: '123',
        FB_GRAPH_API_VERSION: 'v26',
      };
      (getValidatedEnv as any).mockReturnValue(mockEnv);

      const request = new NextRequest('http://localhost:3000/api/cron/facebook-pinterest', {
        method: 'GET',
        headers: {
          authorization: 'Bearer wrong_secret',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Invalid CRON_SECRET');
      expect(getSupabaseAdmin).not.toHaveBeenCalled();
      expect(createPinterestTokenManager).not.toHaveBeenCalled();
    });
  });

  describe('B. Valid CRON_SECRET + Pinterest unavailable → 503, zero side effects', () => {
    beforeEach(() => {
      const mockEnv = {
        CRON_SECRET: 'valid_secret_123456789',
        FACEBOOK_ACCESS_TOKEN: 'test_token',
        FACEBOOK_PAGE_ID: '123',
        FB_GRAPH_API_VERSION: 'v26',
      };
      (getValidatedEnv as any).mockReturnValue(mockEnv);
    });

    it('should return 503 when Pinterest token is null', async () => {
      const mockTokenManager = {
        getValidAccessToken: vi.fn().mockResolvedValue(null),
      };
      (createPinterestTokenManager as any).mockReturnValue(mockTokenManager);

      const request = new NextRequest('http://localhost:3000/api/cron/facebook-pinterest', {
        method: 'GET',
        headers: {
          authorization: 'Bearer valid_secret_123456789',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('Service Unavailable');
      expect(data.sideEffects).toBe('none');
      // Verify no Supabase operations occurred
      expect(getSupabaseAdmin).not.toHaveBeenCalled();
    });

    it('should return 503 when Pinterest token manager throws', async () => {
      const mockTokenManager = {
        getValidAccessToken: vi
          .fn()
          .mockRejectedValue(new Error('Pinterest auth failed')),
      };
      (createPinterestTokenManager as any).mockReturnValue(mockTokenManager);

      const request = new NextRequest('http://localhost:3000/api/cron/facebook-pinterest', {
        method: 'GET',
        headers: {
          authorization: 'Bearer valid_secret_123456789',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('Service Unavailable');
      expect(data.sideEffects).toBe('none');
      // Verify no Supabase operations occurred
      expect(getSupabaseAdmin).not.toHaveBeenCalled();
    });
  });

  describe('C. Valid CRON_SECRET + Pinterest configured → normal flow', () => {
    beforeEach(() => {
      const mockEnv = {
        CRON_SECRET: 'valid_secret_123456789',
        FACEBOOK_ACCESS_TOKEN: 'test_token',
        FACEBOOK_PAGE_ID: '123',
        FB_GRAPH_API_VERSION: 'v26',
      };
      (getValidatedEnv as any).mockReturnValue(mockEnv);
    });

    it('should proceed with orchestration when Pinterest token is available', async () => {
      const mockTokenManager = {
        getValidAccessToken: vi.fn().mockResolvedValue('valid_pinterest_token'),
      };
      (createPinterestTokenManager as any).mockReturnValue(mockTokenManager);

      // Mock Supabase to return no discovered posts
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      };
      (getSupabaseAdmin as any).mockReturnValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/cron/facebook-pinterest', {
        method: 'GET',
        headers: {
          authorization: 'Bearer valid_secret_123456789',
        },
      });

      // This request will fail further downstream due to mocking, but we're checking
      // that it gets PAST the fail-closed guard
      try {
        await GET(request);
      } catch {
        // Expected to fail due to mocking, but proves we got past the guard
      }

      // Verify we got past the fail-closed guard and tried to initialize services
      expect(getSupabaseAdmin).toHaveBeenCalled();
    });
  });
});
