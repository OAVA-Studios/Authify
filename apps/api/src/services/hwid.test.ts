import { describe, it, expect } from 'vitest';
import { hashHwid, normalizeHwid } from './hwid.js';

describe('hwid service', () => {
  it('normalizes whitespace and case', () => {
    expect(normalizeHwid('  AB CD  ')).toBe('abcd');
    expect(normalizeHwid('HWID123')).toBe('hwid123');
  });

  it('produces deterministic sha256 hash', () => {
    const input = 'my-device-id';
    const h1 = hashHwid(input);
    const h2 = hashHwid(input);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('hash changes with different inputs', () => {
    const a = hashHwid('a');
    const b = hashHwid('b');
    expect(a).not.toBe(b);
  });
});
