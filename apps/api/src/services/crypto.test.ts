import { describe, it, expect } from 'vitest';
import { encryptValue, decryptValue } from './crypto.js';

describe('crypto service', () => {
  it('round-trips plaintext', async () => {
    const plaintext = 'hello world';
    const encrypted = await encryptValue(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(typeof encrypted).toBe('string');

    const decrypted = await decryptValue(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('handles unicode', async () => {
    const plaintext = '🔐 Ünïcödé – 日本語';
    const encrypted = await encryptValue(plaintext);
    const decrypted = await decryptValue(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertexts for same plaintext', async () => {
    const plaintext = 'same';
    const a = await encryptValue(plaintext);
    const b = await encryptValue(plaintext);
    expect(a).not.toBe(b);
  });
});
