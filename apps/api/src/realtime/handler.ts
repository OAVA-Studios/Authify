import type { ServerWebSocket } from 'bun';
import { channelManager } from './manager.js';
import { broadcastToChannel, setBroadcastHandler } from './broadcast.js';
import { logger } from '../lib/logger.js';
import type { ConnectionState, RealtimeMessage } from './types.js';

export interface WSData {
  clientId: string;
  projectId?: string;
  userId?: string;
  role?: string;
}

const activeSockets = new Map<string, ServerWebSocket<WSData>>();

function parseMessage(data: string | Buffer): RealtimeMessage | null {
  try {
    return JSON.parse(data.toString()) as RealtimeMessage;
  } catch {
    return null;
  }
}

function send(ws: ServerWebSocket<WSData>, message: RealtimeMessage): void {
  try {
    ws.send(JSON.stringify(message));
  } catch {
    // Socket may be closed
  }
}

function sendToClient(clientId: string, message: RealtimeMessage): void {
  const ws = activeSockets.get(clientId);
  if (ws) {
    send(ws, message);
  }
}

export function sendToChannel(channel: string, message: RealtimeMessage, excludeClientId?: string): void {
  const states = channelManager.getChannelSubscribers(channel);
  for (const state of states) {
    if (excludeClientId && state.clientId === excludeClientId) continue;
    sendToClient(state.clientId, message);
  }
}

export function sendToClients(clientIds: string[], message: RealtimeMessage): void {
  for (const id of clientIds) {
    sendToClient(id, message);
  }
}

export function handleOpen(ws: ServerWebSocket<WSData>): void {
  const { clientId, projectId } = ws.data;

  activeSockets.set(clientId, ws);

  const state: ConnectionState = {
    clientId,
    projectId,
    channels: new Set(),
    metadata: {},
    connectedAt: new Date(),
    lastPingAt: new Date(),
  };

  channelManager.addConnection(clientId, state);

  send(ws, {
    type: 'system',
    event: 'connected',
    data: { clientId },
    timestamp: new Date().toISOString(),
  });

  logger.debug({ clientId, projectId }, 'Realtime client connected');
}

export function handleMessage(ws: ServerWebSocket<WSData>, data: string | Buffer): void {
  const { clientId } = ws.data;
  const msg = parseMessage(data);

  if (!msg) {
    send(ws, { type: 'error', error: 'Invalid JSON message' });
    return;
  }

  channelManager.updateLastPing(clientId);

  switch (msg.type) {
    case 'subscribe': {
      const channel = msg.channel;
      if (!channel) {
        send(ws, { type: 'error', error: 'Channel name required' });
        return;
      }
      channelManager.subscribe(clientId, channel);
      send(ws, {
        type: 'system',
        event: 'subscribed',
        channel,
        data: { presence: channelManager.getChannelPresence(channel) },
        timestamp: new Date().toISOString(),
      });
      break;
    }

    case 'unsubscribe': {
      const channel = msg.channel;
      if (!channel) {
        send(ws, { type: 'error', error: 'Channel name required' });
        return;
      }
      channelManager.unsubscribe(clientId, channel);
      send(ws, {
        type: 'system',
        event: 'unsubscribed',
        channel,
        timestamp: new Date().toISOString(),
      });
      break;
    }

    case 'broadcast': {
      const channel = msg.channel;
      if (!channel) {
        send(ws, { type: 'error', error: 'Channel name required' });
        return;
      }
      if (!msg.payload) {
        send(ws, { type: 'error', error: 'Payload required' });
        return;
      }
      // Send locally first
      sendToChannel(channel, {
        type: 'message',
        channel,
        event: msg.event ?? 'broadcast',
        data: msg.payload,
        timestamp: new Date().toISOString(),
      });
      // Publish to Redis for other instances
      broadcastToChannel(channel, {
        type: 'message',
        channel,
        event: msg.event ?? 'broadcast',
        data: msg.payload,
        timestamp: new Date().toISOString(),
      }).catch(() => {});
      break;
    }

    case 'presence': {
      const channel = msg.channel;
      if (!channel) {
        send(ws, { type: 'error', error: 'Channel name required' });
        return;
      }
      send(ws, {
        type: 'presence',
        channel,
        data: channelManager.getChannelPresence(channel),
        timestamp: new Date().toISOString(),
      });
      break;
    }

    default:
      send(ws, { type: 'error', error: `Unknown message type: ${msg.type}` });
  }
}

export function handleClose(ws: ServerWebSocket<WSData>): void {
  const { clientId } = ws.data;
  activeSockets.delete(clientId);
  channelManager.removeConnection(clientId);
  logger.debug({ clientId }, 'Realtime client disconnected');
}

// Setup handler for Redis cross-instance broadcasts
setBroadcastHandler((message, excludeClientId) => {
  if (message.channel) {
    sendToChannel(message.channel, message, excludeClientId);
  }
});
