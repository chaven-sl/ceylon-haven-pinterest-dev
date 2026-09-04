#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Apply migration 0004 (RLS Security Fix) to development Supabase
 * Run with: NODE_ENV=test npx tsx scripts/apply-migration-0004.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const TEST_SUPABASE_URL = process.env['TEST_SUPABASE_URL'];
const TEST_SUPABASE_SERVICE_ROLE_KEY = process.env['TEST_SUPABASE_SERVICE_ROLE_KEY'];
const TEST_SUPABASE_ANON_KEY = process.env['TEST_SUPABASE_ANON_KEY'];
const TEST_SUPABASE_PROJECT_REF = process.env['TEST_SUPABASE_PROJECT_REF'];

if (!TEST_SUPABASE_URL || !TEST_SUPABASE_SERVICE_ROLE_KEY || !TEST_SUPABASE_ANON_KEY) {
  console.error('ERROR: Missing required environment variables');
  console.error('TEST_SUPABASE_URL, TEST_SUPABASE_SERVICE_ROLE_KEY, and TEST_SUPABASE_ANON_KEY required');
  process.exit(1);
}

async function testAnonAccess() {
  console.log('\n=== Testing Anonymous Access (Before Fix) ===\n');

  const anonClient = createClient(TEST_SUPABASE_URL!, TEST_SUPABASE_ANON_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Test SELECT on pinterest_oauth_tokens
  console.log('Testing pinterest_oauth_tokens SELECT with anon key...');
  const { data: tokenData, error: tokenError } = await anonClient
    .from('pinterest_oauth_tokens')
    .select('*');

  if (tokenError) {
    console.log('  ✓ DENIED (expected after fix):', tokenError.message);
  } else {
    console.log('  ✗ ALLOWED (security issue!):', tokenData);
  }

  // Test INSERT on pinterest_oauth_tokens
  console.log('Testing pinterest_oauth_tokens INSERT with anon key...');
  const { error: tokenInsertError } = await anonClient
    .from('pinterest_oauth_tokens')
    .insert({
      access_token_encrypted: 'test',
      refresh_token_encrypted: 'test',
      access_token_expires_at: new Date().toISOString(),
      refresh_token_expires_at: new Date().toISOString(),
    });

  if (tokenInsertError) {
    console.log('  ✓ DENIED (expected):', tokenInsertError.message);
  } else {
    console.log('  ✗ ALLOWED (security issue!)');
  }

  // Test SELECT on board_routing_config
  console.log('Testing board_routing_config SELECT with anon key...');
  const { data: routingData, error: routingError } = await anonClient
    .from('board_routing_config')
    .select('*');

  if (routingError) {
    console.log('  ✓ DENIED (expected after fix):', routingError.message);
  } else {
    console.log('  ✗ ALLOWED (security issue!):', routingData);
  }

  // Test INSERT on board_routing_config
  console.log('Testing board_routing_config INSERT with anon key...');
  const { error: routingInsertError } = await anonClient
    .from('board_routing_config')
    .insert({
      property_id: 'test',
      property_name: 'Test Property',
      pinterest_board_id: 'test-board',
    });

  if (routingInsertError) {
    console.log('  ✓ DENIED (expected):', routingInsertError.message);
  } else {
    console.log('  ✗ ALLOWED (security issue!)');
  }
}

async function testServiceRoleAccess(client: SupabaseClient) {
  console.log('\n=== Testing Service Role Access ===\n');

  // Test SELECT on pinterest_oauth_tokens
  console.log('Testing pinterest_oauth_tokens SELECT with service_role key...');
  const { data: tokenData, error: tokenError } = await client
    .from('pinterest_oauth_tokens')
    .select('*');

  if (tokenError) {
    console.log('  ✗ DENIED (should be allowed):', tokenError.message);
  } else {
    console.log('  ✓ ALLOWED (expected):', tokenData?.length ?? 0, 'rows');
  }

  // Test SELECT on board_routing_config
  console.log('Testing board_routing_config SELECT with service_role key...');
  const { data: routingData, error: routingError } = await client
    .from('board_routing_config')
    .select('*');

  if (routingError) {
    console.log('  ✗ DENIED (should be allowed):', routingError.message);
  } else {
    console.log('  ✓ ALLOWED (expected):', routingData?.length ?? 0, 'rows');
  }
}

async function main() {
  console.log('=================================================');
  console.log('Migration 0004: Phase 3 Part 1 RLS Security Fix');
  console.log('=================================================');
  console.log(`Target Project: ${TEST_SUPABASE_PROJECT_REF}`);
  console.log('');

  const serviceRoleClient = createClient(TEST_SUPABASE_URL!, TEST_SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Check if tables exist
  console.log('Checking if tables exist...');
  const { error: tokenCheckError } = await serviceRoleClient
    .from('pinterest_oauth_tokens')
    .select('id')
    .limit(0);

  const { error: routingCheckError } = await serviceRoleClient
    .from('board_routing_config')
    .select('id')
    .limit(0);

  const tokenExists = !tokenCheckError;
  const routingExists = !routingCheckError;

  console.log('pinterest_oauth_tokens:', tokenExists ? '✓ EXISTS' : '✗ MISSING');
  console.log('board_routing_config:', routingExists ? '✓ EXISTS' : '✗ MISSING');
  console.log('');

  if (!tokenExists || !routingExists) {
    console.error('ERROR: Required tables from migration 0003 do not exist!');
    console.error('Please apply migration 0003 first.');
    process.exit(1);
  }

  // Test current RLS configuration
  await testAnonAccess();
  await testServiceRoleAccess(serviceRoleClient);

  // Provide instructions
  console.log('\n=================================================');
  console.log('MIGRATION APPLICATION INSTRUCTIONS');
  console.log('=================================================\n');

  console.log('Migration 0004 must be applied manually via Supabase Dashboard.');
  console.log('');
  console.log('Steps:');
  console.log(`1. Go to: https://app.supabase.com/project/${TEST_SUPABASE_PROJECT_REF}/sql`);
  console.log('2. Click "New Query"');
  console.log('3. Paste the contents of: db/migrations/0004_fix_phase3_rls.sql');
  console.log('4. Click "Run"');
  console.log('5. Run this script again to verify the fix');
  console.log('');

  // Read and display first part of migration for reference
  const migrationPath = path.join(process.cwd(), 'db/migrations/0004_fix_phase3_rls.sql');
  if (fs.existsSync(migrationPath)) {
    const content = fs.readFileSync(migrationPath, 'utf-8');
    const lines = content.split('\n').slice(0, 20);
    console.log('First 20 lines of migration 0004:');
    console.log('---');
    lines.forEach(line => console.log(line));
    console.log('---');
    console.log('...(see ' + migrationPath + ' for full content)');
  }

  process.exit(1); // Exit with error code as migration needs manual application
}

main().catch(error => {
  console.error('Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
