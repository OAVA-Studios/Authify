import type { Context } from 'hono';
import type { Logger } from 'pino';

export type Variables = {
  requestId: string;
  logger: Logger;
  userId?: string;
  projectId?: string;
  role?: string;
  sessionId?: string;
};

export type AppContext = Context<{ Variables: Variables }>;
