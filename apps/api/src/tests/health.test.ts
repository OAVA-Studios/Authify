import { describe, it, expect } from 'vitest';
import app from '../index.js';

describe('health endpoint', () => {
  it('returns 200 with status ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('authify-api');
    expect(body.requestId).toBeDefined();
  });
});
