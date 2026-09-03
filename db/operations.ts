import { SupabaseClient } from '@supabase/supabase-js';

export type ClaimResult = 'success' | 'already_claimed' | 'not_found';

export interface AtomicClaimResponse {
  result: ClaimResult;
  facebookPostId: string;
  message: string;
}

export interface PublishPinResponse {
  success: boolean;
  message: string;
  pin_id: string | null;
}

export interface RetryResponse {
  success: boolean;
  new_retry_count: number | null;
  will_retry: boolean;
}

/**
 * Atomically claim a Facebook post for publishing.
 * Uses PostgreSQL function (true transaction) to ensure only one process can claim a post.
 * Precondition: Post must be in 'discovered' state
 * Postcondition: Post transitioned to 'publishing' or error returned
 *
 * @param client Supabase client
 * @param facebookPostId The Facebook post ID to claim
 * @returns AtomicClaimResponse with result and message
 */
export async function claimForPublishing(
  client: SupabaseClient,
  facebookPostId: string,
): Promise<AtomicClaimResponse> {
  const { data, error } = await client.rpc('claim_for_publishing', {
    p_facebook_post_id: facebookPostId,
  });

  if (error) {
    throw new Error(`Failed to claim post for publishing: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error(`No response from claim_for_publishing function`);
  }

  const result = data[0];
  let claimResult: ClaimResult = 'not_found';

  if (result.success) {
    claimResult = 'success';
  } else if (result.message.includes('not in discovered state')) {
    claimResult = 'already_claimed';
  } else if (result.message.includes('not found')) {
    claimResult = 'not_found';
  }

  return {
    result: claimResult,
    facebookPostId,
    message: result.message,
  };
}

/**
 * Record a successfully published Pinterest pin.
 * Uses PostgreSQL function (true transaction) to atomically:
 * 1. Verify post is in 'publishing' state
 * 2. Insert pinterest_pins record
 * 3. Transition post to 'published'
 *
 * All operations committed together or entire transaction rolled back.
 *
 * Precondition: Post must be in 'publishing' state
 * Postcondition: Both pinterest_pins and facebook_posts updated atomically or entire transaction rolled back
 *
 * @param client Supabase client
 * @param facebookPostId The Facebook post ID
 * @param pinterestPinId The Pinterest pin ID
 * @param boardName The board name where pin was created
 * @param destinationUrl The URL the pin links to
 * @param pinUrl Optional: the Pinterest pin URL
 * @param boardId Optional: the board ID
 * @returns true if successful, throws on error
 */
export async function recordPublishedPin(
  client: SupabaseClient,
  facebookPostId: string,
  pinterestPinId: string,
  boardName: string,
  destinationUrl: string,
  pinUrl?: string,
  boardId?: string,
): Promise<boolean> {
  const { data, error } = await client.rpc('record_published_pin', {
    p_facebook_post_id: facebookPostId,
    p_pinterest_pin_id: pinterestPinId,
    p_pinterest_pin_url: pinUrl || `https://pinterest.com/pin/${pinterestPinId}`,
    p_board_id: boardId || null,
    p_board_name: boardName,
    p_destination_url: destinationUrl,
  });

  if (error) {
    throw new Error(`Failed to record published pin: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error(`No response from record_published_pin function`);
  }

  const result = data[0];

  if (!result.success) {
    throw new Error(`Failed to record published pin: ${result.message}`);
  }

  return true;
}

/**
 * Atomically increment retry count and mark post as failed.
 * Uses PostgreSQL function (single UPDATE) to prevent race conditions.
 *
 * Precondition: Post must be in 'publishing' state
 * Postcondition: retry_count incremented, status='failed', or error returned
 *
 * @param client Supabase client
 * @param facebookPostId The Facebook post ID
 * @param errorMessage The error message/reason for failure
 * @returns Object with success, new_retry_count, and will_retry
 */
export async function incrementRetryAndFail(
  client: SupabaseClient,
  facebookPostId: string,
  errorMessage: string,
): Promise<RetryResponse> {
  const { data, error } = await client.rpc('increment_retry_and_fail', {
    p_facebook_post_id: facebookPostId,
    p_error_message: errorMessage,
  });

  if (error) {
    throw new Error(`Failed to increment retry count: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error(`No response from increment_retry_and_fail function`);
  }

  const result = data[0];

  if (!result.success) {
    return {
      success: false,
      new_retry_count: null,
      will_retry: false,
    };
  }

  return {
    success: true,
    new_retry_count: result.new_retry_count,
    will_retry: result.will_retry,
  };
}

/**
 * Atomically claim a failed post for retry.
 * Uses PostgreSQL function to ensure only one process can claim a post for retry.
 *
 * Precondition: Post must be in 'failed' state with retry_count < 3
 * Postcondition: Post transitioned to 'publishing' or error returned
 *
 * @param client Supabase client
 * @param facebookPostId The Facebook post ID
 * @returns true if claimed successfully, throws on error
 */
export async function claimForRetry(
  client: SupabaseClient,
  facebookPostId: string,
): Promise<boolean> {
  const { data, error } = await client.rpc('claim_for_retry', {
    p_facebook_post_id: facebookPostId,
  });

  if (error) {
    throw new Error(`Failed to claim post for retry: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error(`No response from claim_for_retry function`);
  }

  const result = data[0];

  if (!result.success) {
    throw new Error(`Post not retryable: ${result.message}`);
  }

  return true;
}

/**
 * Update a post to 'uncertain' status (published but not confirmed in DB).
 * Uses PostgreSQL function for state-protected transition.
 *
 * Precondition: Post must be in 'publishing' state
 * Postcondition: Post transitioned to 'uncertain' or error returned
 *
 * @param client Supabase client
 * @param facebookPostId The Facebook post ID
 * @param errorMessage The error message explaining uncertainty
 * @returns true if successful
 */
export async function markPostUncertain(
  client: SupabaseClient,
  facebookPostId: string,
  errorMessage: string,
): Promise<boolean> {
  const { data, error } = await client.rpc('mark_post_uncertain', {
    p_facebook_post_id: facebookPostId,
    p_error_message: errorMessage,
  });

  if (error) {
    throw new Error(`Failed to mark post as uncertain: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error(`No response from mark_post_uncertain function`);
  }

  const result = data[0];

  if (!result.success) {
    throw new Error(`Failed to mark post as uncertain: ${result.message}`);
  }

  return true;
}

/**
 * Update a post to 'skipped' status with reason.
 * Uses PostgreSQL function for state-protected transition.
 *
 * Precondition: Post must be in 'discovered' state
 * Postcondition: Post transitioned to 'skipped' or error returned
 *
 * @param client Supabase client
 * @param facebookPostId The Facebook post ID
 * @param skipReason The reason for skipping
 * @returns true if successful
 */
export async function markPostSkipped(
  client: SupabaseClient,
  facebookPostId: string,
  skipReason: string,
): Promise<boolean> {
  const { data, error } = await client.rpc('mark_post_skipped', {
    p_facebook_post_id: facebookPostId,
    p_skip_reason: skipReason,
  });

  if (error) {
    throw new Error(`Failed to mark post as skipped: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error(`No response from mark_post_skipped function`);
  }

  const result = data[0];

  if (!result.success) {
    throw new Error(`Failed to mark post as skipped: ${result.message}`);
  }

  return true;
}

/**
 * Get current retry count for a post.
 *
 * @param client Supabase client
 * @param facebookPostId The Facebook post ID
 * @returns Current retry count
 */
export async function getRetryCount(
  client: SupabaseClient,
  facebookPostId: string,
): Promise<number> {
  const { data, error } = await client
    .from('facebook_posts')
    .select('retry_count')
    .eq('facebook_post_id', facebookPostId)
    .single();

  if (error || !data) {
    return 0;
  }

  return data.retry_count || 0;
}
