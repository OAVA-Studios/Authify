import { createMiddleware } from 'hono/factory';
import { logger as baseLogger } from '../lib/logger.js';
import type { Variables } from '../types/context.js';

export const attachLogger = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  const requestId = c.get('requestId');
  c.set('logger', baseLogger.child({ requestId }));
  await next();
});
