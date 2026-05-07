import { createMiddleware } from 'hono/factory';
import { eq } from 'drizzle-orm';
import { db } from '@authify/db';
import { projects } from '@authify/db/schema';
import { UnauthorizedError } from '@authify/shared';
import { env } from '../lib/env.js';
import type { Variables } from '../types/context.js';
import { createHash } from 'crypto';

export const projectAuth = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  const apiKey = c.req.header('x-api-key');
  if (!apiKey) {
    throw new UnauthorizedError('API key required');
  }

  // Hash the API key for lookup
  const hash = createHash('sha256')
    .update(apiKey + env.API_KEY_SALT)
    .digest('hex');

  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.apiKeyHash, hash))
    .limit(1);

  if (rows.length === 0) {
    throw new UnauthorizedError('Invalid API key');
  }

  const project = rows[0];
  c.set('projectId', project.id);
  await next();
});
