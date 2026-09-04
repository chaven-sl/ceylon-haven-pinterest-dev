/**
 * Pinterest Client Unit Tests
 * Mocks all API responses (no live API calls)
 *
 * PHASE 3 PART 1: Error Semantics Testing
 * Tests correct classification of fatal vs transient vs ambiguous errors
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PinterestClient,
  PinterestValidationError,
  PinterestRateLimitError,
  PinterestAuthenticationError,
  PinterestPermissionError,
  PinterestInvalidBoardError,
  PinterestNetworkError,
  PinterestAmbiguousOutcomeError,
} from './pinterest';

describe('PinterestClient', () => {
  const mockAccessToken = 'test_access_token_abc123';
  let client: PinterestClient;

  beforeEach(() => {
    client = new PinterestClient(mockAccessToken);
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with valid token', () => {
      expect(client).toBeDefined();
    });

    it('should throw if token is missing', () => {
      expect(() => new PinterestClient('')).toThrow();
    });
  });

  describe('validatePinInput', () => {
    const baseInput = {
      boardId: 'board_123',
      title: 'Test Pin',
      media: { type: 'image_url' as const, url: 'https://example.com/image.jpg' },
    };

    it('should accept valid pin input', () => {
      // Should not throw
      const input = { ...baseInput };
      expect(() => client['validatePinInput'](input)).not.toThrow();
    });

    it('should reject missing boardId', () => {
      const input = { ...baseInput, boardId: '' };
      expect(() => client['validatePinInput'](input)).toThrow(PinterestValidationError);
    });

    it('should reject missing title', () => {
      const input = { ...baseInput, title: '' };
      expect(() => client['validatePinInput'](input)).toThrow(PinterestValidationError);
    });

    it('should reject title over 100 characters', () => {
      const input = { ...baseInput, title: 'a'.repeat(101) };
      expect(() => client['validatePinInput'](input)).toThrow(PinterestValidationError);
    });

    it('should reject description over 500 characters', () => {
      const input = { ...baseInput, description: 'a'.repeat(501) };
      expect(() => client['validatePinInput'](input)).toThrow(PinterestValidationError);
    });

    it('should reject image_url without url', () => {
      const input = { ...baseInput, media: { type: 'image_url' as const } };
      expect(() => client['validatePinInput'](input)).toThrow(PinterestValidationError);
    });

    it('should reject image_base64 without data', () => {
      const input = { ...baseInput, media: { type: 'image_base64' as const } };
      expect(() => client['validatePinInput'](input)).toThrow(PinterestValidationError);
    });
  });

  describe('buildMediaSource', () => {
    it('should build image_url media source', () => {
      const media = { type: 'image_url' as const, url: 'https://example.com/image.jpg' };
      const source = client['buildMediaSource'](media);

      expect(source).toEqual({
        source_type: 'image_url',
        url: 'https://example.com/image.jpg',
      });
    });

    it('should build image_base64 media source', () => {
      const media = { type: 'image_base64' as const, data: 'base64encodeddata==' };
      const source = client['buildMediaSource'](media);

      expect(source).toEqual({
        source_type: 'image_base64',
        data: 'base64encodeddata==',
      });
    });

    it('should reject unknown media type', () => {
      const media = { type: 'unknown' as unknown as 'image_url' };
      expect(() => client['buildMediaSource'](media)).toThrow(PinterestValidationError);
    });
  });

  describe('getRateLimitInfo', () => {
    it('should return initial rate limit', () => {
      const info = client.getRateLimitInfo();
      expect(info.remaining).toBe(100);
      expect(info.reset).toBeUndefined();
    });
  });

  describe('static error classification - PHASE 3 PART 1', () => {
    // TASK 1-3: Error Semantics Testing

    describe('fatal errors (do NOT retry)', () => {
      it('should identify HTTP 401 authentication as fatal', () => {
        const error = new PinterestAuthenticationError('Invalid or expired token: Invalid token');
        expect(PinterestClient.isFatalError(error)).toBe(true);
        expect(PinterestClient.isTransientError(error)).toBe(false);
        expect(PinterestClient.isAmbiguousError(error)).toBe(false);
      });

      it('should identify HTTP 403 permission as fatal', () => {
        const error = new PinterestPermissionError('Permission denied: insufficient scope');
        expect(PinterestClient.isFatalError(error)).toBe(true);
        expect(PinterestClient.isTransientError(error)).toBe(false);
        expect(PinterestClient.isAmbiguousError(error)).toBe(false);
      });

      it('should identify HTTP 404 invalid board as fatal', () => {
        const error = new PinterestInvalidBoardError('Board not found: board_xyz');
        expect(PinterestClient.isFatalError(error)).toBe(true);
        expect(PinterestClient.isTransientError(error)).toBe(false);
        expect(PinterestClient.isAmbiguousError(error)).toBe(false);
      });

      it('should identify HTTP 400 validation error as fatal', () => {
        const error = new PinterestValidationError('Invalid pin data: title too long');
        expect(PinterestClient.isFatalError(error)).toBe(true);
        expect(PinterestClient.isTransientError(error)).toBe(false);
        expect(PinterestClient.isAmbiguousError(error)).toBe(false);
      });

      it('should not auto-retry local validation failure', () => {
        const input = { boardId: '', title: 'Test', media: { type: 'image_url' as const, url: 'http://example.com/img.jpg' } };
        expect(() => client['validatePinInput'](input)).toThrow(PinterestValidationError);
        // This error is fatal; should move to failed state, not retry
      });
    });

    describe('transient errors (safe to retry)', () => {
      it('should identify rate limit as transient', () => {
        const error = new PinterestRateLimitError('Rate limit exceeded');
        expect(PinterestClient.isTransientError(error)).toBe(true);
        expect(PinterestClient.isFatalError(error)).toBe(false);
        expect(PinterestClient.isAmbiguousError(error)).toBe(false);
      });

      it('should identify network error (pre-send) as transient', () => {
        const error = new PinterestNetworkError('Network error: connection refused');
        expect(PinterestClient.isTransientError(error)).toBe(true);
        expect(PinterestClient.isFatalError(error)).toBe(false);
        expect(PinterestClient.isAmbiguousError(error)).toBe(false);
      });
    });

    describe('ambiguous errors (outcome unknown, NO auto-retry)', () => {
      it('should identify timeout after send as ambiguous', () => {
        const error = new PinterestAmbiguousOutcomeError('Timeout (may have reached Pinterest): Request timeout');
        expect(PinterestClient.isAmbiguousError(error)).toBe(true);
        expect(PinterestClient.isFatalError(error)).toBe(false);
        expect(PinterestClient.isTransientError(error)).toBe(false);
      });

      it('should identify socket reset as ambiguous', () => {
        const error = new PinterestAmbiguousOutcomeError('Connection error (ambiguous): Connection reset by peer');
        expect(PinterestClient.isAmbiguousError(error)).toBe(true);
        expect(PinterestClient.isFatalError(error)).toBe(false);
        expect(PinterestClient.isTransientError(error)).toBe(false);
      });

      it('should identify post-send disconnect as ambiguous', () => {
        const error = new PinterestAmbiguousOutcomeError('Connection error (ambiguous): Socket closed after request sent');
        expect(PinterestClient.isAmbiguousError(error)).toBe(true);
        expect(PinterestClient.isFatalError(error)).toBe(false);
        expect(PinterestClient.isTransientError(error)).toBe(false);
      });
    });

    describe('error classification completeness', () => {
      it('should classify all errors into exactly one category', () => {
        const fatalErrors = [
          new PinterestAuthenticationError('401'),
          new PinterestPermissionError('403'),
          new PinterestInvalidBoardError('404'),
          new PinterestValidationError('400'),
        ];

        const transientErrors = [
          new PinterestRateLimitError('429'),
          new PinterestNetworkError('connection refused'),
        ];

        const ambiguousErrors = [
          new PinterestAmbiguousOutcomeError('timeout'),
        ];

        fatalErrors.forEach(error => {
          expect(PinterestClient.isFatalError(error)).toBe(true);
          expect(PinterestClient.isTransientError(error)).toBe(false);
          expect(PinterestClient.isAmbiguousError(error)).toBe(false);
        });

        transientErrors.forEach(error => {
          expect(PinterestClient.isTransientError(error)).toBe(true);
          expect(PinterestClient.isFatalError(error)).toBe(false);
          expect(PinterestClient.isAmbiguousError(error)).toBe(false);
        });

        ambiguousErrors.forEach(error => {
          expect(PinterestClient.isAmbiguousError(error)).toBe(true);
          expect(PinterestClient.isFatalError(error)).toBe(false);
          expect(PinterestClient.isTransientError(error)).toBe(false);
        });
      });
    });
  });
});
