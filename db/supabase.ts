import { createClient } from '@supabase/supabase-js';
import { getValidatedEnv } from '@/lib/env';

let supabaseClient: ReturnType<typeof createClient> | null = null;

/**
 * Get or create Supabase client (singleton pattern).
 * Uses service_role key for server-side operations.
 * Never expose to client-side code.
 */
export function getSupabaseClient(): ReturnType<typeof createClient> {
  if (supabaseClient) {
    return supabaseClient;
  }

  const env = getValidatedEnv();

  supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseClient;
}

/**
 * Get Supabase client for admin operations.
 * This bypasses RLS; use only server-side.
 */
export function getSupabaseAdmin(): ReturnType<typeof createClient> {
  return getSupabaseClient();
}
