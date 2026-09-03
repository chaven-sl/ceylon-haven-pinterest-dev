/**
 * Test fixtures: Mock Facebook post data for testing
 * Used in integration tests and mock orchestration
 */

import { FacebookPostData } from '@/lib/classify';

/**
 * Single-image post (supported, will be published)
 */
export const FIXTURE_SINGLE_IMAGE_POST: FacebookPostData = {
  id: 'fb_post_001_single_image',
  type: 'photo',
  message: 'Beautiful beach sunset at The Beach Home',
  story: 'User posted a photo',
  imageUrl: 'https://scontent.fbkk1-1.fna.fbcdn.net/v/single_image_001.jpg',
  permalink: 'https://facebook.com/pages/ceylon-haven/posts/001',
  attachments: {
    data: [
      {
        type: 'photo',
        media: {
          image: {
            height: 1080,
            width: 1440,
            src: 'https://scontent.fbkk1-1.fna.fbcdn.net/v/single_image_001.jpg',
          },
        },
        title: 'Beautiful beach sunset at The Beach Home',
      },
    ],
  },
};

/**
 * Video post (skipped, will NOT be published)
 */
export const FIXTURE_VIDEO_POST: FacebookPostData = {
  id: 'fb_post_002_video',
  type: 'video',
  message: 'Check out this virtual tour of our villa',
  story: 'User posted a video',
  permalink: 'https://facebook.com/pages/ceylon-haven/posts/002',
  attachments: {
    data: [
      {
        type: 'video',
        media: {
          image: {
            height: 720,
            width: 1280,
            src: 'https://scontent.fbkk1-1.fna.fbcdn.net/v/video_002_thumbnail.jpg',
          },
        },
        title: 'Virtual Tour',
        url: 'https://facebook.com/pages/ceylon-haven/videos/002',
      },
    ],
  },
};

/**
 * Reel post (skipped, will NOT be published)
 */
export const FIXTURE_REEL_POST: FacebookPostData = {
  id: 'fb_post_003_reel',
  type: 'reel',
  story: 'User posted a Reel',
  message: 'Watch our latest villa tour reel',
  permalink: 'https://facebook.com/pages/ceylon-haven/posts/003',
  attachments: {
    data: [
      {
        type: 'reel',
        media: {
          image: {
            height: 1920,
            width: 1080,
            src: 'https://scontent.fbkk1-1.fna.fbcdn.net/v/reel_003_thumbnail.jpg',
          },
        },
      },
    ],
  },
};

/**
 * Text-only post (skipped, will NOT be published)
 */
export const FIXTURE_TEXT_ONLY_POST: FacebookPostData = {
  id: 'fb_post_004_text_only',
  message: 'Special offer: 15% discount on villa bookings this month!',
  story: 'User posted text',
  permalink: 'https://facebook.com/pages/ceylon-haven/posts/004',
};

/**
 * Post with missing image (skipped, will NOT be published)
 */
export const FIXTURE_MISSING_IMAGE_POST: FacebookPostData = {
  id: 'fb_post_005_missing_image',
  message: 'Come visit our amazing property in Galle',
  story: 'User posted',
  permalink: 'https://facebook.com/pages/ceylon-haven/posts/005',
  attachments: {
    data: [
      {
        type: 'link',
        title: 'Ceylon Haven Website',
        url: 'https://ceylonhaven.com',
      },
    ],
  },
};

/**
 * Duplicate post (has same ID as another, only first should be published)
 */
export const FIXTURE_DUPLICATE_POST_1: FacebookPostData = {
  id: 'fb_post_006_duplicate',
  message: 'Twin beachfront villa with private pool',
  story: 'User posted a photo',
  imageUrl: 'https://scontent.fbkk1-1.fna.fbcdn.net/v/duplicate_001.jpg',
  permalink: 'https://facebook.com/pages/ceylon-haven/posts/006',
};

/**
 * Duplicate of post 006 (same ID, different fetch)
 */
export const FIXTURE_DUPLICATE_POST_2: FacebookPostData = {
  id: 'fb_post_006_duplicate',
  message: 'Twin beachfront villa with private pool (re-fetched)',
  story: 'User posted a photo',
  imageUrl: 'https://scontent.fbkk1-1.fna.fbcdn.net/v/duplicate_001.jpg',
  permalink: 'https://facebook.com/pages/ceylon-haven/posts/006',
};

/**
 * Another single-image post (supported)
 */
export const FIXTURE_ANOTHER_SINGLE_IMAGE_POST: FacebookPostData = {
  id: 'fb_post_007_single_image',
  type: 'photo',
  message: 'Stunning mountain views from our Kandy property',
  story: 'User posted a photo',
  imageUrl: 'https://scontent.fbkk1-1.fna.fbcdn.net/v/mountain_007.jpg',
  permalink: 'https://facebook.com/pages/ceylon-haven/posts/007',
  attachments: {
    data: [
      {
        type: 'photo',
        media: {
          image: {
            height: 1200,
            width: 1600,
            src: 'https://scontent.fbkk1-1.fna.fbcdn.net/v/mountain_007.jpg',
          },
        },
        title: 'Mountain views',
      },
    ],
  },
};

/**
 * Array of all fixtures for bulk testing
 */
export const ALL_FIXTURES = [
  FIXTURE_SINGLE_IMAGE_POST,
  FIXTURE_VIDEO_POST,
  FIXTURE_REEL_POST,
  FIXTURE_TEXT_ONLY_POST,
  FIXTURE_MISSING_IMAGE_POST,
  FIXTURE_DUPLICATE_POST_1,
  FIXTURE_DUPLICATE_POST_2,
  FIXTURE_ANOTHER_SINGLE_IMAGE_POST,
];

/**
 * Fixtures expected to be supported (published)
 */
export const SUPPORTED_FIXTURES = [
  FIXTURE_SINGLE_IMAGE_POST,
  FIXTURE_DUPLICATE_POST_1,
  FIXTURE_ANOTHER_SINGLE_IMAGE_POST,
];

/**
 * Fixtures expected to be skipped
 */
export const SKIPPED_FIXTURES = [
  FIXTURE_VIDEO_POST,
  FIXTURE_REEL_POST,
  FIXTURE_TEXT_ONLY_POST,
  FIXTURE_MISSING_IMAGE_POST,
  FIXTURE_DUPLICATE_POST_2, // Same ID as first, should not be double-processed
];
