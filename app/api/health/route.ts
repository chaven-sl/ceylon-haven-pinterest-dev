import { NextResponse } from 'next/server';
import { getEnvInfo, isEnvConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const envConfigured = isEnvConfigured();
  const envInfo = getEnvInfo();

  const response = {
    status: 'ok',
    phase: 'Phase 2: Foundation',
    timestamp: new Date().toISOString(),
    environment: {
      supabaseConfigured: envInfo.supabaseConfigured,
      facebookConfigured: envInfo.facebookConfigured,
      pinterestConfigured: envInfo.pinterestConfigured,
      nodeEnv: envInfo.nodeEnv,
    },
    isHealthy: envConfigured,
    requiredEnvConfigured: {
      SUPABASE_URL: Boolean(process.env['SUPABASE_URL']),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env['SUPABASE_SERVICE_ROLE_KEY']),
      SUPABASE_ANON_KEY: Boolean(process.env['SUPABASE_ANON_KEY']),
      CRON_SECRET: Boolean(process.env['CRON_SECRET']),
      FB_GRAPH_API_VERSION: Boolean(process.env['FB_GRAPH_API_VERSION']),
    },
    message: envConfigured
      ? 'All required environment variables configured'
      : 'Missing required environment variables. See requiredEnvConfigured for details.',
  };

  return NextResponse.json(response);
}
