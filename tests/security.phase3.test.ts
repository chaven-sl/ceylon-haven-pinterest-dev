import { beforeAll, afterAll, afterEach, describe, it, expect, beforeEach } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * PHASE 3 CORRECTED RLS VALIDATION
 *
 * Tests PostgreSQL RLS by asserting DATABASE STATE, not HTTP status codes.
 *
 * CORRECT RLS SEMANTICS:
 * - SELECT returning HTTP 200 [] = rows filtered by RLS (expected, secure)
 * - UPDATE returning 0 affected rows = RLS blocked the operation (expected, secure)
 * - service_role bypasses RLS by design (intentional, correct)
 *
 * These tests seed fixture data and verify actual database state after operations.
 */

const TEST_SUPABASE_URL = process.env['TEST_SUPABASE_URL'];
const TEST_SUPABASE_ANON_KEY = process.env['TEST_SUPABASE_ANON_KEY'];
const TEST_SUPABASE_SERVICE_ROLE_KEY = process.env['TEST_SUPABASE_SERVICE_ROLE_KEY'];
const TEST_SUPABASE_PROJECT_REF = process.env['TEST_SUPABASE_PROJECT_REF'];
const ALLOW_REMOTE_TEST_DATABASE = process.env['ALLOW_REMOTE_TEST_DATABASE'] === 'true';

let serviceClient: SupabaseClient;
let anonClient: SupabaseClient;

beforeAll(async () => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('NODE_ENV must be "test"');
  }
  if (!ALLOW_REMOTE_TEST_DATABASE) {
    throw new Error('ALLOW_REMOTE_TEST_DATABASE must be "true"');
  }
  if (!TEST_SUPABASE_URL || !TEST_SUPABASE_PROJECT_REF || !TEST_SUPABASE_SERVICE_ROLE_KEY || !TEST_SUPABASE_ANON_KEY) {
    throw new Error('Missing required Supabase environment variables');
  }

  serviceClient = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  anonClient = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.error(`✓ Connected to Supabase: ${TEST_SUPABASE_PROJECT_REF}`);
});

afterAll(async () => {
  // Cleanup all test data
  try {
    await serviceClient.from('pinterest_oauth_tokens').delete().neq('id', -1);
    await serviceClient.from('board_routing_config').delete().neq('id', -1);
  } catch {
    // Tables may not exist or be empty
  }
});

