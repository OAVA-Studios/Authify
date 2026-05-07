import { Hono } from 'hono';
import { z } from 'zod';
import { channelManager, publishToRedis } from '../realtime/index.js';
import { sendToChannel, sendToClients } from '../realtime/handler.js';
import { requireAuth } from '../middleware/auth.js';
import { projectAuth } from '../middleware/project-auth.js';
import { validateJson } from '../middleware/index.js';
import { ForbiddenError, BadRequestError } from '@authify/shared';
import type { Variables } from '../types/context.js';
import type { RealtimeMessage } from '../realtime/types.js';

const realtime = new Hono<{ Variables: Variables }>();

function isAdmin(c: import('hono').Context): boolean {
  return c.get('role') === 'admin';
}

/* ───────────────────── Channel Info ───────────────────── */

realtime.get('/channels', requireAuth, async (c) => {
  if (!isAdmin(c)) throw new ForbiddenError();

  const channels = channelManager.getAllChannels();
  return c.json({
    success: true,
    data: channels.map((name) => ({
      name,
      subscriberCount: channelManager.getChannelSubscribers(name).length,
      presence: channelManager.getChannelPresence(name),
    })),
  });
});

realtime.get('/channels/:name', requireAuth, async (c) => {
  if (!isAdmin(c)) throw new ForbiddenError();
  const name = c.req.param('name');

  const subscribers = channelManager.getChannelSubscribers(name);
  return c.json({
    success: true,
    data: {
      name,
      subscriberCount: subscribers.length,
      presence: channelManager.getChannelPresence(name),
      subscribers: subscribers.map((s) => ({
        clientId: s.clientId,
        userId: s.userId,
        projectId: s.projectId,
        connectedAt: s.connectedAt,
        channels: Array.from(s.channels),
      })),
    },
  });
});

/* ───────────────────── Admin Broadcast ───────────────────── */

const broadcastSchema = z.object({
  channel: z.string().min(1).optional(),
  clientIds: z.array(z.string()).optional(),
  event: z.string().min(1).default('broadcast'),
  payload: z.record(z.unknown()),
});

realtime.post('/broadcast', requireAuth, validateJson(broadcastSchema), async (c) => {
  if (!isAdmin(c)) throw new ForbiddenError();
  const body = c.req.valid('json');

  const message: RealtimeMessage = {
    type: 'message',
    event: body.event,
    data: body.payload,
    timestamp: new Date().toISOString(),
  };

  if (body.channel) {
    message.channel = body.channel;
    // Send locally
    sendToChannel(body.channel, message);
    // Publish to Redis for other instances
    await publishToRedis([], message, body.channel);
  } else if (body.clientIds && body.clientIds.length > 0) {
    sendToClients(body.clientIds, message);
    await publishToRedis(body.clientIds, message);
  } else {
    throw new BadRequestError('Either channel or clientIds required');
  }

  return c.json({ success: true, data: { sent: true } });
});

/* ───────────────────── Presence Stats ───────────────────── */

realtime.get('/stats', requireAuth, async (c) => {
  if (!isAdmin(c)) throw new ForbiddenError();

  return c.json({
    success: true,
    data: {
      totalConnections: channelManager.getConnectionCount(),
      totalChannels: channelManager.getChannelCount(),
    },
  });
});

/* ───────────────────── Project-scoped Broadcast ───────────────────── */

realtime.post('/broadcast/project', projectAuth, validateJson(broadcastSchema), async (c) => {
  const projectId = c.get('projectId')!;
  const body = c.req.valid('json');

  const message: RealtimeMessage = {
    type: 'message',
    event: body.event,
    data: body.payload,
    timestamp: new Date().toISOString(),
  };

  if (body.channel) {
    message.channel = body.channel;
    // Filter subscribers by projectId
    const states = channelManager.getChannelSubscribers(body.channel);
    const projectClients = states
      .filter((s) => s.projectId === projectId)
      .map((s) => s.clientId);

    sendToClients(projectClients, message);
    await publishToRedis(projectClients, message, body.channel);
  } else {
    throw new BadRequestError('Channel required for project broadcast');
  }

  return c.json({ success: true, data: { sent: true } });
});

export default realtime;
