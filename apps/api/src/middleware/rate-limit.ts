import { createMiddleware } from 'hono/factory';
import { RateLimitError } from '@authify/shared';
import { redis } from '../lib/redis.js';
import type { Variables, AppContext } from '../types/context.js';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
  keyGenerator?: (c: AppContext) => string;
}

function defaultKeyGenerator(c: AppContext): string {
  const apiKey = c.req.header('x-api-key');
  if (apiKey) return `ratelimit:api:${apiKey}`;
  const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown';
  return `ratelimit:ip:${ip}:${c.req.path}`;
}

export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    keyPrefix = 'rl',
    keyGenerator = defaultKeyGenerator,
  } = options;

  return createMiddleware<{ Variables: Variables }>(async (c, next) => {
    const key = `${keyPrefix}:${keyGenerator(c)}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zcard(key);
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    pipeline.pexpire(key, windowMs);
    const results = await pipeline.exec();

    const countResult = results?.[1] as [Error | null, number] | undefined;
    const currentCount = countResult?.[1] ?? 0;

    if (currentCount >= maxRequests) {
      const retryAfter = Math.ceil(windowMs / 1000);
      c.header('Retry-After', String(retryAfter));
      throw new RateLimitError('Too many requests', 'RATE_LIMITED', retryAfter);
    }

    await next();
  });
}
