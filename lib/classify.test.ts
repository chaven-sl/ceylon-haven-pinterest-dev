import { describe, it, expect } from 'vitest';
import {
  classifyPost,
  getSkipReasonFromClassification,
} from './classify';
import {
  FIXTURE_SINGLE_IMAGE_POST,
  FIXTURE_VIDEO_POST,
  FIXTURE_REEL_POST,
  FIXTURE_TEXT_ONLY_POST,
  FIXTURE_MISSING_IMAGE_POST,
  FIXTURE_ANOTHER_SINGLE_IMAGE_POST,
} from '@/services/fixtures';

describe('Classification: Post Type Detection', () => {
  describe('classifyPost', () => {
    it('should classify single-image post as supported', () => {
      const result = classifyPost(FIXTURE_SINGLE_IMAGE_POST);
      expect(result.classification).toBe('supported');
      expect(result.isSupported).toBe(true);
      expect(result.imageUrl).toBeDefined();
    });

    it('should classify video post as not supported', () => {
      const result = classifyPost(FIXTURE_VIDEO_POST);
      expect(result.classification).toBe('video_not_supported');
      expect(result.isSupported).toBe(false);
      expect(result.reason).toContain('Video');
    });

    it('should classify reel post as not supported', () => {
      const result = classifyPost(FIXTURE_REEL_POST);
      expect(result.classification).toBe('reel_not_supported');
      expect(result.isSupported).toBe(false);
      expect(result.reason).toContain('Reel');
    });

    it('should classify text-only post as not supported', () => {
      const result = classifyPost(FIXTURE_TEXT_ONLY_POST);
      expect(result.classification).toBe('text_only');
      expect(result.isSupported).toBe(false);
      expect(result.reason).toContain('no image');
    });

    it('should classify missing-image post as text_only (has text but no image)', () => {
      const result = classifyPost(FIXTURE_MISSING_IMAGE_POST);
      // Post has message/story but no image attachment, so classified as text_only
      expect(result.classification).toBe('text_only');
      expect(result.isSupported).toBe(false);
    });

    it('should classify another single-image post as supported', () => {
      const result = classifyPost(FIXTURE_ANOTHER_SINGLE_IMAGE_POST);
      expect(result.classification).toBe('supported');
      expect(result.isSupported).toBe(true);
      expect(result.imageUrl).toBeDefined();
    });

    it('should extract image URL from top-level imageUrl field', () => {
      const result = classifyPost(FIXTURE_SINGLE_IMAGE_POST);
      expect(result.imageUrl).toBe(FIXTURE_SINGLE_IMAGE_POST.imageUrl);
    });

    it('should handle post with no attachments or imageUrl', () => {
      const result = classifyPost({
        id: 'test_post',
        message: 'Just text',
      });
      expect(result.isSupported).toBe(false);
    });

    it('should handle post with undefined imageUrl', () => {
      const result = classifyPost({
        id: 'test_post',
        message: 'Post with undefined image',
        imageUrl: undefined,
      });
      expect(result.isSupported).toBe(false);
    });

    it('should handle post with invalid URL protocol', () => {
      const result = classifyPost({
        id: 'test_post',
        message: 'Post with HTTP image',
        imageUrl: 'http://invalid.com/image.jpg', // HTTP not HTTPS
      });
      expect(result.isSupported).toBe(false);
    });
  });

  describe('getSkipReasonFromClassification', () => {
    it('should return undefined for supported classification', () => {
      const reason = getSkipReasonFromClassification('supported');
      expect(reason).toBeUndefined();
    });

    it('should return reason for video_not_supported', () => {
      const reason = getSkipReasonFromClassification('video_not_supported');
      expect(reason).toContain('Video');
    });

    it('should return reason for reel_not_supported', () => {
      const reason = getSkipReasonFromClassification('reel_not_supported');
      expect(reason).toContain('Reel');
    });

    it('should return reason for text_only', () => {
      const reason = getSkipReasonFromClassification('text_only');
      expect(reason).toContain('no image');
    });

    it('should return reason for no_image', () => {
      const reason = getSkipReasonFromClassification('no_image');
      expect(reason).toBeDefined();
    });

    it('should return reason for no_usable_image', () => {
      const reason = getSkipReasonFromClassification('no_usable_image');
      expect(reason).toBeDefined();
    });
  });

  describe('Classification Workflows', () => {
    it('should classify all fixture posts correctly', () => {
      const singleImageClassification = classifyPost(FIXTURE_SINGLE_IMAGE_POST);
      expect(singleImageClassification.isSupported).toBe(true);

      const videoClassification = classifyPost(FIXTURE_VIDEO_POST);
      expect(videoClassification.isSupported).toBe(false);

      const reelClassification = classifyPost(FIXTURE_REEL_POST);
      expect(reelClassification.isSupported).toBe(false);

      const textClassification = classifyPost(FIXTURE_TEXT_ONLY_POST);
      expect(textClassification.isSupported).toBe(false);

      const missingImageClassification = classifyPost(FIXTURE_MISSING_IMAGE_POST);
      expect(missingImageClassification.isSupported).toBe(false);
    });

    it('should extract skip reason for all unsupported posts', () => {
      const fixtures = [
        FIXTURE_VIDEO_POST,
        FIXTURE_REEL_POST,
        FIXTURE_TEXT_ONLY_POST,
        FIXTURE_MISSING_IMAGE_POST,
      ];

      for (const fixture of fixtures) {
        const result = classifyPost(fixture);
        const skipReason = getSkipReasonFromClassification(result.classification);
        expect(skipReason).toBeDefined();
        expect(skipReason?.length).toBeGreaterThan(0);
      }
    });
  });
});
