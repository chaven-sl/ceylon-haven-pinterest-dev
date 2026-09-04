/**
 * Token Encryption Unit Tests
 * Tests XSalsa20-Poly1305 encryption (crypto_secretbox)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  encryptToken,
  decryptToken,
  generateEncryptionKey,
  validateEncryptionKey,
} from './encryption';

describe('Token Encryption', () => {
  let encryptionKey: string;

  // Generate a valid key for testing
  beforeEach(() => {
    encryptionKey = generateEncryptionKey();
  });

  describe('generateEncryptionKey', () => {
    it('should generate a 32-byte base64 key', () => {
      const key = generateEncryptionKey();
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');

      // Validate key length
      const buffer = Buffer.from(key, 'base64');
      expect(buffer.length).toBe(32);
    });

    it('should generate different keys each time', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('validateEncryptionKey', () => {
    it('should accept valid 32-byte base64 key', () => {
      const key = generateEncryptionKey();
      expect(validateEncryptionKey(key)).toBe(true);
    });

    it('should reject invalid base64', () => {
      expect(validateEncryptionKey('not-valid-base64!!!')).toBe(false);
    });

    it('should reject wrong key length', () => {
      const shortKey = Buffer.from('short').toString('base64');
      expect(validateEncryptionKey(shortKey)).toBe(false);
    });

    it('should reject empty string', () => {
      expect(validateEncryptionKey('')).toBe(false);
    });
  });

  describe('encryptToken', () => {
    it('should encrypt plaintext successfully', () => {
      const plaintext = 'my_secret_token_12345';
      const ciphertext = encryptToken(plaintext, encryptionKey);

      expect(ciphertext).toBeDefined();
      expect(typeof ciphertext).toBe('string');
      expect(ciphertext).not.toBe(plaintext);
    });

    it('should produce different ciphertexts for same plaintext (random nonce)', () => {
      const plaintext = 'my_secret_token_12345';
      const ciphertext1 = encryptToken(plaintext, encryptionKey);
      const ciphertext2 = encryptToken(plaintext, encryptionKey);

      expect(ciphertext1).not.toBe(ciphertext2);
    });

    it('should throw on invalid key length', () => {
      const plaintext = 'token';
      const invalidKey = Buffer.from('short').toString('base64');
      expect(() => encryptToken(plaintext, invalidKey)).toThrow();
    });

    it('should handle long tokens', () => {
      const plaintext = 'a'.repeat(5000);
      const ciphertext = encryptToken(plaintext, encryptionKey);
      expect(ciphertext.length > 0).toBe(true);
    });

    it('should handle special characters', () => {
      const plaintext = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const ciphertext = encryptToken(plaintext, encryptionKey);
      expect(ciphertext).toBeDefined();
    });

    it('should handle unicode characters', () => {
      const plaintext = 'token_with_unicode_🔐_emoji';
      const ciphertext = encryptToken(plaintext, encryptionKey);
      expect(ciphertext).toBeDefined();
    });
  });

  describe('decryptToken', () => {
    it('should decrypt ciphertext to original plaintext', () => {
      const plaintext = 'my_secret_token_12345';
      const ciphertext = encryptToken(plaintext, encryptionKey);
      const decrypted = decryptToken(ciphertext, encryptionKey);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw on invalid key', () => {
      const plaintext = 'token';
      const ciphertext = encryptToken(plaintext, encryptionKey);
      const wrongKey = generateEncryptionKey();

      expect(() => decryptToken(ciphertext, wrongKey)).toThrow();
    });

    it('should throw on corrupted ciphertext', () => {
      const plaintext = 'token';
      const ciphertext = encryptToken(plaintext, encryptionKey);
      const corrupted = ciphertext.slice(0, -1) + 'X'; // Corrupt last character

      expect(() => decryptToken(corrupted, encryptionKey)).toThrow();
    });

    it('should throw on too-short ciphertext', () => {
      expect(() => decryptToken('dG9vX3Nob3J0', encryptionKey)).toThrow();
    });

    it('should throw on invalid key length', () => {
      const plaintext = 'token';
      const ciphertext = encryptToken(plaintext, encryptionKey);
      const invalidKey = Buffer.from('short').toString('base64');

      expect(() => decryptToken(ciphertext, invalidKey)).toThrow();
    });
  });

  describe('round-trip encryption', () => {
    it('should successfully encrypt and decrypt various tokens', () => {
      const tokens = [
        'simple_token',
        'token_with_numbers_12345',
        'token-with-dashes',
        'token_with_underscores',
        'verylongtokenwiththisismuchmoretextthanusualbutshouldobeworkjustfine',
        '!@#$%^&*()',
        'üñíçödé_टोकन',
      ];

      for (const token of tokens) {
        const ciphertext = encryptToken(token, encryptionKey);
        const decrypted = decryptToken(ciphertext, encryptionKey);
        expect(decrypted).toBe(token);
      }
    });

    it('should maintain data integrity through encryption cycle', () => {
      const originalToken = 'access_token_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const encrypted1 = encryptToken(originalToken, encryptionKey);
      const decrypted1 = decryptToken(encrypted1, encryptionKey);
      const encrypted2 = encryptToken(decrypted1, encryptionKey);
      const decrypted2 = decryptToken(encrypted2, encryptionKey);

      expect(decrypted2).toBe(originalToken);
    });
  });
});
