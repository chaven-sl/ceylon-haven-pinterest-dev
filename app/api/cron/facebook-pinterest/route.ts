import { NextRequest, NextResponse } from 'next/server';
import { getValidatedEnv } from '@/lib/env';
import { getSupabaseAdmin } from '@/db/supabase';
import {
  claimForPublishing,
  recordPublishedPin,
  markPostUncertain,
  markPostSkipped,
  incrementRetryAndFail,
} from '@/db/operations';
import { PinterestClient, PinterestValidationError } from '@/services/pinterest';
import { FacebookClient, FacebookNetworkError, FacebookRateLimitError } from '@/services/facebook';
import { createBoardRouter } from '@/lib/board-routing';
import { createContentAdapter } from '@/lib/content-adapter';
import { createPinterestTokenManager } from '@/lib/pinterest-token-manager';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel Hobby tier limit

/**
 * Cron endpoint for automated Facebook → Pinterest publishing.
 * PHASE 3 PART 1: Production orchestrator integrated.
 *
 * Workflow:
 * 1. Validate CRON_SECRET
 * 2. Fetch posts in 'discovered' state
 * 3. For each post:
 *    a. Claim atomically
 *    b. Route to correct board
 *    c. Adapt content for Pinterest
 *    d. Create pin (with mocked or real API)
 *    e. Record result or mark uncertain
 *
 * Error Semantics:
 *   - Fatal error (400/401/403/404) → state: failed, no retry
 *   - Transient error (network/rate limit) → state: publishing/failed, retry on next cron
 *   - Ambiguous error (timeout after send) → state: uncertain, no retry
 *
 * HTTP Method: GET (per Vercel Cron Jobs documentation)
 * Schedule: Daily at 06:30 UTC (12:00 PM Asia/Colombo)
 * Cron expression: 30 6 * * *
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(7)}`;
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
          executionId,
          phase: 'Phase 3 Part 1',
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
          executionId,
          phase: 'Phase 3 Part 1',
        },
        { status: 401 },
      );
    }

    // ========================================================================
    // FAIL-CLOSED GUARD: Validate Pinterest readiness BEFORE any side effects
    // ========================================================================
    // This guard must run before Facebook API calls, Supabase queries/mutations,
    // or any other external operations to ensure fail-closed semantics.
    let pinterestAccessToken: string | null = null;
    try {
      const tokenManager = createPinterestTokenManager();
      pinterestAccessToken = await tokenManager.getValidAccessToken();

      if (!pinterestAccessToken) {
        return NextResponse.json(
          {
            error: 'Service Unavailable',
            message: 'Pinterest token not configured. Manual setup required.',
            executionId,
            phase: 'Phase 3 Part 1',
            sideEffects: 'none',
          },
          { status: 503 },
        );
      }
    } catch (error) {
      // Token manager failed; Pinterest integration not ready
      const tokenError = error instanceof Error ? error.message : String(error);
      console.error('[cron/fail-closed-guard] Pinterest token unavailable:', tokenError);
      return NextResponse.json(
        {
          error: 'Service Unavailable',
          message: 'Pinterest token retrieval failed. Manual re-authentication required.',
          reason: tokenError,
          executionId,
          phase: 'Phase 3 Part 1',
          sideEffects: 'none',
        },
        { status: 503 },
      );
    }

    // Initialize services (only after Pinterest readiness confirmed)
    const supabase = getSupabaseAdmin();
    const boardRouter = createBoardRouter();
    const contentAdapter = createContentAdapter();

    // ========================================================================
    // PHASE 1: FACEBOOK DISCOVERY - Fetch new posts from Facebook
    // ========================================================================
    let discoveredInThisRun = 0;
    try {
      const facebookClient = new FacebookClient(
        env.FACEBOOK_ACCESS_TOKEN!,
        env.FACEBOOK_PAGE_ID!,
        env.FB_GRAPH_API_VERSION || 'v26',
      );

      // Fetch latest posts from Facebook (limit: 10)
      const { posts: facebookPosts } = await facebookClient.fetchPagePosts({ limit: 10 });

      for (const fbPost of facebookPosts) {
        const facebookPostId = fbPost.id;

        // Check if post already exists in database
        const { data: existingPost } = await supabase
          .from('facebook_posts')
          .select('id')
          .eq('facebook_post_id', facebookPostId)
          .single();

        if (existingPost) {
          // Post already known, skip
          continue;
        }

        // Normalize post data
        const normalized = facebookClient.normalizeFacebookPost(fbPost);

        // Classify media type
        const mediaType = facebookClient.classifyMedia(fbPost);
        const imageUrl = normalized.imageUrl || fbPost.full_picture;

        // Determine initial status
        let status = 'discovered';
        let skipReason = null;

        if (mediaType === 'video' || mediaType === 'carousel' || mediaType === 'other') {
          status = 'skipped';
          skipReason = `Unsupported media type: ${mediaType}`;
        } else if (mediaType === 'text-only') {
          status = 'skipped';
          skipReason = 'No image found';
        }

        // Insert post into database
        const now = new Date().toISOString();
        const insertRecord = {
          facebook_post_id: facebookPostId,
          facebook_permalink: normalized.permaLink || `https://facebook.com/posts/${facebookPostId}`,
          caption: normalized.caption,
          image_url: imageUrl,
          date_published: normalized.createdAt.toISOString(),
          status,
          skip_reason: skipReason,
          retry_count: 0,
          created_at: now,
          updated_at: now,
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insertError } = await (supabase.from('facebook_posts') as any).insert(insertRecord);

        if (!insertError) {
          discoveredInThisRun++;
        } else {
          // Unique constraint violation likely (post already exists)
          console.warn(`[cron/facebook-discovery] Failed to insert post ${facebookPostId}: ${String(insertError)}`);
        }
      }
    } catch (error) {
      // Log but continue - Facebook discovery failure doesn't block Pinterest processing
      const facebookError = error instanceof Error ? error.message : String(error);
      if (
        !(error instanceof FacebookNetworkError) &&
        !(error instanceof FacebookRateLimitError)
      ) {
        console.error('[cron/facebook-discovery] Error fetching Facebook posts:', facebookError);
      } else {
        console.warn('[cron/facebook-discovery] Transient error (will retry next run):', facebookError);
      }
    }

    // ========================================================================
    // PHASE 2: PINTEREST PUBLISHING - Process discovered posts
    // ========================================================================
    // Pinterest token is guaranteed to be valid here (verified by fail-closed guard above)
    const pinterestClient = new PinterestClient(pinterestAccessToken);

    // Fetch posts in 'discovered' state
    const { data: discoveredPosts, error: fetchError } = (await supabase
      .from('facebook_posts')
      .select('*')
      .eq('status', 'discovered')
      .limit(10)) as { data: Array<Record<string, unknown>> | null; error: unknown };

    if (fetchError) {
      throw new Error(`Failed to fetch discovered posts: ${String(fetchError)}`);
    }

    const results = {
      executionId,
      phase: 'Phase 3 Part 1',
      timestamp: new Date().toISOString(),
      discovery: {
        fetchedFromFacebook: discoveredInThisRun,
        addedToDatabase: discoveredInThisRun,
      },
      totalDiscovered: discoveredPosts?.length || 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      uncertain: 0,
      details: [] as Array<{
        facebookPostId: string;
        status: 'published' | 'failed' | 'skipped' | 'uncertain';
        reason?: string;
      }>,
    };

    // Process each discovered post
    for (const postRecord of discoveredPosts || []) {
      const post = postRecord as Record<string, unknown>;
      const facebookPostId = post['facebook_post_id'] as string;

      results.processed++;

      try {
        // Atomically claim post for publishing
        const claimResult = await claimForPublishing(supabase, facebookPostId);

        if (claimResult.result !== 'success') {
          results.skipped++;
          results.details.push({
            facebookPostId,
            status: 'skipped',
            reason: `Already claimed: ${claimResult.message}`,
          });
          continue;
        }

        // Route to board
        const caption = (post['caption'] as string) || '';
        const routeResult = await boardRouter.routePost(caption);

        if (!routeResult.matched || !routeResult.boardId) {
          // No board mapping found
          await markPostSkipped(
            supabase,
            facebookPostId,
            `No board routing configured. Reason: ${routeResult.reason}`,
          );
          results.skipped++;
          results.details.push({
            facebookPostId,
            status: 'skipped',
            reason: routeResult.reason,
          });
          continue;
        }

        // Adapt content for Pinterest
        const content = contentAdapter.adapt({
          facebookCaption: caption,
          propertyName: (post['property_name'] as string) || undefined,
          propertyType: (post['property_type'] as string) || undefined,
          location: (post['location'] as string) || undefined,
          destinationUrl: routeResult.destinationUrl,
        });

        // Create pin on Pinterest
        const pinResult = await pinterestClient.createPin({
          boardId: routeResult.boardId,
          title: content.title,
          description: content.description,
          link: content.link,
          media: {
            type: 'image_url',
            url: (post['image_url'] as string) || 'https://via.placeholder.com/1000x1500?text=Ceylon+Haven',
          },
        });

        // Record published pin
        await recordPublishedPin(
          supabase,
          facebookPostId,
          pinResult.id,
          routeResult.boardId,
          routeResult.destinationUrl || '',
          `https://pinterest.com/pin/${pinResult.id}`,
          routeResult.boardId,
        );

        results.succeeded++;
        results.details.push({
          facebookPostId,
          status: 'published',
          reason: `Published to board ${routeResult.boardId}`,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Classify error and update state accordingly
        if (error instanceof PinterestValidationError) {
          // Fatal: validation error
          await incrementRetryAndFail(supabase, facebookPostId, errorMessage);
          results.failed++;
          results.details.push({
            facebookPostId,
            status: 'failed',
            reason: `Validation error (fatal): ${errorMessage}`,
          });
        } else if (
          error instanceof Error &&
          (error.name === 'PinterestAuthenticationError' ||
            error.name === 'PinterestPermissionError' ||
            error.name === 'PinterestInvalidBoardError')
        ) {
          // Fatal: auth/permission/board errors
          await incrementRetryAndFail(supabase, facebookPostId, errorMessage);
          results.failed++;
          results.details.push({
            facebookPostId,
            status: 'failed',
            reason: `Fatal error: ${errorMessage}`,
          });
        } else if (
          error instanceof Error &&
          error.name === 'PinterestAmbiguousOutcomeError'
        ) {
          // Ambiguous: mark uncertain, no retry
          await markPostUncertain(supabase, facebookPostId, errorMessage);
          results.uncertain++;
          results.details.push({
            facebookPostId,
            status: 'uncertain',
            reason: `Ambiguous outcome: ${errorMessage}`,
          });
        } else {
          // Transient or unknown: increment retry and mark failed
          await incrementRetryAndFail(supabase, facebookPostId, errorMessage);
          results.failed++;
          results.details.push({
            facebookPostId,
            status: 'failed',
            reason: `Transient/retry error: ${errorMessage}`,
          });
        }
      }
    }

    const endTime = Date.now();
    const durationMs = endTime - startTime;

    return NextResponse.json(
      {
        success: true,
        ...results,
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

    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[cron/facebook-pinterest] Error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: errorMessage,
        executionId,
        phase: 'Phase 3 Part 1',
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
