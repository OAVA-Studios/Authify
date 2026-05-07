import { createMiddleware } from 'hono/factory';
import { eq } from 'drizzle-orm';
import { db } from '@authify/db';
import { users, sessions } from '@authify/db/schema';
import { UnauthorizedError } from '@authify/shared';
import { verifyAccessToken } from '../services/jwt.js';
import type { Variables } from '../types/context.js';

export const requireAuth = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  const header = c.req.header('authorization');
  const cookie = c.req.header('cookie');

  let token: string | undefined;
  if (header?.startsWith('Bearer ')) {
    token = header.slice(7);
  } else if (cookie) {
    const match = cookie.match(/authify_session=([^;]+)/);
    token = match ? decodeURIComponent(match[1]) : undefined;
  }

  if (!token) {
    throw new UnauthorizedError('Authentication required');
  }

  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }

  const sessionRows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.token, token))
    .limit(1);

  if (sessionRows.length === 0) {
    throw new UnauthorizedError('Session not found');
  }

  const session = sessionRows[0];
  if (new Date(session.expiresAt) < new Date()) {
    throw new UnauthorizedError('Session expired');
  }

  const userRows = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
  if (userRows.length === 0) {
    throw new UnauthorizedError('User not found');
  }

  const user = userRows[0];
  if (user.banned) {
    throw new UnauthorizedError('Account banned');
  }

  c.set('userId', user.id);
  c.set('projectId', payload.projectId);
  c.set('role', payload.role);
  c.set('sessionId', session.id);

  await next();
});

