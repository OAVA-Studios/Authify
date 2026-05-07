import { describe, it, expect } from 'vitest';
import {
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from './jwt.js';

describe('jwt service', () => {
  it('creates and verifies an access token', async () => {
    const token = await createAccessToken('user-123', 'proj-456', 'admin');
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const payload = await verifyAccessToken(token);
    expect(payload.sub).toBe('user-123');
    expect(payload.projectId).toBe('proj-456');
    expect(payload.role).toBe('admin');
    expect(payload.type).toBe('access');
  });

  it('creates and verifies a refresh token', async () => {
    const token = await createRefreshToken('sess-789');
    expect(typeof token).toBe('string');

    const payload = await verifyRefreshToken(token);
    expect(payload.sub).toBe('sess-789');
    expect(payload.type).toBe('refresh');
  });

  it('rejects an invalid access token', async () => {
    await expect(verifyAccessToken('not.a.token')).rejects.toThrow();
  });

  it('rejects a refresh token as access token', async () => {
    const refresh = await createRefreshToken('sess-999');
    await expect(verifyAccessToken(refresh)).rejects.toThrow('Invalid token type');
  });

  it('rejects an access token as refresh token', async () => {
    const access = await createAccessToken('user-1', 'proj-1', 'user');
    await expect(verifyRefreshToken(access)).rejects.toThrow('Invalid token type');
  });
});
