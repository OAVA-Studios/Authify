import { createHash } from 'crypto';

export function hashHwid(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function normalizeHwid(raw: string): string {
  return raw.replace(/\s+/g, '').toLowerCase();
}
