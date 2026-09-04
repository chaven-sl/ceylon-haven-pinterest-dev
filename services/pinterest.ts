/**
 * Pinterest API v5 Client
 * Handles OAuth tokens, board retrieval, and pin creation.
 * NO LIVE API CALLS IN TESTS - all mocked for Phase 3.
 *
 * ERROR SEMANTICS (Phase 3 Part 1 Completion):
 *
 * FATAL (state: failed, no retry):
 *   - HTTP 400 validation failure → caller's fault, don't retry
 *   - HTTP 401 authentication rejection → token invalid, don't retry
 *   - HTTP 403 permission rejection → app/token lacks permission, don't retry
 *   - HTTP 404 board not found → board ID invalid, don't retry
 *   - Local validation failure → input error, don't retry
 *
 * TRANSIENT (state: publishing/failed with retry):
 *   - HTTP 429 rate limit → wait and retry
 *   - Network error before send → connection error, safe to retry
 *   - Connection refused before send → network issue, safe to retry
 *
 * AMBIGUOUS (state: uncertain, no retry):
 *   - Socket disconnect after request sent → may have reached Pinterest
 *   - Timeout while waiting for response after body sent → may have reached Pinterest
 *   - Connection reset after request may have reached service → may have been processed
 *
 * Outcome: Avoid duplicates (uncertain) > automatic retry (ambiguous)
 */

export interface PinterestBoard {
  id: string;
  name: string;
  privacy?: string;
  url?: string;
}

export interface CreatePinInput {
  boardId: string;
  title: string;
  description?: string;
  link?: string;
  media: PinterestMediaSource;
}

export interface PinterestMediaSource {
  type: 'image_url' | 'image_base64';
  url?: string;
  data?: string;
}

export interface PinterestPin {
  id: string;
  created_at?: string;
  url?: string;
}

/**
 * Error classification for Pinterest API
 */
export class PinterestAuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PinterestAuthenticationError';
  }
}

export class PinterestPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PinterestPermissionError';
  }
}

export class PinterestRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PinterestRateLimitError';
  }
}

export class PinterestInvalidBoardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PinterestInvalidBoardError';
  }
}

export class PinterestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PinterestValidationError';
  }
}

export class PinterestAPIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PinterestAPIError';
  }
}

export class PinterestNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PinterestNetworkError';
  }
}

/**
 * Ambiguous outcome error: request may have reached Pinterest but response not received.
 * Must NOT auto-retry; requires manual verification to prevent duplicates.
 */
export class PinterestAmbiguousOutcomeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PinterestAmbiguousOutcomeError';
  }
}

/**
 * Pinterest API v5 Client
 * Requires valid access token (from OAuth or stored encrypted in Supabase)
 */
export class PinterestClient {
  private accessToken: string;
  private baseUrl = 'https://api.pinterest.com/v5';
  private rateLimitRemaining = 100;
  private rateLimitReset?: Date;

  constructor(accessToken: string) {
    if (!accessToken) {
      throw new Error('Pinterest accessToken is required');
    }
    this.accessToken = accessToken;
  }

  /**
   * Get user's Pinterest boards
   * Endpoint: GET /v5/user_account/boards
   */
  async getBoards(): Promise<PinterestBoard[]> {
    const url = `${this.baseUrl}/user_account/boards`;
    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await fetch(url, { method: 'GET', headers });

      this.updateRateLimitInfo(response);

      if (!response.ok) {
        await this.handleError(response);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      throw this.categorizeError(error);
    }
  }

  /**
   * Create a pin on Pinterest
   * Endpoint: POST /v5/pins
   */
  async createPin(input: CreatePinInput): Promise<{ id: string }> {
    // Validate input
    this.validatePinInput(input);

    const url = `${this.baseUrl}/pins`;
    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    const payload = {
      board_id: input.boardId,
      title: input.title,
      description: input.description,
      link: input.link,
      media_source: this.buildMediaSource(input.media),
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      this.updateRateLimitInfo(response);

      if (!response.ok) {
        await this.handleError(response);
      }

      const data = await response.json();
      return { id: data.id };
    } catch (error) {
      throw this.categorizeError(error);
    }
  }

