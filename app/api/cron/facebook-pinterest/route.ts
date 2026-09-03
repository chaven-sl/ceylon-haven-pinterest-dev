import { NextRequest, NextResponse } from 'next/server';
import { getValidatedEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel Hobby tier limit

/**
 * Cron endpoint for automated Facebook → Pinterest publishing.
 * Validates CRON_SECRET via Authorization header.
 *
 * HTTP Method: GET (per Vercel Cron Jobs documentation)
 * Schedule: Daily at 06:30 UTC (12:00 PM Asia/Colombo)
 * Cron expression: 30 6 * * *
 *
 * Vercel invokes scheduled cron routes using HTTP GET, not POST.
 * See: https://vercel.com/docs/cron-jobs
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Validate CRON_SECRET from Authorization header
    const authHeader = request.headers.get('authorization');
    const env = getValidatedEnv();

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Missing or invalid Authorization header',
          phase: 'Phase 2.3',
        },
        { status: 401 },
      );
    }

    const providedSecret = authHeader.substring('Bearer '.length);
    if (providedSecret !== env.CRON_SECRET) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Invalid CRON_SECRET',
          phase: 'Phase 2.3',
        },
        { status: 401 },
      );
    }

    // Phase 2.3: Mock/no-op behavior
    // No real API calls are made
    const endTime = Date.now();
    const durationMs = endTime - startTime;

    return NextResponse.json(
      {
        success: true,
        phase: 'Phase 2.3',
        message: 'Cron execution started (mock behavior - no real API calls)',
        timestamp: new Date().toISOString(),
        executionId: `exec_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        httpMethod: 'GET',
        schedule: {
          frequency: 'Daily',
          time: '06:30 UTC (12:00 PM Asia/Colombo)',
          timezone: 'UTC',
          note: 'User specified "noon" = 12:00 PM, so actual schedule is 06:30 UTC (12:00 PM UTC+5:30)',
        },
        phaseSummary: {
          phase: '2.3',
          status: 'Final Corrections',
          realApiCallsMade: 0,
          facebookApiCalls: 0,
          pinterestApiCalls: 0,
          realPinCreated: false,
          deploymentTarget: 'Local only - no production deployment',
        },
        duration: {
          ms: durationMs,
          seconds: (durationMs / 1000).toFixed(2),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const endTime = Date.now();
    const durationMs = endTime - startTime;

    console.error('[cron/facebook-pinterest] Error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        phase: 'Phase 2.3',
        duration: {
          ms: durationMs,
          seconds: (durationMs / 1000).toFixed(2),
        },
      },
      { status: 500 },
    );
  }
}

/**
 * POST handler: Optional manual/admin endpoint
 * Not used by Vercel's scheduled cron (which uses GET).
 * Kept for testing and manual invocation only.
 */
export async function POST(_request: NextRequest): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: 'Method Not Allowed',
      message: 'This endpoint is invoked via GET by Vercel Cron Jobs. For testing, use GET with Authorization header.',
      note: 'POST is not used by Vercel\'s scheduled execution (see https://vercel.com/docs/cron-jobs)',
      httpMethod: 'GET (required)',
    },
    { status: 405 },
  );
}
