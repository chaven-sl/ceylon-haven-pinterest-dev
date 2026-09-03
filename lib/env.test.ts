import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getValidatedEnv, isEnvConfigured, getEnvInfo, __clearEnvCache } from './env';

describe('Environment Validation', () => {
  beforeEach(() => {
    // Clear cache before each test
    __clearEnvCache();
  });

  afterEach(() => {
    // Clear cache after each test
    __clearEnvCache();
  });

  function setEnv(vars: Record<string, string | undefined>): void {
    Object.keys(vars).forEach((key) => {
      if (vars[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = vars[key];
      }
    });
  }

  describe('getValidatedEnv', () => {
    it('should throw when required SUPABASE_URL is missing', () => {
      setEnv({
        SUPABASE_URL: undefined,
        SUPABASE_SERVICE_ROLE_KEY: 'test_key',
        SUPABASE_ANON_KEY: 'test_key',
        CRON_SECRET: 'a'.repeat(32),
      });

      expect(() => {
        getValidatedEnv();
      }).toThrow();
    });

    it('should throw when SUPABASE_URL is invalid', () => {
      setEnv({
        SUPABASE_URL: 'not-a-url',
        SUPABASE_SERVICE_ROLE_KEY: 'test_key',
        SUPABASE_ANON_KEY: 'test_key',
        CRON_SECRET: 'a'.repeat(32),
      });

      expect(() => {
        getValidatedEnv();
      }).toThrow();
    });

    it('should throw when CRON_SECRET is too short', () => {
      setEnv({
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test_key',
        SUPABASE_ANON_KEY: 'test_key',
        CRON_SECRET: 'short_secret',
      });

      expect(() => {
        getValidatedEnv();
      }).toThrow();
    });

    it('should accept valid required environment variables', () => {
      setEnv({
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test_key',
        SUPABASE_ANON_KEY: 'test_key',
        CRON_SECRET: 'a'.repeat(32),
        FB_GRAPH_API_VERSION: 'v20',
      });

      const env = getValidatedEnv();
      expect(env.SUPABASE_URL).toBe('https://test.supabase.co');
      expect(env.FB_GRAPH_API_VERSION).toBe('v20');
    });

    it('should default FB_GRAPH_API_VERSION to v20', () => {
      setEnv({
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test_key',
        SUPABASE_ANON_KEY: 'test_key',
        CRON_SECRET: 'a'.repeat(32),
        FB_GRAPH_API_VERSION: undefined,
      });

      const env = getValidatedEnv();
      expect(env.FB_GRAPH_API_VERSION).toBe('v20');
    });

    it('should accept optional future environment variables', () => {
      setEnv({
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test_key',
        SUPABASE_ANON_KEY: 'test_key',
        CRON_SECRET: 'a'.repeat(32),
        FACEBOOK_PAGE_ID: '123456',
        FACEBOOK_ACCESS_TOKEN: 'token_abc',
        PINTEREST_APP_ID: 'app_123',
      });

      const env = getValidatedEnv();
      expect(env.FACEBOOK_PAGE_ID).toBe('123456');
      expect(env.FACEBOOK_ACCESS_TOKEN).toBe('token_abc');
      expect(env.PINTEREST_APP_ID).toBe('app_123');
    });

    it('should NOT require optional future environment variables', () => {
      setEnv({
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test_key',
        SUPABASE_ANON_KEY: 'test_key',
        CRON_SECRET: 'a'.repeat(32),
        FACEBOOK_PAGE_ID: undefined,
        FACEBOOK_ACCESS_TOKEN: undefined,
      });

      const env = getValidatedEnv();
      expect(env.FACEBOOK_PAGE_ID).toBeUndefined();
      expect(env.FACEBOOK_ACCESS_TOKEN).toBeUndefined();
    });

    it('should cache environment validation', () => {
      setEnv({
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test_key',
        SUPABASE_ANON_KEY: 'test_key',
        CRON_SECRET: 'a'.repeat(32),
      });

      const env1 = getValidatedEnv();
      const env2 = getValidatedEnv();

      expect(env1).toBe(env2);
    });
  });

  describe('isEnvConfigured', () => {
    it('should return true when all required env vars are set', () => {
      setEnv({
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test_key',
        SUPABASE_ANON_KEY: 'test_key',
        CRON_SECRET: 'a'.repeat(32),
      });

      expect(isEnvConfigured()).toBe(true);
    });

    it('should return false when required env vars are missing', () => {
      setEnv({
        SUPABASE_URL: undefined,
        SUPABASE_SERVICE_ROLE_KEY: 'test_key',
        SUPABASE_ANON_KEY: 'test_key',
        CRON_SECRET: 'a'.repeat(32),
      });

      expect(isEnvConfigured()).toBe(false);
    });

    it('should not throw when checking configuration', () => {
      setEnv({
        SUPABASE_URL: undefined,
      });

      expect(() => {
        isEnvConfigured();
      }).not.toThrow();
    });
  });

  describe('getEnvInfo', () => {
    it('should return env configuration status', () => {
      setEnv({
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test_key',
        FACEBOOK_PAGE_ID: '123456',
        FACEBOOK_ACCESS_TOKEN: 'token_abc',
        PINTEREST_APP_ID: 'app_123',
        PINTEREST_ACCESS_TOKEN: 'token_pin',
        NODE_ENV: 'production',
      });

      const info = getEnvInfo();

      expect(info.supabaseConfigured).toBe(true);
      expect(info.facebookConfigured).toBe(true);
      expect(info.pinterestConfigured).toBe(true);
      expect(info.nodeEnv).toBe('production');
    });

    it('should return false for missing configurations', () => {
      setEnv({
        SUPABASE_URL: undefined,
        SUPABASE_SERVICE_ROLE_KEY: undefined,
        FACEBOOK_PAGE_ID: undefined,
        FACEBOOK_ACCESS_TOKEN: undefined,
      });

      const info = getEnvInfo();

      expect(info.supabaseConfigured).toBe(false);
      expect(info.facebookConfigured).toBe(false);
    });

    it('should never log secret values', () => {
      setEnv({
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'secret_key_that_should_not_be_logged',
        CRON_SECRET: 'a'.repeat(32),
      });

      const info = getEnvInfo();
      const infoString = JSON.stringify(info);

      expect(infoString).not.toContain('secret_key_that_should_not_be_logged');
      expect(infoString).not.toContain('a'.repeat(32));
    });
  });
});