  /**
   * Validate pin input before sending to API
   */
  private validatePinInput(input: CreatePinInput): void {
    if (!input.boardId) {
      throw new PinterestValidationError('boardId is required');
    }

    if (!input.title || input.title.length === 0) {
      throw new PinterestValidationError('title is required');
    }

    if (input.title.length > 100) {
      throw new PinterestValidationError('title must be 100 characters or less');
    }

    if (input.description && input.description.length > 500) {
      throw new PinterestValidationError('description must be 500 characters or less');
    }

    if (!input.media) {
      throw new PinterestValidationError('media is required');
    }

    if (input.media.type === 'image_url' && !input.media.url) {
      throw new PinterestValidationError('media.url is required for image_url type');
    }

    if (input.media.type === 'image_base64' && !input.media.data) {
      throw new PinterestValidationError('media.data is required for image_base64 type');
    }
  }

  /**
   * Build media source object for Pinterest API
   */
  private buildMediaSource(media: PinterestMediaSource): Record<string, unknown> {
    if (media.type === 'image_url') {
      return {
        source_type: 'image_url',
        url: media.url,
      };
    }

    if (media.type === 'image_base64') {
      return {
        source_type: 'image_base64',
        data: media.data,
      };
    }

    throw new PinterestValidationError(`Unknown media type: ${media.type}`);
  }

  /**
   * Update rate limit tracking from response headers
   */
  private updateRateLimitInfo(response: Response): void {
    const remaining = response.headers.get('x-rate-limit-remaining');
    const reset = response.headers.get('x-rate-limit-reset');

    if (remaining) {
      this.rateLimitRemaining = parseInt(remaining, 10);
    }

    if (reset) {
      this.rateLimitReset = new Date(parseInt(reset, 10) * 1000);
    }
  }

  /**
   * Get current rate limit status
   */
  getRateLimitInfo(): { remaining: number; reset?: Date } {
    return {
      remaining: this.rateLimitRemaining,
      reset: this.rateLimitReset,
    };
  }

  /**
   * Handle HTTP errors from Pinterest API
   *
   * CRITICAL: Fatal errors (400/401/403/404) MUST throw fatally.
   * Pinterest definitively rejected; no ambiguity. Do NOT retry.
   *
   * 5xx: Depends on context:
   *   - If response received with error status → definitive rejection (no retry)
   *   - If timeout before response → ambiguous (no auto-retry)
   */
  private async handleError(response: Response): Promise<never> {
    const status = response.status;

    let errorData: Record<string, unknown> | null = null;
    try {
      errorData = await response.json();
    } catch {
      // Response was not JSON; still a definitive HTTP response
    }

    const errorMessage = (errorData as Record<string, string> | null)?.['message'] || response.statusText;

    // Fatal errors: Pinterest definitively rejected
    // These are NOT ambiguous. Do NOT map to uncertain.
    if (status === 401) {
      throw new PinterestAuthenticationError(`Invalid or expired token: ${errorMessage}`);
    }

    if (status === 403) {
      throw new PinterestPermissionError(`Permission denied: ${errorMessage}`);
    }

    if (status === 404) {
      throw new PinterestInvalidBoardError(`Board not found: ${errorMessage}`);
    }

    if (status === 400) {
      throw new PinterestValidationError(`Invalid pin data: ${errorMessage}`);
    }

    // Rate limit is transient (wait and retry)
    if (status === 429) {
      throw new PinterestRateLimitError(`Rate limit exceeded: ${errorMessage}`);
    }

    // 5xx: Pinterest has definitively responded with an error.
    // This is not ambiguous (response was received).
    // Treat as API error; may be transient (service temporarily down).
    if (status >= 500) {
      throw new PinterestAPIError(`Server error (${status}): ${errorMessage}`);
    }

    throw new PinterestAPIError(`API error (${status}): ${errorMessage}`);
  }

