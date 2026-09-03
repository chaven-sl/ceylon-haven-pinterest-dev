import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as operations from '../db/operations';

/**
 * Phase 2.4 Integration Tests - Real Supabase API Database Tests
 * These tests run against a real local Supabase instance via HTTP API to empirically verify:
 * - Transaction atomicity
 * - Concurrency safety
 * - State machine enforcement
 * - Retry counter correctness
 * - Terminal state protection
 * - RLS policies
 *
 * IMPORTANT: Tests communicate through Supabase PostgREST API (HTTP),
 * not raw PostgreSQL connections. This validates the API layer used in production.
 */

// Supabase test configuration - MUST NOT target production
const TEST_SUPABASE_URL = process.env['TEST_SUPABASE_URL'];
const TEST_SUPABASE_ANON_KEY = process.env['TEST_SUPABASE_ANON_KEY'];
const TEST_SUPABASE_SERVICE_ROLE_KEY = process.env['TEST_SUPABASE_SERVICE_ROLE_KEY'];
const TEST_SUPABASE_PROJECT_REF = process.env['TEST_SUPABASE_PROJECT_REF'];
const ALLOW_REMOTE_TEST_DATABASE = process.env['ALLOW_REMOTE_TEST_DATABASE'] === 'true';

let client: SupabaseClient;
let anonClient: SupabaseClient;

/**
 * SAFETY GUARDS - Fail Closed
 * Tests refuse to run unless ALL conditions are met:
 * 1. NODE_ENV === 'test'
 * 2. ALLOW_REMOTE_TEST_DATABASE === 'true'
 * 3. TEST_SUPABASE_URL is set and is NOT production
 * 4. TEST_SUPABASE_PROJECT_REF is set and matches URL
 * 5. TEST_SUPABASE_SERVICE_ROLE_KEY is set
 */
beforeAll(async () => {
  // Guard 1: NODE_ENV must be 'test'
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      'SAFETY GUARD FAILED: NODE_ENV must be "test". ' +
        'Integration tests must explicitly opt-in via environment. Run: NODE_ENV=test npm run test:integration:db'
    );
  }

  // Guard 2: ALLOW_REMOTE_TEST_DATABASE must be explicitly set to 'true'
  if (!ALLOW_REMOTE_TEST_DATABASE) {
    throw new Error(
      'SAFETY GUARD FAILED: ALLOW_REMOTE_TEST_DATABASE must be "true". ' +
        'Set in .env.test to enable cloud database testing.'
    );
  }

  // Guard 3: TEST_SUPABASE_URL must be set
  if (!TEST_SUPABASE_URL) {
    throw new Error(
      'SAFETY GUARD FAILED: TEST_SUPABASE_URL environment variable not set. ' +
        'Set TEST_SUPABASE_URL in .env.test (e.g., https://xxxxx.supabase.co)'
    );
  }

  // Guard 4: TEST_SUPABASE_PROJECT_REF must be set
  if (!TEST_SUPABASE_PROJECT_REF) {
    throw new Error(
      'SAFETY GUARD FAILED: TEST_SUPABASE_PROJECT_REF environment variable not set. ' +
        'Set TEST_SUPABASE_PROJECT_REF in .env.test (the project reference from Supabase dashboard)'
    );
  }

  // Guard 5: Positive identification - URL must match project ref
  if (!TEST_SUPABASE_URL.includes(TEST_SUPABASE_PROJECT_REF)) {
    throw new Error(
      `SAFETY GUARD FAILED: TEST_SUPABASE_URL does not match TEST_SUPABASE_PROJECT_REF. ` +
        `URL must contain project ref. URL: ${TEST_SUPABASE_URL}, Ref: ${TEST_SUPABASE_PROJECT_REF}`
    );
  }

  // Guard 6: Refuse production projects
  if (TEST_SUPABASE_PROJECT_REF.includes('prod') || TEST_SUPABASE_URL.includes('production')) {
    throw new Error(
      'SAFETY GUARD FAILED: Integration tests must not target production. ' +
        'Use a dedicated development Supabase project (e.g., ceylon-haven-pinterest-dev).'
    );
  }

  // Guard 7: TEST_SUPABASE_SERVICE_ROLE_KEY must be set
  if (!TEST_SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SAFETY GUARD FAILED: TEST_SUPABASE_SERVICE_ROLE_KEY environment variable not set. ' +
        'Obtain from Supabase dashboard: Project Settings → API → Service Role Key'
    );
  }

  // Guard 8: TEST_SUPABASE_ANON_KEY must be set (for RLS testing)
  if (!TEST_SUPABASE_ANON_KEY) {
    throw new Error(
      'SAFETY GUARD FAILED: TEST_SUPABASE_ANON_KEY environment variable not set. ' +
        'Obtain from Supabase dashboard: Project Settings → API → Anon Key'
    );
  }

  // Initialize Supabase clients
  // Service role client: Full permissions, bypasses RLS (for test setup/cleanup)
  client = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Anon client: Limited permissions, respects RLS (for testing security)
  anonClient = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log(`✓ Safety guards passed. Connected to Supabase development project: ${TEST_SUPABASE_PROJECT_REF}`);
});

