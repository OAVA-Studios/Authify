import { cors } from 'hono/cors';
import { env } from '../lib/env.js';

export const corsMiddleware = cors({
  origin: (origin) => {
    if (env.NODE_ENV === 'development') return origin;
    const allowed = [env.DASHBOARD_URL];
    if (origin && allowed.includes(origin)) return origin;
    return null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'x-api-key', 'x-project-id'],
  credentials: true,
  maxAge: 86400,
});