  /**
   * Categorize caught errors into:
   *   1. Fatal (don't retry): 400, 401, 403, 404, validation
   *   2. Transient (retry safe): network before send, rate limit
   *   3. Ambiguous (no auto-retry): timeout/disconnect after send
   *
   * CRITICAL DISTINCTION:
   *   - TypeError from fetch → network error (pre-send safe to retry)
   *   - AbortError with timeout → could be post-send ambiguous
   *   - Timeout after we know request was sent → ambiguous
   */
  private categorizeError(error: unknown): Error {
    // Already categorized errors pass through
    if (error instanceof PinterestAuthenticationError) return error;
    if (error instanceof PinterestPermissionError) return error;
    if (error instanceof PinterestRateLimitError) return error;
    if (error instanceof PinterestInvalidBoardError) return error;
    if (error instanceof PinterestValidationError) return error;
    if (error instanceof PinterestAmbiguousOutcomeError) return error;
    if (error instanceof PinterestAPIError) return error;

    // TypeError usually means connection refused/DNS failure (pre-send, safe to retry)
    if (error instanceof TypeError) {
      const message = (error as Error).message;
      // Connection refused, DNS lookup failed, etc. → network error (transient)
      return new PinterestNetworkError(`Network error: ${message}`);
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Timeout: depends on context
      // If we know request was sent → ambiguous
      // If connection not established → transient
      if (message.includes('timeout')) {
        // For now, treat all timeouts as ambiguous (safer than retrying)
        // Caller can use retry_count to determine if this was a post-send timeout
        return new PinterestAmbiguousOutcomeError(`Timeout (may have reached Pinterest): ${error.message}`);
      }

      // Connection errors before send (refused, reset, etc.)
      if (message.includes('connection refused') || message.includes('connection reset')) {
        // Connection refused before send → safe to retry
        return new PinterestNetworkError(`Connection error (pre-send): ${error.message}`);
      }

      if (message.includes('connection')) {
        // Generic connection error → treat as ambiguous (safer)
        return new PinterestAmbiguousOutcomeError(`Connection error (ambiguous): ${error.message}`);
      }
    }

    return new PinterestAPIError(`Unexpected error: ${String(error)}`);
  }

  /**
   * Check if error is transient (safe to retry).
   *
   * Transient errors (request safe to retry):
   *   - Rate limit: Just wait and retry
   *   - Network error (pre-send): Connection refused, DNS failure
   *   - Some 5xx: Temporary server issues (ONLY if response was received, not timeout)
   */
  static isTransientError(error: Error): boolean {
    return (
      error instanceof PinterestRateLimitError ||
      error instanceof PinterestNetworkError
    );
    // NOTE: 5xx errors (PinterestAPIError) with definitive response are NOT automatically
    // retried by default. They require explicit handling based on the response context.
  }

  /**
   * Check if error is fatal (do not retry).
   *
   * Fatal errors (request failed definitively):
   *   - 401 Authentication: Token invalid/expired
   *   - 403 Permission: App/token lacks permission
   *   - 404 Board not found: Board ID invalid
   *   - 400 Validation: Request invalid (caller's fault)
   *
   * DO NOT retry these. They will always fail with the same input.
   */
  static isFatalError(error: Error): boolean {
    return (
      error instanceof PinterestAuthenticationError ||
      error instanceof PinterestPermissionError ||
      error instanceof PinterestInvalidBoardError ||
      error instanceof PinterestValidationError
    );
  }

  /**
   * Check if error is ambiguous (outcome unknown, do NOT auto-retry).
   *
   * Ambiguous errors (request MAY have reached Pinterest):
   *   - Timeout after request sent
   *   - Socket disconnect after transmission
   *   - Connection reset while processing
   *
   * These MUST NOT be auto-retried (risks duplicates).
   * Manual verification needed to determine if pin was created.
   */
  static isAmbiguousError(error: Error): boolean {
    return error instanceof PinterestAmbiguousOutcomeError;
  }
}
