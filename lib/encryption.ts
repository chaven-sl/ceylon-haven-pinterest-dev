/**
 * Token Encryption Service
 * Uses libsodium (tweetnacl) crypto_secretbox for XSalsa20-Poly1305 encryption
 * All tokens are encrypted before storage in Supabase
 */

import nacl from 'tweetnacl';

const { secretbox } = nacl;

// Helper utilities for base64 and string conversion
const base64 = {
  toByteArray: (str: string) => Buffer.from(str, 'base64'),
  fromByteArray: (bytes: Uint8Array) => Buffer.from(bytes).toString('base64'),
};

const utils = {
  base64,
  randomBytes: (n: number) => nacl.randomBytes(n),
  fromString: (str: string) => new TextEncoder().encode(str),
  toString: (bytes: Uint8Array) => new TextDecoder().decode(bytes),
};

/**
 * Encrypt plaintext using XSalsa20-Poly1305
 * Random nonce per encryption ensures different ciphertext for same plaintext
 *
 * @param plaintext - The token to encrypt
 * @param keyBase64 - 32-byte key (base64-encoded)
 * @returns Base64-encoded ciphertext with nonce prepended
 */
export function encryptToken(plaintext: string, keyBase64: string): string {
  try {
    // Decode key from base64
    const key = utils.base64.toByteArray(keyBase64);

    if (key.length !== 32) {
      throw new Error('Encryption key must be 32 bytes');
    }

    // Generate random nonce
    const nonce = utils.randomBytes(24);

    // Encrypt
    const plaintextBytes = utils.fromString(plaintext);
    const ciphertext = secretbox(plaintextBytes, nonce, key);

    if (!ciphertext) {
      throw new Error('Encryption failed');
    }

    // Prepend nonce to ciphertext and encode as base64
    const combined = new Uint8Array(nonce.length + ciphertext.length);
    combined.set(nonce);
    combined.set(ciphertext, nonce.length);

    return utils.base64.fromByteArray(combined);
  } catch (error) {
    throw new Error(`Encryption error: ${(error as Error).message}`);
  }
}

/**
 * Decrypt ciphertext using XSalsa20-Poly1305
 * Extracts nonce from prepended position and decrypts
 *
 * @param ciphertextBase64 - Base64-encoded ciphertext with nonce prepended
 * @param keyBase64 - 32-byte key (base64-encoded)
 * @returns Decrypted plaintext
 */
export function decryptToken(ciphertextBase64: string, keyBase64: string): string {
  try {
    // Decode key from base64
    const key = utils.base64.toByteArray(keyBase64);

    if (key.length !== 32) {
      throw new Error('Encryption key must be 32 bytes');
    }

    // Decode ciphertext and extract nonce
    const combined = utils.base64.toByteArray(ciphertextBase64);

    if (combined.length < 24) {
      throw new Error('Ciphertext is too short (must contain nonce)');
    }

    const nonce = combined.slice(0, 24);
    const ciphertext = combined.slice(24);

    // Decrypt
    const plaintextBytes = secretbox.open(ciphertext, nonce, key);

    if (!plaintextBytes) {
      throw new Error('Decryption failed (invalid key or corrupted data)');
    }

    return utils.toString(plaintextBytes);
  } catch (error) {
    throw new Error(`Decryption error: ${(error as Error).message}`);
  }
}

/**
 * Generate a random 32-byte base64-encoded encryption key
 * For use with NODE_ENV or .env TOKEN_ENCRYPTION_KEY
 */
export function generateEncryptionKey(): string {
  const key = utils.randomBytes(32);
  return utils.base64.fromByteArray(key);
}

/**
 * Validate that a base64 string is a valid 32-byte key
 */
export function validateEncryptionKey(keyBase64: string): boolean {
  try {
    const key = utils.base64.toByteArray(keyBase64);
    return key.length === 32;
  } catch {
    return false;
  }
}