describe('Phase 3: Corrected RLS Validation (Database State Assertions)', () => {
  describe('pinterest_oauth_tokens: SELECT Access Control', () => {
    beforeEach(async () => {
      // Cleanup first (only id=1 allowed by singleton constraint)
      await serviceClient.from('pinterest_oauth_tokens').delete().eq('id', 1);
    });

    afterEach(async () => {
      // Cleanup after each test
      await serviceClient.from('pinterest_oauth_tokens').delete().eq('id', 1);
    });

    it('should allow service_role to INSERT and SELECT fixture data', async () => {
      const now = new Date().toISOString();
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const expectedToken = 'fixture_token_secret_12345';

      // Service role: Insert test fixture (must use id=1)
      const { error: insertError } = await serviceClient.from('pinterest_oauth_tokens').insert({
        id: 1,
        access_token_encrypted: expectedToken,
        refresh_token_encrypted: 'fixture_refresh_secret',
        access_token_expires_at: futureDate,
        refresh_token_expires_at: futureDate,
        created_at: now,
        updated_at: now,
      });

      expect(insertError).toBeNull();

      // Service role: Verify fixture was inserted
      const { data: fixtureData, error: selectError } = await serviceClient
        .from('pinterest_oauth_tokens')
        .select('*')
        .eq('id', 1)
        .single();

      expect(selectError).toBeNull();
      expect(fixtureData).not.toBeNull();
      expect(fixtureData?.access_token_encrypted).toBe(expectedToken);
    });

    it('should deny anonymous SELECT (database state: row not accessible to anon)', async () => {
      const now = new Date().toISOString();
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // Service role: Seed fixture (id=1)
      await serviceClient.from('pinterest_oauth_tokens').insert({
        id: 1,
        access_token_encrypted: 'secret_fixture_token',
        refresh_token_encrypted: 'secret_refresh',
        access_token_expires_at: futureDate,
        refresh_token_expires_at: futureDate,
        created_at: now,
        updated_at: now,
      });

      // Anon: Attempt SELECT
      const { data: anonData, error: anonError } = await anonClient
        .from('pinterest_oauth_tokens')
        .select('*');

      // PASS CONDITION: No error (HTTP 200 is acceptable), but no rows returned
      expect(anonError).toBeNull(); // RLS doesn't return an error for SELECT
      expect(anonData).not.toBeNull();
      expect(anonData).toEqual([]); // Rows are filtered by RLS

      // Verify service role still sees the data (fixture wasn't deleted)
      const { data: serviceData } = await serviceClient
        .from('pinterest_oauth_tokens')
        .select('*')
        .eq('id', 1);

      expect(serviceData?.length).toBe(1);
      expect(serviceData?.[0]?.access_token_encrypted).toBe('secret_fixture_token');
    });
  });

  describe('pinterest_oauth_tokens: UPDATE Access Control', () => {
    beforeEach(async () => {
      await serviceClient.from('pinterest_oauth_tokens').delete().eq('id', 1);
    });

    afterEach(async () => {
      await serviceClient.from('pinterest_oauth_tokens').delete().eq('id', 1);
    });

    it('should deny anonymous UPDATE (database state: row value unchanged)', async () => {
      const now = new Date().toISOString();
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const originalToken = 'original_token_fixture';

      // Service role: Seed fixture with known value
      await serviceClient.from('pinterest_oauth_tokens').insert({
        id: 1,
        access_token_encrypted: originalToken,
        refresh_token_encrypted: 'original_refresh',
        access_token_expires_at: futureDate,
        refresh_token_expires_at: futureDate,
        created_at: now,
        updated_at: now,
        refresh_count: 0,
      });

      // Anon: Attempt UPDATE
      const { error: updateError } = await anonClient
        .from('pinterest_oauth_tokens')
        .update({ access_token_encrypted: 'hacked_token_value', refresh_count: 99 })
        .eq('id', 1);

      // PASS CONDITION: No error returned (RLS doesn't error for UPDATE on filtered rows)
      expect(updateError).toBeNull();

      // Verify database state: original value unchanged (proves RLS blocked the mutation)
      const { data: afterUpdate } = await serviceClient
        .from('pinterest_oauth_tokens')
        .select('*')
        .eq('id', 1)
        .single();

      expect(afterUpdate?.access_token_encrypted).toBe(originalToken); // Unchanged
      expect(afterUpdate?.refresh_count).toBe(0); // Unchanged
    });
  });

  describe('pinterest_oauth_tokens: DELETE Access Control', () => {
    beforeEach(async () => {
      await serviceClient.from('pinterest_oauth_tokens').delete().eq('id', 1);
    });

    afterEach(async () => {
      await serviceClient.from('pinterest_oauth_tokens').delete().eq('id', 1);
    });

    it('should deny anonymous DELETE (database state: row still exists)', async () => {
      const now = new Date().toISOString();
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // Service role: Seed fixture
      await serviceClient.from('pinterest_oauth_tokens').insert({
        id: 1,
        access_token_encrypted: 'token_to_protect',
        refresh_token_encrypted: 'refresh',
        access_token_expires_at: futureDate,
        refresh_token_expires_at: futureDate,
        created_at: now,
        updated_at: now,
      });

      // Anon: Attempt DELETE
      const { error: deleteError } = await anonClient
        .from('pinterest_oauth_tokens')
        .delete()
        .eq('id', 1);

      // PASS CONDITION: No error returned (RLS doesn't error for DELETE on filtered rows)
      expect(deleteError).toBeNull();

      // Verify database state: row still exists (proves RLS blocked the deletion)
      const { data: stillExists } = await serviceClient
        .from('pinterest_oauth_tokens')
        .select('*')
        .eq('id', 1)
        .single();

      expect(stillExists).not.toBeNull();
      expect(stillExists?.access_token_encrypted).toBe('token_to_protect');
    });
  });

  describe('pinterest_oauth_tokens: INSERT Access Control', () => {
    it('should deny anonymous INSERT (database state: no row created)', async () => {
      const testId = Math.floor(Math.random() * 1000000);
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      try {
        // Anon: Attempt INSERT
        const { error: insertError } = await anonClient.from('pinterest_oauth_tokens').insert({
          id: testId,
          access_token_encrypted: 'injected_token',
          refresh_token_encrypted: 'injected_refresh',
          access_token_expires_at: futureDate,
          refresh_token_expires_at: futureDate,
        });

        // PASS CONDITION: Error should be present (INSERT does return error when denied)
        expect(insertError).not.toBeNull();

        // Verify database state: row was not created
        const { data: shouldNotExist } = await serviceClient
          .from('pinterest_oauth_tokens')
          .select('*')
          .eq('id', testId);

        expect(shouldNotExist?.length).toBe(0);
      } finally {
        // Cleanup if somehow inserted
        await serviceClient.from('pinterest_oauth_tokens').delete().eq('id', testId);
      }
    });
  });

  describe('board_routing_config: SELECT Access Control', () => {
    let testPropertyId: string;

    beforeEach(async () => {
      testPropertyId = `test_prop_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      // Cleanup any previous test data
      await serviceClient.from('board_routing_config').delete().ilike('property_id', 'test_prop_%');
    });

    afterEach(async () => {
      await serviceClient.from('board_routing_config').delete().eq('property_id', testPropertyId);
    });

    it('should deny anonymous SELECT (database state: row not accessible to anon)', async () => {
      const now = new Date().toISOString();

      // Service role: Seed fixture
      const { error: insertError } = await serviceClient.from('board_routing_config').insert({
        property_id: testPropertyId,
        property_name: 'Test Property',
        property_type: 'villa',
        pinterest_board_id: 'test_board_001',
        pinterest_board_name: 'Test Board',
        destination_url: 'https://example.com',
        active: true,
        created_at: now,
        updated_at: now,
      });

      expect(insertError).toBeNull();

      // Anon: Attempt SELECT
      const { data: anonData, error: anonError } = await anonClient
        .from('board_routing_config')
        .select('*');

      // PASS CONDITION: No error, but no rows returned
      expect(anonError).toBeNull();
      expect(anonData).not.toBeNull();
      expect(anonData).toEqual([]);

      // Verify service role still sees the data
      const { data: serviceData } = await serviceClient
        .from('board_routing_config')
        .select('*')
        .eq('property_id', testPropertyId);

      expect(serviceData?.length).toBe(1);
    });
  });

  describe('Service Role Access (Control Group)', () => {
    let configPropertyId: string;

    beforeEach(async () => {
      configPropertyId = `service_prop_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      // Cleanup stale data
      await serviceClient.from('pinterest_oauth_tokens').delete().eq('id', 1);
      await serviceClient.from('board_routing_config').delete().ilike('property_id', 'service_prop_%');
    });

    afterEach(async () => {
      await serviceClient.from('pinterest_oauth_tokens').delete().eq('id', 1);
      await serviceClient.from('board_routing_config').delete().eq('property_id', configPropertyId);
    });

    it('service_role operations should work normally', async () => {
      const now = new Date().toISOString();
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // INSERT token (must use id=1)
      const { error: tokenInsertError, data: tokenData } = await serviceClient
        .from('pinterest_oauth_tokens')
        .insert({
          id: 1,
          access_token_encrypted: 'service_token',
          refresh_token_encrypted: 'service_refresh',
          access_token_expires_at: futureDate,
          refresh_token_expires_at: futureDate,
          created_at: now,
          updated_at: now,
        })
        .select();

      expect(tokenInsertError).toBeNull();
      expect(tokenData?.length).toBe(1);

      // UPDATE token
      const { error: tokenUpdateError } = await serviceClient
        .from('pinterest_oauth_tokens')
        .update({ refresh_count: 5 })
        .eq('id', 1);

      expect(tokenUpdateError).toBeNull();

      // SELECT token
      const { error: tokenSelectError, data: tokenSelectData } = await serviceClient
        .from('pinterest_oauth_tokens')
        .select('*')
        .eq('id', 1)
        .single();

      expect(tokenSelectError).toBeNull();
      expect(tokenSelectData?.refresh_count).toBe(5);

      // INSERT config
      const { error: configInsertError } = await serviceClient
        .from('board_routing_config')
        .insert({
          property_id: configPropertyId,
          property_name: 'Service Property',
          property_type: 'villa',
          pinterest_board_id: 'service_board',
          pinterest_board_name: 'Service Board',
          destination_url: 'https://example.com',
          active: true,
          created_at: now,
          updated_at: now,
        });

      expect(configInsertError).toBeNull();

      // SELECT config
      const { error: configSelectError, data: configSelectData } = await serviceClient
        .from('board_routing_config')
        .select('*')
        .eq('property_id', configPropertyId)
        .single();

      expect(configSelectError).toBeNull();
      expect(configSelectData?.pinterest_board_name).toBe('Service Board');
    });
  });
});
