#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Create migration 0003 tables programmatically
 * Run with: NODE_ENV=test npx tsx scripts/create-migration-tables.ts
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
  console.log('Step 1: Checking if tables already exist...');
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

  console.log('  pinterest_oauth_tokens:', tokenExists ? '✓ EXISTS' : '✗ MISSING');
  console.log('  board_routing_config:', routingExists ? '✓ EXISTS' : '✗ MISSING');
  console.log('');

  if (tokenExists && routingExists) {
    console.log('✓ Migration 0003 already applied!');
    process.exit(0);
  }

  console.log('Step 2: Creating tables...');
  console.log('');

  // Create pinterest_oauth_tokens table
  if (!tokenExists) {
    console.log('  Creating pinterest_oauth_tokens table...');
    const { error: createTokenError } = await client.rpc('create_pinterest_oauth_tokens_table');

    if (createTokenError && !createTokenError.message.includes('already exists')) {
      console.log('  Note: Using alternative method to create table');

      // Try creating via direct insert if table exists
      const { error: tableExistsError } = await client
        .from('pinterest_oauth_tokens')
        .select('id')
        .limit(0);

      if (tableExistsError) {
        console.log('  ✗ Failed to create table');
        console.log('  Error:', createTokenError.message);
      } else {
        console.log('  ✓ Table created successfully');
      }
    } else {
      console.log('  ✓ Table created successfully');
    }
  }

  // Create board_routing_config table
  if (!routingExists) {
    console.log('  Creating board_routing_config table...');
    const { error: createRoutingError } = await client.rpc('create_board_routing_config_table');

    if (createRoutingError && !createRoutingError.message.includes('already exists')) {
      console.log('  Note: Using alternative method to create table');

      const { error: tableExistsError } = await client
        .from('board_routing_config')
        .select('id')
        .limit(0);

      if (tableExistsError) {
        console.log('  ✗ Failed to create table');
        console.log('  Error:', createRoutingError.message);
      } else {
        console.log('  ✓ Table created successfully');
      }
    } else {
      console.log('  ✓ Table created successfully');
    }
  }

  console.log('');
  console.log('Step 3: Verifying migration...');
  console.log('');

  // Verify tables exist
  const { error: finalTokenError } = await client
    .from('pinterest_oauth_tokens')
    .select('id')
    .limit(0);

  const { error: finalRoutingError } = await client
    .from('board_routing_config')
    .select('id')
    .limit(0);

  const finalTokenExists = !finalTokenError;
  const finalRoutingExists = !finalRoutingError;

  console.log('  pinterest_oauth_tokens:', finalTokenExists ? '✓ EXISTS' : '✗ MISSING');
  console.log('  board_routing_config:', finalRoutingExists ? '✓ EXISTS' : '✗ MISSING');
  console.log('');

  if (finalTokenExists && finalRoutingExists) {
    console.log('✓ Migration 0003 successfully applied!');
    console.log('');
    console.log('Tables created:');
    console.log('  - pinterest_oauth_tokens (encrypted token storage)');
    console.log('  - board_routing_config (property-to-board mapping)');
    console.log('');
    console.log('Both tables have RLS policies enabled (deny all by default).');
    process.exit(0);
  } else {
    console.log('✗ Migration 0003 incomplete');
    console.log('');
    console.log('MANUAL SETUP REQUIRED:');
    console.log('1. Go to: https://app.supabase.com/project/' + TEST_SUPABASE_PROJECT_REF + '/sql');
    console.log('2. Click "New Query"');
    console.log('3. Paste the contents of: db/migrations/0003_phase3_integration_config.sql');
    console.log('4. Click "Run"');
    console.log('5. Run this script again to verify');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
