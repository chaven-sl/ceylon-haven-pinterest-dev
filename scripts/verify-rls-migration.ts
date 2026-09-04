#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Verify migration 0004 (RLS Security Fix) was successfully applied
 * Run with: NODE_ENV=test npx tsx scripts/verify-rls-migration.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const TEST_SUPABASE_URL = process.env['TEST_SUPABASE_URL'];
const TEST_SUPABASE_SERVICE_ROLE_KEY = process.env['TEST_SUPABASE_SERVICE_ROLE_KEY'];
const TEST_SUPABASE_ANON_KEY = process.env['TEST_SUPABASE_ANON_KEY'];
const TEST_SUPABASE_PROJECT_REF = process.env['TEST_SUPABASE_PROJECT_REF'];

if (!TEST_SUPABASE_URL || !TEST_SUPABASE_SERVICE_ROLE_KEY || !TEST_SUPABASE_ANON_KEY) {
  console.error('ERROR: Missing required environment variables');
  console.error('TEST_SUPABASE_URL, TEST_SUPABASE_SERVICE_ROLE_KEY, and TEST_SUPABASE_ANON_KEY required');
  process.exit(1);
}

interface TestResult {
  operation: string;
  role: string;
  table: string;
  status: 'PASS' | 'FAIL';
  message: string;
}

const results: TestResult[] = [];

