/**
 * Facebook Graph API Client (v26)
 * Handles page feed fetching, post normalization, and pagination.
 * NO LIVE API CALLS IN TESTS - all mocked for Phase 3.
 */

import { getValidatedEnv } from '@/lib/env';

export interface FacebookPost {
  id: string;
  created_time: string;
  message?: string;
  story?: string;
  full_picture?: string;
  attachments?: FacebookAttachment[];
  permalink_url?: string;
  status_type?: string;
}

export interface FacebookAttachment {
  type: string;
  media?: { image?: { src: string } };
  url?: string;
  target?: { url?: string };
}

export interface FacebookPagePostsResponse {
  data: FacebookPost[];
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
  };
}

export interface FacebookError {
  error: {
    code: number;
    message: string;
    type: string;
  };
}

/**
 * Error classification for Facebook API
 */
export class FacebookAuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FacebookAuthenticationError';
  }
}

export class FacebookPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FacebookPermissionError';
  }
}

export class FacebookRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FacebookRateLimitError';
  }
}

export class FacebookInvalidPageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FacebookInvalidPageError';
  }
}

export class FacebookGraphAPIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FacebookGraphAPIError';
  }
}

export class FacebookNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FacebookNetworkError';
  }
}

/**
 * Facebook Graph API Client
 * Supports Meta Graph API v26.0 for fetching page posts
 */
export class FacebookClient {
  private accessToken: string;
  private pageId: string;
  private apiVersion: string;
  private baseUrl = 'https://graph.facebook.com';

  constructor(accessToken: string, pageId: string, apiVersion: string = 'v26') {
    if (!accessToken || !pageId) {
      throw new Error('Facebook accessToken and pageId are required');
    }
    this.accessToken = accessToken;
    this.pageId = pageId;
    this.apiVersion = apiVersion;
  }

  /**
   * Fetch page posts with optional pagination
   */
  async fetchPagePosts(options?: {
    limit?: number;
    after?: string;
  }): Promise<{ posts: FacebookPost[]; nextCursor?: string }> {
    const limit = options?.limit || 25;
    const after = options?.after;

    const params = new URLSearchParams({
      access_token: this.accessToken,
      limit: String(limit),
      fields: 'id,created_time,message,story,full_picture,status_type,permalink_url,attachments{url,type,media,target}',
    });

    if (after) {
      params.append('after', after);
    }

    const url = `${this.baseUrl}/${this.apiVersion}/${this.pageId}/feed?${params.toString()}`;

    try {
      const response = await fetch(url, { method: 'GET' });

      if (!response.ok) {
        await this.handleError(response);
      }

      const data: FacebookPagePostsResponse = await response.json();

      return {
        posts: data.data || [],
        nextCursor: data.paging?.cursors?.after,
      };
    } catch (error) {
      throw this.categorizeError(error);
    }
  }

  /**
   * Normalize Facebook post for internal use
   */
  normalizeFacebookPost(post: FacebookPost): {
    facebookPostId: string;
    caption: string;
    imageUrl?: string;
    mediaType: 'single-image' | 'video' | 'text-only' | 'carousel' | 'other';
    createdAt: Date;
    permaLink?: string;
  } {
    const imageUrl = this.extractImageUrl(post);
    const mediaType = this.classifyMedia(post);

    return {
      facebookPostId: post.id,
      caption: post.message || post.story || '',
      imageUrl,
      mediaType,
      createdAt: new Date(post.created_time),
      permaLink: post.permalink_url,
    };
  }

  /**
   * Extract image URL from post attachments
   */
  private extractImageUrl(post: FacebookPost): string | undefined {
    if (!post.attachments || post.attachments.length === 0) {
      return undefined;
    }

    for (const attachment of post.attachments) {
      if (attachment.media?.image?.src) {
        return attachment.media.image.src;
      }
    }

    return undefined;
  }

  /**
   * Classify post media type
   */
  classifyMedia(post: FacebookPost): 'single-image' | 'video' | 'text-only' | 'carousel' | 'other' {
    if (!post.attachments || post.attachments.length === 0) {
      return 'text-only';
    }

    const attachmentCount = post.attachments.length;

    // Carousel/multi-image posts
    if (attachmentCount > 1) {
      return 'carousel';
    }

    const attachment = post.attachments[0];
    if (!attachment) {
      return 'other';
    }
    const attachmentType = attachment.type?.toLowerCase() || '';

    if (attachmentType === 'video' || attachmentType === 'video_list') {
      return 'video';
    }

    if (attachmentType === 'photo' || attachmentType === 'image') {
      return 'single-image';
    }

    return 'other';
  }

  /**
   * Handle HTTP errors from Facebook API
   */
  private async handleError(response: Response): Promise<never> {
    let errorData: FacebookError | null = null;

    try {
      errorData = await response.json();
    } catch {
      // Response was not JSON
    }

    const status = response.status;
    const errorMessage = errorData?.error?.message || response.statusText;

    if (status === 401) {
      throw new FacebookAuthenticationError(`Invalid or expired token: ${errorMessage}`);
    }

    if (status === 403) {
      throw new FacebookPermissionError(`Permission denied: ${errorMessage}`);
    }

    if (status === 404) {
      throw new FacebookInvalidPageError(`Page not found: ${errorMessage}`);
    }

    if (status === 429) {
      throw new FacebookRateLimitError(`Rate limit exceeded: ${errorMessage}`);
    }

    if (status >= 500) {
      throw new FacebookGraphAPIError(`Server error (${status}): ${errorMessage}`);
    }

    throw new FacebookGraphAPIError(`API error (${status}): ${errorMessage}`);
  }

  /**
   * Categorize caught errors
   */
  private categorizeError(error: unknown): Error {
    if (error instanceof FacebookAuthenticationError) return error;
    if (error instanceof FacebookPermissionError) return error;
    if (error instanceof FacebookRateLimitError) return error;
    if (error instanceof FacebookInvalidPageError) return error;
    if (error instanceof FacebookGraphAPIError) return error;

    if (error instanceof TypeError) {
      // Network errors
      return new FacebookNetworkError(`Network error: ${(error as Error).message}`);
    }

    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        return new FacebookNetworkError(`Timeout: ${error.message}`);
      }
      if (error.message.includes('connection')) {
        return new FacebookNetworkError(`Connection error: ${error.message}`);
      }
    }

    return new FacebookGraphAPIError(`Unexpected error: ${String(error)}`);
  }

  /**
   * Check if error is transient (safe to retry)
   */
  static isTransientError(error: Error): boolean {
    return (
      error instanceof FacebookRateLimitError ||
      error instanceof FacebookNetworkError ||
      (error instanceof FacebookGraphAPIError && error.message.includes('Server error'))
    );
  }

  /**
   * Check if error is fatal (do not retry)
   */
  static isFatalError(error: Error): boolean {
    return (
      error instanceof FacebookAuthenticationError ||
      error instanceof FacebookPermissionError ||
      error instanceof FacebookInvalidPageError
    );
  }
}

/**
 * Factory function to create FacebookClient with validated environment variables
 */
export function createFacebookClient(): FacebookClient {
  const env = getValidatedEnv();

  if (!env.FACEBOOK_PAGE_ID || !env.FACEBOOK_ACCESS_TOKEN) {
    throw new Error(
      'Facebook integration requires FACEBOOK_PAGE_ID and FACEBOOK_ACCESS_TOKEN. ' +
        'See .env.example for setup instructions.',
    );
  }

  return new FacebookClient(env.FACEBOOK_ACCESS_TOKEN, env.FACEBOOK_PAGE_ID, env.FB_GRAPH_API_VERSION);
}
