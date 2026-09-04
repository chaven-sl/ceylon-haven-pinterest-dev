/**
 * Facebook Client Unit Tests
 * Mocks all API responses (no live API calls)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FacebookClient, FacebookRateLimitError, FacebookAuthenticationError, FacebookInvalidPageError } from './facebook';

describe('FacebookClient', () => {
  const mockAccessToken = 'test_access_token_123';
  const mockPageId = '123456789';
  let client: FacebookClient;

  beforeEach(() => {
    client = new FacebookClient(mockAccessToken, mockPageId);
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with valid credentials', () => {
      expect(client).toBeDefined();
    });

    it('should throw if accessToken is missing', () => {
      expect(() => new FacebookClient('', mockPageId)).toThrow();
    });

    it('should throw if pageId is missing', () => {
      expect(() => new FacebookClient(mockAccessToken, '')).toThrow();
    });
  });

  describe('classifyMedia', () => {
    it('should classify single-image post', () => {
      const post = {
        id: 'post_1',
        created_time: '2026-01-01T00:00:00Z',
        attachments: [{ type: 'photo', media: { image: { src: 'https://example.com/image.jpg' } } }],
      };

      const type = client.classifyMedia(post);
      expect(type).toBe('single-image');
    });

    it('should classify carousel post', () => {
      const post = {
        id: 'post_1',
        created_time: '2026-01-01T00:00:00Z',
        attachments: [
          { type: 'photo' },
          { type: 'photo' },
        ],
      };

      const type = client.classifyMedia(post);
      expect(type).toBe('carousel');
    });

    it('should classify video post', () => {
      const post = {
        id: 'post_1',
        created_time: '2026-01-01T00:00:00Z',
        attachments: [{ type: 'video' }],
      };

      const type = client.classifyMedia(post);
      expect(type).toBe('video');
    });

    it('should classify text-only post', () => {
      const post = {
        id: 'post_1',
        created_time: '2026-01-01T00:00:00Z',
      };

      const type = client.classifyMedia(post);
      expect(type).toBe('text-only');
    });
  });

  describe('normalizeFacebookPost', () => {
    it('should normalize post with all fields', () => {
      const post = {
        id: 'post_123',
        created_time: '2026-01-15T10:30:00Z',
        message: 'Beautiful sunset at the villa',
        attachments: [
          {
            type: 'photo',
            media: { image: { src: 'https://cdn.example.com/photo.jpg' } },
          },
        ],
        permalink_url: 'https://facebook.com/page/posts/123',
      };

      const normalized = client.normalizeFacebookPost(post);

      expect(normalized.facebookPostId).toBe('post_123');
      expect(normalized.caption).toBe('Beautiful sunset at the villa');
      expect(normalized.imageUrl).toBe('https://cdn.example.com/photo.jpg');
      expect(normalized.mediaType).toBe('single-image');
      expect(normalized.createdAt).toEqual(new Date('2026-01-15T10:30:00Z'));
      expect(normalized.permaLink).toBe('https://facebook.com/page/posts/123');
    });

    it('should handle post with only story', () => {
      const post = {
        id: 'post_456',
        created_time: '2026-01-16T14:20:00Z',
        story: 'Posted to their page',
      };

      const normalized = client.normalizeFacebookPost(post);

      expect(normalized.caption).toBe('Posted to their page');
      expect(normalized.mediaType).toBe('text-only');
    });
  });

  describe('static error classification', () => {
    it('should identify rate limit errors as transient', () => {
      const error = new FacebookRateLimitError('Rate limit exceeded');
      expect(FacebookClient.isTransientError(error)).toBe(true);
    });

    it('should identify authentication errors as fatal', () => {
      const error = new FacebookAuthenticationError('Invalid token');
      expect(FacebookClient.isFatalError(error)).toBe(true);
    });

    it('should identify invalid page errors as fatal', () => {
      const error = new FacebookInvalidPageError('Page not found');
      expect(FacebookClient.isFatalError(error)).toBe(true);
    });
  });
});