async function testAnonAccess() {
  console.log('\n=== Testing Anonymous Access (Should All Be DENIED) ===\n');

  const anonClient = createClient(TEST_SUPABASE_URL!, TEST_SUPABASE_ANON_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Test 1: SELECT on pinterest_oauth_tokens with anon
  console.log('1. pinterest_oauth_tokens SELECT (anon)...');
  const { data: tokenSelectData, error: tokenSelectError } = await anonClient
    .from('pinterest_oauth_tokens')
    .select('*');

  if (tokenSelectError) {
    console.log('   ✓ DENIED:', tokenSelectError.message);
    results.push({
      operation: 'SELECT',
      role: 'anon',
      table: 'pinterest_oauth_tokens',
      status: 'PASS',
      message: 'Access denied as expected'
    });
  } else {
    console.log('   ✗ ALLOWED (security issue!):', tokenSelectData?.length ?? 0, 'rows');
    results.push({
      operation: 'SELECT',
      role: 'anon',
      table: 'pinterest_oauth_tokens',
      status: 'FAIL',
      message: 'Access allowed (should be denied)'
    });
  }

  // Test 2: INSERT on pinterest_oauth_tokens with anon
  console.log('2. pinterest_oauth_tokens INSERT (anon)...');
  const { error: tokenInsertError } = await anonClient
    .from('pinterest_oauth_tokens')
    .insert({
      access_token_encrypted: 'test',
      refresh_token_encrypted: 'test',
      access_token_expires_at: new Date().toISOString(),
      refresh_token_expires_at: new Date().toISOString(),
    });

  if (tokenInsertError) {
    console.log('   ✓ DENIED:', tokenInsertError.message);
    results.push({
      operation: 'INSERT',
      role: 'anon',
      table: 'pinterest_oauth_tokens',
      status: 'PASS',
      message: 'Access denied as expected'
    });
  } else {
    console.log('   ✗ ALLOWED (security issue!)');
    results.push({
      operation: 'INSERT',
      role: 'anon',
      table: 'pinterest_oauth_tokens',
      status: 'FAIL',
      message: 'Access allowed (should be denied)'
    });
  }

  // Test 3: SELECT on board_routing_config with anon
  console.log('3. board_routing_config SELECT (anon)...');
  const { data: routingSelectData, error: routingSelectError } = await anonClient
    .from('board_routing_config')
    .select('*');

  if (routingSelectError) {
    console.log('   ✓ DENIED:', routingSelectError.message);
    results.push({
      operation: 'SELECT',
      role: 'anon',
      table: 'board_routing_config',
      status: 'PASS',
      message: 'Access denied as expected'
    });
  } else {
    console.log('   ✗ ALLOWED (security issue!):', routingSelectData?.length ?? 0, 'rows');
    results.push({
      operation: 'SELECT',
      role: 'anon',
      table: 'board_routing_config',
      status: 'FAIL',
      message: 'Access allowed (should be denied)'
    });
  }

  // Test 4: INSERT on board_routing_config with anon
  console.log('4. board_routing_config INSERT (anon)...');
  const { error: routingInsertError } = await anonClient
    .from('board_routing_config')
    .insert({
      property_id: 'test',
      property_name: 'Test Property',
      pinterest_board_id: 'test-board',
    });

  if (routingInsertError) {
    console.log('   ✓ DENIED:', routingInsertError.message);
    results.push({
      operation: 'INSERT',
      role: 'anon',
      table: 'board_routing_config',
      status: 'PASS',
      message: 'Access denied as expected'
    });
  } else {
    console.log('   ✗ ALLOWED (security issue!)');
    results.push({
      operation: 'INSERT',
      role: 'anon',
      table: 'board_routing_config',
      status: 'FAIL',
      message: 'Access allowed (should be denied)'
    });
  }
}

async function testServiceRoleAccess(client: SupabaseClient) {
  console.log('\n=== Testing Service-Role Access (Should All Be ALLOWED) ===\n');

  // Test 1: SELECT on pinterest_oauth_tokens with service_role
  console.log('1. pinterest_oauth_tokens SELECT (service_role)...');
  const { data: tokenSelectData, error: tokenSelectError } = await client
    .from('pinterest_oauth_tokens')
    .select('*');

  if (tokenSelectError) {
    console.log('   ✗ DENIED (should be allowed):', tokenSelectError.message);
    results.push({
      operation: 'SELECT',
      role: 'service_role',
      table: 'pinterest_oauth_tokens',
      status: 'FAIL',
      message: 'Access denied (should be allowed)'
    });
  } else {
    console.log('   ✓ ALLOWED:', tokenSelectData?.length ?? 0, 'rows');
    results.push({
      operation: 'SELECT',
      role: 'service_role',
      table: 'pinterest_oauth_tokens',
      status: 'PASS',
      message: 'Access allowed as expected'
    });
  }

  // Test 2: SELECT on board_routing_config with service_role
  console.log('2. board_routing_config SELECT (service_role)...');
  const { data: routingSelectData, error: routingSelectError } = await client
    .from('board_routing_config')
    .select('*');

  if (routingSelectError) {
    console.log('   ✗ DENIED (should be allowed):', routingSelectError.message);
    results.push({
      operation: 'SELECT',
      role: 'service_role',
      table: 'board_routing_config',
      status: 'FAIL',
      message: 'Access denied (should be allowed)'
    });
  } else {
    console.log('   ✓ ALLOWED:', routingSelectData?.length ?? 0, 'rows');
    results.push({
      operation: 'SELECT',
      role: 'service_role',
      table: 'board_routing_config',
      status: 'PASS',
      message: 'Access allowed as expected'
    });
  }
}

async function main() {
  console.log('=================================================');
  console.log('Migration 0004 Verification Report');
  console.log('=================================================');
  console.log(`Target Project: ${TEST_SUPABASE_PROJECT_REF}`);

  const serviceRoleClient = createClient(TEST_SUPABASE_URL!, TEST_SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Verify tables exist
  console.log('\nVerifying table existence...');
  const { error: tokenError } = await serviceRoleClient
    .from('pinterest_oauth_tokens')
    .select('id')
    .limit(0);

  const { error: routingError } = await serviceRoleClient
    .from('board_routing_config')
    .select('id')
    .limit(0);

  if (tokenError || routingError) {
    console.error('ERROR: Required tables missing!');
    process.exit(1);
  }

  console.log('✓ Both tables exist\n');

  // Run tests
  await testAnonAccess();
  await testServiceRoleAccess(serviceRoleClient);

  // Report results
  console.log('\n=================================================');
  console.log('Test Results Summary');
  console.log('=================================================\n');

  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;

  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}\n`);

  // Detailed results
  console.log('Detailed Results:');
  console.log('---');
  results.forEach(result => {
    const icon = result.status === 'PASS' ? '✓' : '✗';
    console.log(`${icon} ${result.role.padEnd(12)} | ${result.operation.padEnd(8)} | ${result.table.padEnd(25)} | ${result.message}`);
  });
  console.log('---\n');

  // Final verdict
  const allPassed = failCount === 0;

  if (allPassed) {
    console.log('✓ MIGRATION 0004 SUCCESSFULLY APPLIED');
    console.log('✓ RLS Security fix verified');
    console.log('✓ Anonymous access is properly denied');
    console.log('✓ Service-role access is allowed\n');
    process.exit(0);
  } else {
    console.log('✗ MIGRATION 0004 VERIFICATION FAILED');
    console.log('✗ RLS security issues detected\n');
    console.log('Next Steps:');
    console.log('1. Verify migration 0004 was applied via Supabase Dashboard');
    console.log('2. Check: https://app.supabase.com/project/' + TEST_SUPABASE_PROJECT_REF + '/sql');
    console.log('3. Run this script again after applying the migration\n');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
