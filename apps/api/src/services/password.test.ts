import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password service', () => {
  it('hashes a password', async () => {
    const hash = await hashPassword('secret123');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('verifies correct password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    const ok = await verifyPassword('correct horse battery staple', hash);
    expect(ok).toBe(true);
  });

  it('rejects wrong password', async () => {
    const hash = await hashPassword('secret123');
    const ok = await verifyPassword('wrong', hash);
    expect(ok).toBe(false);
  });
});
