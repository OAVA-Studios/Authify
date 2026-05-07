import { Hono } from 'hono';
import {
  securityMiddleware,
  corsMiddleware,
  requestId,
  attachLogger,
  errorHandler,
} from './middleware/index.js';
import { env } from './lib/env.js';
import authRoutes from './routes/auth.js';
import oauthRoutes from './routes/oauth.js';
import licensingRoutes from './routes/licensing.js';
import databaseRoutes from './routes/database.js';
import storageRoutes from './routes/storage.js';
import realtimeRoutes from './routes/realtime.js';
import functionsRoutes from './routes/functions.js';
import messagingRoutes from './routes/messaging.js';
import webhooksRoutes from './routes/webhooks.js';
import { handleOpen, handleMessage, handleClose } from './realtime/handler.js';
import { startRedisSubscriber } from './realtime/broadcast.js';
import { createRequire } from 'module';
import { logger } from './lib/logger.js';
import { openApiSpec } from './openapi.js';
import type { Variables } from './types/context.js';
import type { WSData } from './realtime/handler.js';
import type { ServerWebSocket } from 'bun';

const require = createRequire(import.meta.url);
const swaggerDistEntry = require.resolve('swagger-ui-dist');
const swaggerDistPath = swaggerDistEntry.slice(0, swaggerDistEntry.lastIndexOf('/'));

const app = new Hono<{ Variables: Variables }>();

// Security & CORS
app.use(securityMiddleware);
app.use(corsMiddleware);

// Request context
app.use(requestId);
app.use(attachLogger);

// Health check
app.get('/health', (c) =>
  c.json({
    status: 'ok',
    service: 'authify-api',
    requestId: c.get('requestId'),
  })
);

// OpenAPI spec
app.get('/openapi.json', (c) => c.json(openApiSpec));

// Swagger UI
app.get('/docs', (c) =>
  c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Authify API Docs</title>
  <link rel="stylesheet" href="/docs/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/docs/swagger-ui-bundle.js" crossorigin></script>
  <script src="/docs/swagger-ui-standalone-preset.js" crossorigin></script>
  <script>
    window.onload = function () {
      window.ui = SwaggerUIBundle({
        url: '/openapi.json',
        dom_id: '#swagger-ui',
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: 'StandaloneLayout',
      });
    };
  </script>
</body>
</html>`)
);

import { stat, readFile } from 'node:fs/promises';

app.get('/docs/:file', async (c) => {
  const file = c.req.param('file');
  if (file.includes('..') || file.includes('/')) {
    return c.json({ error: 'Invalid file' }, 400);
  }
  const filePath = `${swaggerDistPath}/${file}`;
  try {
    const s = await stat(filePath);
    if (!s.isFile()) throw new Error('Not a file');
    const data = await readFile(filePath);
    const ext = file.split('.').pop() ?? '';
    const contentType =
      ext === 'css'
        ? 'text/css'
        : ext === 'js'
          ? 'application/javascript'
          : ext === 'png'
            ? 'image/png'
            : 'application/octet-stream';
    return c.body(data, 200, { 'Content-Type': contentType });
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }
});

// API v1
app.route('/v1/auth', authRoutes);
app.route('/v1/auth/oauth', oauthRoutes);
app.route('/v1/licensing', licensingRoutes);
app.route('/v1/database', databaseRoutes);
app.route('/v1/storage', storageRoutes);
app.route('/v1/realtime', realtimeRoutes);
app.route('/v1/functions', functionsRoutes);
app.route('/v1/messaging', messagingRoutes);
app.route('/v1/webhooks', webhooksRoutes);

// 404 handler
app.notFound((c) =>
  c.json(
    {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found' },
      requestId: c.get('requestId'),
    },
    404
  )
);

// Global error handler
app.onError(errorHandler);

export default app;

if (import.meta.main) {
  const port = env.API_PORT;

  // Start Redis subscriber for cross-instance realtime broadcast
  startRedisSubscriber().catch((err) => {
    logger.error({ err }, 'Failed to start Redis realtime subscriber');
  });

  const server = Bun.serve({
    port,
    fetch(req, server) {
      const url = new URL(req.url);

      // Handle WebSocket upgrade on /v1/realtime path
      if (url.pathname === '/v1/realtime') {
        const upgradeHeader = req.headers.get('upgrade');
        if (upgradeHeader === 'websocket') {
          const projectId = url.searchParams.get('project_id') ?? undefined;
          const success = server.upgrade(req, {
            data: {
              clientId: crypto.randomUUID(),
              projectId,
              userId: undefined,
              role: undefined,
            } satisfies WSData,
          });
          if (success) return undefined as unknown as Response;
        }
      }

      return app.fetch(req, server as never);
    },
    websocket: {
      open(ws) {
        handleOpen(ws as ServerWebSocket<WSData>);
      },
      message(ws, message) {
        handleMessage(ws as ServerWebSocket<WSData>, message);
      },
      close(ws) {
        handleClose(ws as ServerWebSocket<WSData>);
      },
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Authify API listening on http://localhost:${server.port}`);
  // eslint-disable-next-line no-console
  console.log(`Authify Realtime WebSocket on ws://localhost:${server.port}/v1/realtime`);
}
