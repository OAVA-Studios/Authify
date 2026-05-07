import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import type { RealtimeMessage } from './types.js';

const REDIS_CHANNEL = 'authify:realtime:broadcast';

export type BroadcastHandler = (message: RealtimeMessage, excludeClientId?: string) => void;

let handler: BroadcastHandler | null = null;

export function setBroadcastHandler(h: BroadcastHandler): void {
  handler = h;
}

export async function startRedisSubscriber(): Promise<void> {
  const subscriber = redis.duplicate();
  await subscriber.subscribe(REDIS_CHANNEL);

  subscriber.on('message', (_channel, message) => {
    try {
      const data = JSON.parse(message) as {
        channel?: string;
        excludeClientId?: string;
        message: RealtimeMessage;
      };
      if (handler) {
        // Set the channel from the redis message
        const msg: RealtimeMessage = { ...data.message };
        if (data.channel) msg.channel = data.channel;
        handler(msg, data.excludeClientId);
      }
    } catch (err) {
      logger.error({ err }, 'Failed to process redis broadcast message');
    }
  });

  logger.info('Redis realtime subscriber started');
}

export async function publishToRedis(
  message: RealtimeMessage,
  channel?: string,
  excludeClientId?: string
): Promise<void> {
  await redis.publish(
    REDIS_CHANNEL,
    JSON.stringify({ channel, excludeClientId, message })
  );
}

export async function broadcastToChannel(
  channel: string,
  message: RealtimeMessage,
  excludeClientId?: string
): Promise<void> {
  await publishToRedis(message, channel, excludeClientId);
}
