/**
 * Classification logic for Facebook posts.
 * Determines if a post is suitable for Pinterest publishing.
 */

export type PostClassification =
  | 'supported'
  | 'video_not_supported'
  | 'reel_not_supported'
  | 'no_image'
  | 'no_usable_image'
  | 'text_only';

export interface PostClassificationResult {
  classification: PostClassification;
  isSupported: boolean;
  reason: string;
  imageUrl?: string;
}

/**
 * Represents a Facebook post for classification purposes.
 */
export interface FacebookPostData {
  id: string;
  type?: string;
  story?: string;
  message?: string;
  imageUrl?: string;
  permalink?: string;
  attachments?: {
    data?: Array<{
      type?: string;
      media?: {
        image?: {
          height?: number;
          width?: number;
          src?: string;
        };
      };
      title?: string;
      url?: string;
    }>;
  };
}

/**
 * Classify a Facebook post based on its content and media.
 *
 * @param post The Facebook post data
 * @returns Classification result with support status and reason
 */
export function classifyPost(post: FacebookPostData): PostClassificationResult {
  // Check for video posts
  if (post.type === 'video' || (post.story && post.story.includes('video'))) {
    return {
      classification: 'video_not_supported',
      isSupported: false,
      reason: 'Video posts are not supported in Phase 2',
    };
  }

  // Check for Reel posts (special type on Facebook)
  if (post.type === 'reel' || (post.story && post.story.toLowerCase().includes('reel'))) {
    return {
      classification: 'reel_not_supported',
      isSupported: false,
      reason: 'Reel posts are not supported in Phase 2',
    };
  }

  // Check for image URL (primary image)
  if (post.imageUrl && isValidImageUrl(post.imageUrl)) {
    return {
      classification: 'supported',
      isSupported: true,
      reason: 'Single-image post with valid image URL',
      imageUrl: post.imageUrl,
    };
  }

  // Check for attachments (fallback)
  if (post.attachments?.data && post.attachments.data.length > 0) {
    const attachment = post.attachments.data[0];

    if (attachment) {
      // Check if attachment has image
      if (attachment.media?.image?.src && isValidImageUrl(attachment.media.image.src)) {
        return {
          classification: 'supported',
          isSupported: true,
          reason: 'Image from post attachment',
          imageUrl: attachment.media.image.src,
        };
      }

      // Attachment exists but has no usable image
      if (attachment.type === 'video') {
        return {
          classification: 'video_not_supported',
          isSupported: false,
          reason: 'Attachment is a video (not supported in Phase 2)',
        };
      }
    }
  }

  // Check if post has message/caption (text-only)
  if (post.message || post.story) {
    return {
      classification: 'text_only',
      isSupported: false,
      reason: 'Text-only post (no image)',
    };
  }

  // Post has no usable image
  return {
    classification: 'no_usable_image',
    isSupported: false,
    reason: 'Post has no usable image',
  };
}

/**
 * Check if a URL is a valid image URL.
 * Very permissive: assumes HTTPS URLs with image-like paths are valid.
 *
 * @param url The URL to validate
 * @returns true if URL looks like a valid image
 */
function isValidImageUrl(url: string | undefined): url is string {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const urlObj = new URL(url);

    // Must be HTTPS
    if (urlObj.protocol !== 'https:') {
      return false;
    }

    // Common image hosts (Facebook CDNs)
    const validHosts = [
      'fbcdn.net',
      'fbcdn-sphotos-',
      'facebook.com',
      'instagram.com',
      'cdninstagram.com',
      'scontent',
    ];

    const host = urlObj.hostname.toLowerCase();
    const isKnownImageHost = validHosts.some((h) => host.includes(h));

    if (!isKnownImageHost) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Get a skip reason from classification.
 * Returns skip reason if post should be skipped, undefined if supported.
 *
 * @param classification The post classification
 * @returns Skip reason string or undefined
 */
export function getSkipReasonFromClassification(
  classification: PostClassification,
): string | undefined {
  switch (classification) {
    case 'supported':
      return undefined;
    case 'video_not_supported':
      return 'Video posts not supported in Phase 2';
    case 'reel_not_supported':
      return 'Reel posts not supported in Phase 2';
    case 'text_only':
      return 'Text-only post with no image';
    case 'no_image':
      return 'Post has no image attachment';
    case 'no_usable_image':
      return 'Post has no usable image URL';
    default:
      return 'Unknown classification';
  }
}
