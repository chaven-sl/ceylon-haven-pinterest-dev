#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Apply migration 0003 to development Supabase
 * Run with: NODE_ENV=test npx tsx scripts/apply-migration.ts
 */

import { createClient } from '@supabase/supabase-js';

const TEST_SUPABASE_URL = process.env['TEST_SUPABASE_URL'];
const TEST_SUPABASE_SERVICE_ROLE_KEY = process.env['TEST_SUPABASE_SERVICE_ROLE_KEY'];
const TEST_SUPABASE_PROJECT_REF = process.env['TEST_SUPABASE_PROJECT_REF'];

if (!TEST_SUPABASE_URL || !TEST_SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Missing required environment variables');
  console.error('TEST_SUPABASE_URL and TEST_SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

async function main() {
  console.log('Migration 0003: Phase 3 Integration Config');
  console.log(`Target: ${TEST_SUPABASE_PROJECT_REF}`);
  console.log('');

  const client = createClient(TEST_SUPABASE_URL!, TEST_SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Check if tables already exist
  console.log('Checking if tables already exist...');
  const { error: tokenCheckError } = await client
    .from('pinterest_oauth_tokens')
    .select('id')
    .limit(0);

  const { error: routingCheckError } = await client
    .from('board_routing_config')
    .select('id')
    .limit(0);

  const tokenExists = !tokenCheckError;
  const routingExists = !routingCheckError;

  console.log('pinterest_oauth_tokens:', tokenExists ? '✓ EXISTS' : '✗ MISSING');
  console.log('board_routing_config:', routingExists ? '✓ EXISTS' : '✗ MISSING');
  console.log('');

  if (tokenExists && routingExists) {
    console.log('✓ Migration 0003 already applied!');
    console.log('');
    console.log('Verifying table structure...');

    // Verify tables have expected columns
    const { error: tokenColumnsError } = await client
      .from('pinterest_oauth_tokens')
      .select('*')
      .limit(0);

    if (!tokenColumnsError) {
      console.log('✓ pinterest_oauth_tokens table OK');
    } else {
      console.log('✗ pinterest_oauth_tokens structure issue:', tokenColumnsError.message);
    }

    const { error: routingColumnsError } = await client
      .from('board_routing_config')
      .select('*')
      .limit(0);

    if (!routingColumnsError) {
      console.log('✓ board_routing_config table OK');
    } else {
      console.log('✗ board_routing_config structure issue:', routingColumnsError.message);
    }

    process.exit(0);
  }

  console.log('NOTICE: Migration 0003 must be applied manually via Supabase Dashboard');
  console.log('');
  console.log('Steps:');
  console.log('1. Go to: https://app.supabase.com/project/' + TEST_SUPABASE_PROJECT_REF + '/sql');
  console.log('2. Click "New Query"');
  console.log('3. Paste the contents of: db/migrations/0003_phase3_integration_config.sql');
  console.log('4. Click "Run"');
  console.log('5. Run this script again to verify');
  console.log('');

  process.exit(1);
}

main().catch(error => {
  console.error('Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