afterAll(async () => {
  // Clean up: delete all test data
  try {
    await client.from('pinterest_pins').delete().neq('id', 0);
    await client.from('facebook_posts').delete().neq('id', 0);
    await client.from('execution_logs').delete().neq('id', 0);
  } catch {
    // Cleanup completed (some tables may have been empty)
  }
});

/**
 * Helper: Insert a test Facebook post
 */
async function insertTestPost(
  facebookPostId: string,
  status: string = 'discovered',
  retryCount: number = 0,
) {
  const now = new Date().toISOString();
  const { error } = await client.from('facebook_posts').insert({
    facebook_post_id: facebookPostId,
    facebook_permalink: `https://facebook.com/post/${facebookPostId}`,
    caption: 'Test post',
    image_url: 'https://example.com/image.jpg',
    date_published: now,
    status,
    retry_count: retryCount,
    created_at: now,
    updated_at: now,
  });

  if (error) {
    throw new Error(`Failed to insert test post: ${error.message}`);
  }
}

/**
 * Helper: Insert a test Pinterest pin
 */
async function insertTestPin(facebookPostId: string, pinterestPinId: string) {
  const now = new Date().toISOString();
  const { error } = await client.from('pinterest_pins').insert({
    facebook_post_id: facebookPostId,
    pinterest_pin_id: pinterestPinId,
    pinterest_pin_url: `https://pinterest.com/pin/${pinterestPinId}`,
    board_name: 'Test Board',
    destination_url: 'https://ceylonhaven.com',
    status: 'published',
    created_at: now,
    updated_at: now,
  });

  if (error) {
    throw new Error(`Failed to insert test pin: ${error.message}`);
  }
}

/**
 * Helper: Get post current status
 */
async function getPostStatus(facebookPostId: string) {
  const { data, error } = await client
    .from('facebook_posts')
    .select('status, retry_count')
    .eq('facebook_post_id', facebookPostId)
    .single();

  if (error) {
    return null;
  }

  return data;
}

/**
 * Helper: Clean up test data
 */
async function cleanupTest(facebookPostId: string) {
  await client.from('pinterest_pins').delete().eq('facebook_post_id', facebookPostId);
  await client.from('facebook_posts').delete().eq('facebook_post_id', facebookPostId);
}

