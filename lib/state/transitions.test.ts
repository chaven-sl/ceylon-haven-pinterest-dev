import { describe, it, expect } from 'vitest';
import {
  validateTransition,
  isTerminalStatus,
  canRetry,
  getMaxRetries,
  PostStatus,
} from './transitions';

describe('State Machine: Transitions', () => {
  describe('validateTransition', () => {
    it('should allow discovered -> publishing', () => {
      const result = validateTransition('discovered', 'publishing');
      expect(result.valid).toBe(true);
      expect(result.nextState).toBe('publishing');
    });

    it('should allow discovered -> skipped', () => {
      const result = validateTransition('discovered', 'skipped');
      expect(result.valid).toBe(true);
      expect(result.nextState).toBe('skipped');
    });

    it('should allow publishing -> published', () => {
      const result = validateTransition('publishing', 'published');
      expect(result.valid).toBe(true);
      expect(result.nextState).toBe('published');
    });

    it('should allow publishing -> failed', () => {
      const result = validateTransition('publishing', 'failed');
      expect(result.valid).toBe(true);
      expect(result.nextState).toBe('failed');
    });

    it('should allow publishing -> uncertain', () => {
      const result = validateTransition('publishing', 'uncertain');
      expect(result.valid).toBe(true);
      expect(result.nextState).toBe('uncertain');
    });

    it('should allow failed -> publishing when retry_count < MAX_RETRIES', () => {
      const result = validateTransition('failed', 'publishing', 0);
      expect(result.valid).toBe(true);
      expect(result.nextState).toBe('publishing');
    });

    it('should allow failed -> publishing when retry_count is 2 (MAX_RETRIES=3)', () => {
      const result = validateTransition('failed', 'publishing', 2);
      expect(result.valid).toBe(true);
      expect(result.nextState).toBe('publishing');
    });

    it('should block failed -> publishing when retry_count >= MAX_RETRIES', () => {
      const result = validateTransition('failed', 'publishing', 3);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('max retries');
    });

    it('should block failed -> publishing when retry_count exceeds MAX_RETRIES', () => {
      const result = validateTransition('failed', 'publishing', 5);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('max retries');
    });

    it('should block published -> publishing (terminal state)', () => {
      const result = validateTransition('published', 'publishing');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cannot transition');
    });

    it('should block uncertain -> publishing', () => {
      const result = validateTransition('uncertain', 'publishing');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cannot transition');
    });

    it('should block uncertain -> publishing (no auto-retry)', () => {
      const result = validateTransition('uncertain', 'publishing', 0);
      expect(result.valid).toBe(false);
    });

    it('should block skipped -> publishing (terminal state)', () => {
      const result = validateTransition('skipped', 'publishing');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cannot transition');
    });

    it('should reject invalid current state', () => {
      const result = validateTransition('invalid_state' as PostStatus, 'publishing');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid current state');
    });

    it('should reject invalid next state', () => {
      const result = validateTransition('discovered', 'invalid_state' as PostStatus);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid next state');
    });
  });

  describe('isTerminalStatus', () => {
    it('should return true for published', () => {
      expect(isTerminalStatus('published')).toBe(true);
    });

    it('should return true for uncertain', () => {
      expect(isTerminalStatus('uncertain')).toBe(true);
    });

    it('should return true for skipped', () => {
      expect(isTerminalStatus('skipped')).toBe(true);
    });

    it('should return false for discovered', () => {
      expect(isTerminalStatus('discovered')).toBe(false);
    });

    it('should return false for publishing', () => {
      expect(isTerminalStatus('publishing')).toBe(false);
    });

    it('should return false for failed', () => {
      expect(isTerminalStatus('failed')).toBe(false);
    });
  });

  describe('canRetry', () => {
    it('should return true for failed with retry_count < MAX_RETRIES', () => {
      expect(canRetry('failed', 0)).toBe(true);
      expect(canRetry('failed', 1)).toBe(true);
      expect(canRetry('failed', 2)).toBe(true);
    });

    it('should return false for failed with retry_count >= MAX_RETRIES', () => {
      expect(canRetry('failed', 3)).toBe(false);
      expect(canRetry('failed', 4)).toBe(false);
    });

    it('should return false for non-failed statuses', () => {
      expect(canRetry('discovered', 0)).toBe(false);
      expect(canRetry('publishing', 0)).toBe(false);
      expect(canRetry('published', 0)).toBe(false);
      expect(canRetry('uncertain', 0)).toBe(false);
      expect(canRetry('skipped', 0)).toBe(false);
    });
  });

  describe('getMaxRetries', () => {
    it('should return 3', () => {
      expect(getMaxRetries()).toBe(3);
    });
  });

  describe('State Machine Workflow', () => {
    it('should support complete success workflow', () => {
      let status: PostStatus = 'discovered';

      // discovered -> publishing
      let result = validateTransition(status, 'publishing');
      expect(result.valid).toBe(true);
      status = result.nextState || status;

      // publishing -> published
      result = validateTransition(status, 'published');
      expect(result.valid).toBe(true);
      status = result.nextState || status;

      // published is terminal
      expect(isTerminalStatus(status)).toBe(true);
    });

    it('should support retry workflow after failure', () => {
      let status: PostStatus = 'discovered';
      let retryCount = 0;

      // discovered -> publishing
      let result = validateTransition(status, 'publishing');
      expect(result.valid).toBe(true);
      status = result.nextState || status;

      // publishing -> failed (first attempt)
      result = validateTransition(status, 'failed');
      expect(result.valid).toBe(true);
      status = result.nextState || status;
      retryCount++;

      // Can retry: failed -> publishing
      result = validateTransition(status, 'publishing', retryCount);
      expect(result.valid).toBe(true);
      status = result.nextState || status;

      // publishing -> published (retry succeeds)
      result = validateTransition(status, 'published');
      expect(result.valid).toBe(true);
      status = result.nextState || status;

      expect(isTerminalStatus(status)).toBe(true);
    });

    it('should block retries after MAX_RETRIES exhausted', () => {
      let status: PostStatus = 'discovered';
      let retryCount = 0;

      // Claim initially
      let result = validateTransition(status, 'publishing');
      expect(result.valid).toBe(true);
      status = result.nextState || status;

      // Fail and retry 3 times total
      for (let attempt = 1; attempt <= 3; attempt++) {
        // publishing -> failed
        result = validateTransition(status, 'failed');
        expect(result.valid).toBe(true);
        status = result.nextState || status;
        retryCount++;

        // Retry if not exhausted
        if (attempt < 3) {
          result = validateTransition(status, 'publishing', retryCount);
          expect(result.valid).toBe(true);
          status = result.nextState || status;
        }
      }

      // Now status = 'failed' with retryCount = 3
      expect(status).toBe('failed');
      expect(retryCount).toBe(3);

      // Should not be able to retry anymore
      const finalResult = validateTransition(status, 'publishing', retryCount);
      expect(finalResult.valid).toBe(false);
      expect(finalResult.error).toContain('max retries');
    });

    it('should support skip workflow', () => {
      let status: PostStatus = 'discovered';

      // discovered -> skipped
      const result = validateTransition(status, 'skipped');
      expect(result.valid).toBe(true);
      status = result.nextState || status;

      // skipped is terminal, no further transitions
      expect(isTerminalStatus(status)).toBe(true);
    });

    it('should support uncertain state (no auto-retry)', () => {
      let status: PostStatus = 'discovered';

      // discovered -> publishing
      let result = validateTransition(status, 'publishing');
      expect(result.valid).toBe(true);
      status = result.nextState || status;

      // publishing -> uncertain
      result = validateTransition(status, 'uncertain');
      expect(result.valid).toBe(true);
      status = result.nextState || status;

      // uncertain is terminal, cannot retry automatically
      expect(isTerminalStatus(status)).toBe(true);

      // Attempt to retry from uncertain should fail
      result = validateTransition(status, 'publishing', 0);
      expect(result.valid).toBe(false);
    });
  });
});
