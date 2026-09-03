/**
 * State Machine: Valid transitions for Facebook posts in the publishing pipeline.
 * Implements strict validation of post status transitions.
 */

export type PostStatus =
  | 'discovered'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'uncertain'
  | 'skipped';

export const POST_STATUSES: Record<PostStatus, PostStatus> = {
  discovered: 'discovered',
  publishing: 'publishing',
  published: 'published',
  failed: 'failed',
  uncertain: 'uncertain',
  skipped: 'skipped',
};

const MAX_RETRIES = 3;

/**
 * Valid state transitions.
 * Maps from current state to array of allowed next states.
 */
const VALID_TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  discovered: ['publishing', 'skipped'],
  publishing: ['published', 'failed', 'uncertain'],
  published: [],
  failed: ['publishing'], // Can retry if retry_count < MAX_RETRIES
  uncertain: [],
  skipped: [],
};

export interface TransitionValidationResult {
  valid: boolean;
  nextState?: PostStatus;
  error?: string;
}

/**
 * Validate whether a transition from currentState to nextState is allowed.
 * @param currentState The current status of a post
 * @param nextState The desired status to transition to
 * @param retryCount Current retry count (only relevant for failed -> publishing)
 * @returns TransitionValidationResult indicating if transition is valid
 */
export function validateTransition(
  currentState: PostStatus,
  nextState: PostStatus,
  retryCount: number = 0,
): TransitionValidationResult {
  // Check if current state exists
  if (!(currentState in POST_STATUSES)) {
    return {
      valid: false,
      error: `Invalid current state: ${currentState}`,
    };
  }

  // Check if next state exists
  if (!(nextState in POST_STATUSES)) {
    return {
      valid: false,
      error: `Invalid next state: ${nextState}`,
    };
  }

  // Check if transition is in allowed list
  const allowedNextStates = VALID_TRANSITIONS[currentState];
  if (!allowedNextStates.includes(nextState)) {
    return {
      valid: false,
      error: `Cannot transition from ${currentState} to ${nextState}. ` +
        `Allowed transitions: ${allowedNextStates.join(', ')}`,
    };
  }

  // Special case: failed -> publishing requires retry_count < MAX_RETRIES
  if (currentState === 'failed' && nextState === 'publishing') {
    if (retryCount >= MAX_RETRIES) {
      return {
        valid: false,
        error: `Cannot retry: max retries (${MAX_RETRIES}) exceeded. Current retry_count: ${retryCount}`,
      };
    }
  }

  return {
    valid: true,
    nextState,
  };
}

/**
 * Check if a post status is terminal (no further transitions possible).
 * @param status The post status to check
 * @returns true if status is terminal
 */
export function isTerminalStatus(status: PostStatus): boolean {
  return VALID_TRANSITIONS[status].length === 0;
}

/**
 * Check if a post status allows retrying (e.g., failed with retry_count < MAX_RETRIES).
 * @param status The post status to check
 * @param retryCount Current retry count
 * @returns true if post can be retried
 */
export function canRetry(status: PostStatus, retryCount: number): boolean {
  if (status !== 'failed') {
    return false;
  }
  return retryCount < MAX_RETRIES;
}

/**
 * Get max allowed retries.
 */
export function getMaxRetries(): number {
  return MAX_RETRIES;
}
