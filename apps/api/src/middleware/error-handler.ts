import type { ErrorHandler } from 'hono';
import { ApiError, RateLimitError } from '@authify/shared';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';

export const errorHandler: ErrorHandler = (err, c) => {
  const requestId = c.get('requestId') ?? 'unknown';

  if (err instanceof ApiError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId }, err.message);
    }
    const headers: Record<string, string> = {};
    if (err instanceof RateLimitError && err.retryAfter) {
      headers['Retry-After'] = String(err.retryAfter);
    }
    return c.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
        requestId,
      },
      err.statusCode as import('hono/utils/http-status').StatusCode,
      headers
    );
  }

  logger.error({ err, requestId }, 'Unhandled error');

  return c.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
        ...(env.NODE_ENV !== 'production' && err.stack ? { stack: err.stack } : {}),
      },
      requestId,
    },
    500
  );
};