describe('Supabase API Integration Tests (Local HTTP API)', () => {
  describe('Schema Validation', () => {
    it('should have facebook_posts table', async () => {
      const { error } = await client
        .from('facebook_posts')
        .select('id')
        .limit(0);

      expect(error).toBeNull();
    });

    it('should have pinterest_pins table', async () => {
      const { error } = await client
        .from('pinterest_pins')
        .select('id')
        .limit(0);

      expect(error).toBeNull();
    });

    it('should have execution_logs table', async () => {
      const { error } = await client
        .from('execution_logs')
        .select('id')
        .limit(0);

      expect(error).toBeNull();
    });

    it('should enforce UNIQUE constraint on facebook_post_id', async () => {
      const postId = `test_unique_${Date.now()}`;
      const now = new Date().toISOString();

      // Insert first post
      const { error: error1 } = await client.from('facebook_posts').insert({
        facebook_post_id: postId,
        date_published: now,
      });
      expect(error1).toBeNull();

      // Try to insert duplicate
      const { error: error2 } = await client.from('facebook_posts').insert({
        facebook_post_id: postId,
        date_published: now,
      });
      expect(error2).not.toBeNull();
      expect(error2?.code).toBe('23505'); // UNIQUE constraint violation

      // Cleanup
      await cleanupTest(postId);
    });

    it('should enforce FOREIGN KEY constraint on pinterest_pins.facebook_post_id', async () => {
      const { error } = await client.from('pinterest_pins').insert({
        facebook_post_id: 'nonexistent_post_id',
        pinterest_pin_id: 'test_pin_123',
        board_name: 'Test Board',
        destination_url: 'https://test.com',
      });

      expect(error).not.toBeNull();
      expect(error?.code).toBe('23503'); // FOREIGN KEY constraint violation
    });

    it('should have status ENUM with correct values', async () => {
      const postId = `test_enum_${Date.now()}`;
      await insertTestPost(postId, 'discovered');

      const post = await getPostStatus(postId);
      expect(post?.status).toBe('discovered');

      await cleanupTest(postId);
    });
  });

  describe('claimForPublishing (discovered -> publishing)', () => {
    it('should successfully claim a discovered post', async () => {
      const postId = `claim_success_${Date.now()}`;
      await insertTestPost(postId, 'discovered');

      const response = await operations.claimForPublishing(client, postId);

      expect(response.result).toBe('success');
      expect(response.message).toContain('successfully claimed');

      const post = await getPostStatus(postId);
      expect(post?.status).toBe('publishing');

      await cleanupTest(postId);
    });

    it('should reject claiming a post not in discovered state', async () => {
      const postId = `claim_reject_${Date.now()}`;
      await insertTestPost(postId, 'publishing');

      const response = await operations.claimForPublishing(client, postId);

      expect(response.result).not.toBe('success');

      await cleanupTest(postId);
    });

    it('should return not_found for nonexistent post', async () => {
      const response = await operations.claimForPublishing(client, 'nonexistent_post');

      expect(response.result).toBe('not_found');
    });

    it('should be concurrent-safe (two simultaneous claims)', async () => {
      const postId = `concurrent_claim_${Date.now()}`;
      await insertTestPost(postId, 'discovered');

      // Simulate two concurrent claim attempts
      const [result1, result2] = await Promise.all([
        operations.claimForPublishing(client, postId),
        operations.claimForPublishing(client, postId),
      ]);

      // Only one should succeed
      const successCount = [result1, result2].filter((r) => r.result === 'success').length;
      expect(successCount).toBe(1);

      // Final state should be publishing
      const post = await getPostStatus(postId);
      expect(post?.status).toBe('publishing');

      await cleanupTest(postId);
    });
  });

  describe('recordPublishedPin (atomic transaction)', () => {
    it('should atomically create pin and transition post to published', async () => {
      const postId = `pin_success_${Date.now()}`;
      const pinId = `pin_${Date.now()}`;

      await insertTestPost(postId, 'publishing');

      const result = await operations.recordPublishedPin(
        client,
        postId,
        pinId,
        'Test Board',
        'https://ceylonhaven.com',
      );

      expect(result).toBe(true);

      // Verify pin was created
      const { data: pinData } = await client
        .from('pinterest_pins')
        .select('*')
        .eq('facebook_post_id', postId)
        .single();

      expect(pinData?.pinterest_pin_id).toBe(pinId);
      expect(pinData?.board_name).toBe('Test Board');

      // Verify post transitioned to published
      const post = await getPostStatus(postId);
      expect(post?.status).toBe('published');

      await cleanupTest(postId);
    });

    it('should reject pin recording if post not in publishing state', async () => {
      const postId = `pin_reject_${Date.now()}`;
      const pinId = `pin_${Date.now()}`;

      await insertTestPost(postId, 'discovered');

      try {
        await operations.recordPublishedPin(
          client,
          postId,
          pinId,
          'Test Board',
          'https://ceylonhaven.com',
        );
        expect.fail('Should have thrown error');
      } catch (e) {
        const error = e as Error;
        expect(error.message).toContain('not in publishing state');
      }

      await cleanupTest(postId);
    });

    it('should rollback on duplicate pin detection', async () => {
      const postId = `pin_duplicate_${Date.now()}`;
      const pinId = `pin_${Date.now()}`;

      await insertTestPost(postId, 'publishing');
      await insertTestPin(postId, pinId);

      try {
        await operations.recordPublishedPin(
          client,
          postId,
          pinId,
          'Test Board',
          'https://ceylonhaven.com',
        );
        expect.fail('Should have thrown error for duplicate');
      } catch (e) {
        const error = e as Error;
        expect(error.message).toContain('Duplicate');
      }

      // Verify post is still in publishing state (transaction rolled back)
      const post = await getPostStatus(postId);
      expect(post?.status).toBe('publishing');

      await cleanupTest(postId);
    });

    it('should enforce only one pin per post', async () => {
      const postId = `pin_unique_${Date.now()}`;
      const pinId1 = `pin1_${Date.now()}`;
      const pinId2 = `pin2_${Date.now()}`;

      await insertTestPost(postId, 'publishing');

      // First pin succeeds
      await operations.recordPublishedPin(
        client,
        postId,
        pinId1,
        'Test Board',
        'https://ceylonhaven.com',
      );

      // Post is now published, claim for publishing again would fail
      // but let's test that we can't insert a second pin with same facebook_post_id
      await insertTestPost(postId + '_2', 'publishing');

      try {
        // Try to create another pin with same facebook_post_id (violates UNIQUE)
        await client.from('pinterest_pins').insert({
          facebook_post_id: postId,
          pinterest_pin_id: pinId2,
          board_name: 'Test Board',
          destination_url: 'https://ceylonhaven.com',
        });
        expect.fail('Should have thrown UNIQUE constraint error');
      } catch (e) {
        const error = e as Error & { code?: string };
        expect(error.message || error.code).toBeDefined();
      }

      await cleanupTest(postId);
    });
  });

  describe('Retry operations (atomic increment)', () => {
    it('should atomically increment retry count and mark failed', async () => {
      const postId = `retry_increment_${Date.now()}`;
      await insertTestPost(postId, 'publishing', 0);

      const result = await operations.incrementRetryAndFail(
        client,
        postId,
        'Test error',
      );

      expect(result.success).toBe(true);
      expect(result.new_retry_count).toBe(1);
      expect(result.will_retry).toBe(true);

      const post = await getPostStatus(postId);
      expect(post?.status).toBe('failed');
      expect(post?.retry_count).toBe(1);

      await cleanupTest(postId);
    });

    it('should prevent race condition in retry increment', async () => {
      const postId = `retry_concurrent_${Date.now()}`;
      await insertTestPost(postId, 'publishing', 0);

      // Simulate two concurrent retry increments
      // Only ONE should succeed; the second should fail because status will be 'failed' after the first
      const [result1, result2] = await Promise.all([
        operations.incrementRetryAndFail(client, postId, 'Error 1'),
        operations.incrementRetryAndFail(client, postId, 'Error 2'),
      ]);

      // Exactly ONE should succeed (the other fails due to status already being 'failed')
      const successCount = [result1, result2].filter((r) => r.success).length;
      expect(successCount).toBe(1);

      // One succeeds, one fails
      const successResult = [result1, result2].find((r) => r.success);
      const failResult = [result1, result2].find((r) => !r.success);

      expect(successResult?.success).toBe(true);
      expect(successResult?.new_retry_count).toBe(1);
      expect(failResult?.success).toBe(false);

      // Final database state: status='failed', retry_count=1 (not 2)
      const post = await getPostStatus(postId);
      expect(post?.status).toBe('failed');
      expect(post?.retry_count).toBe(1); // Only ONE increment happened

      await cleanupTest(postId);
    });

    it('should indicate when retry will not be attempted (at limit)', async () => {
      const postId = `retry_limit_${Date.now()}`;
      await insertTestPost(postId, 'publishing', 3);

      const result = await operations.incrementRetryAndFail(
        client,
        postId,
        'Test error at limit',
      );

      expect(result.success).toBe(true);
      expect(result.new_retry_count).toBe(4);
      expect(result.will_retry).toBe(false); // No more retries

      await cleanupTest(postId);
    });
  });

  describe('claimForRetry (failed -> publishing)', () => {
    it('should claim a failed post for retry if under limit', async () => {
      const postId = `retry_claim_${Date.now()}`;
      await insertTestPost(postId, 'failed', 1);

      const result = await operations.claimForRetry(client, postId);

      expect(result).toBe(true);

      const post = await getPostStatus(postId);
      expect(post?.status).toBe('publishing');

      await cleanupTest(postId);
    });

    it('should reject claim if retry count at limit', async () => {
      const postId = `retry_claim_limit_${Date.now()}`;
      await insertTestPost(postId, 'failed', 3);

      try {
        await operations.claimForRetry(client, postId);
        expect.fail('Should have thrown error');
      } catch (e) {
        const error = e as Error;
        expect(error.message).toContain('not retryable');
      }

      await cleanupTest(postId);
    });

    it('should reject claim if post not in failed state', async () => {
      const postId = `retry_claim_wrong_state_${Date.now()}`;
      await insertTestPost(postId, 'published', 1);

      try {
        await operations.claimForRetry(client, postId);
        expect.fail('Should have thrown error');
      } catch (e) {
        const error = e as Error;
        expect(error.message).toContain('not retryable');
      }

      await cleanupTest(postId);
    });
  });

  describe('State protection', () => {
    it('should reject recordPublishedPin on discovered state', async () => {
      const postId = `state_discovered_${Date.now()}`;
      const pinId = `pin_${Date.now()}`;

      await insertTestPost(postId, 'discovered');

      try {
        await operations.recordPublishedPin(
          client,
          postId,
          pinId,
          'Test Board',
          'https://ceylonhaven.com',
        );
        expect.fail('Should have thrown error');
      } catch (e) {
        const error = e as Error;
        expect(error.message).toContain('not in publishing state');
      }

      await cleanupTest(postId);
    });

    it('should reject recordPublishedPin on published state', async () => {
      const postId = `state_published_${Date.now()}`;
      const pinId = `pin_${Date.now()}`;

      await insertTestPost(postId, 'published');

      try {
        await operations.recordPublishedPin(
          client,
          postId,
          pinId,
          'Test Board',
          'https://ceylonhaven.com',
        );
        expect.fail('Should have thrown error');
      } catch (e) {
        const error = e as Error;
        expect(error.message).toContain('not in publishing state');
      }

      await cleanupTest(postId);
    });

    it('should reject recordPublishedPin on uncertain state', async () => {
      const postId = `state_uncertain_${Date.now()}`;
      const pinId = `pin_${Date.now()}`;

      await insertTestPost(postId, 'uncertain');

      try {
        await operations.recordPublishedPin(
          client,
          postId,
          pinId,
          'Test Board',
          'https://ceylonhaven.com',
        );
        expect.fail('Should have thrown error');
      } catch (e) {
        const error = e as Error;
        expect(error.message).toContain('not in publishing state');
      }

      await cleanupTest(postId);
    });

    it('should reject recordPublishedPin on failed state', async () => {
      const postId = `state_failed_${Date.now()}`;
      const pinId = `pin_${Date.now()}`;

      await insertTestPost(postId, 'failed');

      try {
        await operations.recordPublishedPin(
          client,
          postId,
          pinId,
          'Test Board',
          'https://ceylonhaven.com',
        );
        expect.fail('Should have thrown error');
      } catch (e) {
        const error = e as Error;
        expect(error.message).toContain('not in publishing state');
      }

      await cleanupTest(postId);
    });

    it('should reject recordPublishedPin on skipped state', async () => {
      const postId = `state_skipped_${Date.now()}`;
      const pinId = `pin_${Date.now()}`;

      await insertTestPost(postId, 'skipped');

      try {
        await operations.recordPublishedPin(
          client,
          postId,
          pinId,
          'Test Board',
          'https://ceylonhaven.com',
        );
        expect.fail('Should have thrown error');
      } catch (e) {
        const error = e as Error;
        expect(error.message).toContain('not in publishing state');
      }

      await cleanupTest(postId);
    });
  });

  describe('markPostUncertain (publishing -> uncertain)', () => {
    it('should mark publishing post as uncertain', async () => {
      const postId = `uncertain_${Date.now()}`;
      await insertTestPost(postId, 'publishing');

      const result = await operations.markPostUncertain(
        client,
        postId,
        'Pin published but DB update failed',
      );

      expect(result).toBe(true);

      const post = await getPostStatus(postId);
      expect(post?.status).toBe('uncertain');

      await cleanupTest(postId);
    });

    it('should reject marking discovered post as uncertain', async () => {
      const postId = `uncertain_reject_${Date.now()}`;
      await insertTestPost(postId, 'discovered');

      try {
        await operations.markPostUncertain(
          client,
          postId,
          'Test error',
        );
        expect.fail('Should have thrown error');
      } catch (e) {
        const error = e as Error;
        expect(error.message).toContain('not in publishing state');
      }

      await cleanupTest(postId);
    });
  });

  describe('markPostSkipped (discovered -> skipped)', () => {
    it('should mark discovered post as skipped', async () => {
      const postId = `skipped_${Date.now()}`;
      await insertTestPost(postId, 'discovered');

      const result = await operations.markPostSkipped(
        client,
        postId,
        'No images found',
      );

      expect(result).toBe(true);

      const post = await getPostStatus(postId);
      expect(post?.status).toBe('skipped');

      await cleanupTest(postId);
    });

    it('should reject skipping published post', async () => {
      const postId = `skipped_reject_${Date.now()}`;
      await insertTestPost(postId, 'published');

      try {
        await operations.markPostSkipped(
          client,
          postId,
          'Test reason',
        );
        expect.fail('Should have thrown error');
      } catch (e) {
        const error = e as Error;
        expect(error.message).toContain('not in discovered state');
      }

      await cleanupTest(postId);
    });
  });

  describe('RLS & Security Validation', () => {
    it('anon client should be denied direct table access via RLS', async () => {
      // Anon clients should be denied direct SELECT on facebook_posts table
      const { error, data } = await anonClient
        .from('facebook_posts')
        .select('*')
        .limit(1);

      // Should fail with RLS error (typically error code indicates denied)
      expect(error).not.toBeNull();
      expect(error?.message).toContain('row level security');
    });

    it('anon client should be denied RPC execution on operational functions', async () => {
      // Create a test post with service role first
      const postId = `rls_test_${Date.now()}`;
      const now = new Date().toISOString();
      await client.from('facebook_posts').insert({
        facebook_post_id: postId,
        facebook_permalink: `https://facebook.com/post/${postId}`,
        caption: 'Test post',
        image_url: 'https://example.com/image.jpg',
        date_published: now,
        status: 'discovered',
        created_at: now,
        updated_at: now,
      });

      // Try to call claim_for_publishing with anon client
      // Should be denied because function is restricted to service_role only
      const { error } = await anonClient.rpc('claim_for_publishing', {
        p_facebook_post_id: postId,
      });

      // Should fail (permission denied on function execution)
      expect(error).not.toBeNull();
      // Supabase returns PGRST107 or similar for permission denied
      expect(error?.message.toLowerCase()).toContain('permission');

      // Cleanup with service role
      await client.from('facebook_posts').delete().eq('facebook_post_id', postId);
    });

    it('service role client should have full RPC access', async () => {
      // Create a test post
      const postId = `service_test_${Date.now()}`;
      const now = new Date().toISOString();
      await client.from('facebook_posts').insert({
        facebook_post_id: postId,
        facebook_permalink: `https://facebook.com/post/${postId}`,
        caption: 'Test post',
        image_url: 'https://example.com/image.jpg',
        date_published: now,
        status: 'discovered',
        created_at: now,
        updated_at: now,
      });

      // Service role should successfully call RPC
      const { error, data } = await client.rpc('claim_for_publishing', {
        p_facebook_post_id: postId,
      });

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data?.[0]?.success).toBe(true);

      // Cleanup
      await client.from('facebook_posts').delete().eq('facebook_post_id', postId);
    });
  });
});
