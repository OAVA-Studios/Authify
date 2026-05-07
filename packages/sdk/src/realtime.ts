import WebSocket from 'isomorphic-ws';
import type { AuthifyClient } from './client.js';
import type {
  RealtimeMessage,
  RealtimeChannelInfo,
  RealtimeChannelDetail,
  RealtimeStats,
} from './types.js';

export interface RealtimeClientOptions {
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

function messageDataToString(data: unknown): string {
  if (typeof data === 'string') return data;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) return data.toString('utf8');
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (ArrayBuffer.isView(data)) {
    const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    return new TextDecoder().decode(buf as ArrayBuffer);
  }
  return String(data);
}

export class AuthifyRealtime {
  private ws: WebSocket | undefined;
  private clientId?: string;
  private subscriptions = new Set<string>();
  private messageHandlers = new Map<string, ((data: unknown) => void)[]>();
  private opts: Required<RealtimeClientOptions>;

  constructor(private client: AuthifyClient, options?: RealtimeClientOptions) {
    this.opts = {
      autoReconnect: options?.autoReconnect ?? true,
      reconnectInterval: options?.reconnectInterval ?? 3000,
    };
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL('/v1/realtime', this.client.config.baseUrl.replace(/^http/, 'ws'));
      url.searchParams.set('project_id', this.client.config.projectId);
      this.ws = new WebSocket(url.toString());

      this.ws.onopen = () => {
        for (const channel of this.subscriptions) {
          this.send({ type: 'subscribe', channel });
        }
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(messageDataToString(event.data)) as RealtimeMessage;
          if (msg.type === 'system' && msg.clientId) {
            this.clientId = msg.clientId;
          }
          if (msg.channel && msg.event) {
            const handlers = this.messageHandlers.get(`${msg.channel}:${msg.event}`) ?? [];
            for (const h of handlers) h(msg.data);
          }
        } catch {
          // ignore invalid messages
        }
      };

      this.ws.onerror = (err) => reject(err);
      this.ws.onclose = () => {
        if (this.opts.autoReconnect) {
          setTimeout(() => this.connect().catch(() => {}), this.opts.reconnectInterval);
        }
      };
    });
  }

  subscribe(channel: string, event: string, handler: (data: unknown) => void): () => void {
    const key = `${channel}:${event}`;
    if (!this.messageHandlers.has(key)) this.messageHandlers.set(key, []);
    this.messageHandlers.get(key)!.push(handler);

    if (!this.subscriptions.has(channel)) {
      this.subscriptions.add(channel);
      this.send({ type: 'subscribe', channel });
    }

    return () => {
      const arr = this.messageHandlers.get(key) ?? [];
      const idx = arr.indexOf(handler);
      if (idx !== -1) arr.splice(idx, 1);
    };
  }

  unsubscribe(channel: string): void {
    this.subscriptions.delete(channel);
    this.send({ type: 'unsubscribe', channel });
    for (const key of this.messageHandlers.keys()) {
      if (key.startsWith(`${channel}:`)) this.messageHandlers.delete(key);
    }
  }

  broadcast(channel: string, event: string, payload: Record<string, unknown>): void {
    this.send({ type: 'broadcast', channel, event, payload });
  }

  presence(channel: string): void {
    this.send({ type: 'presence', channel });
  }

  private send(msg: Partial<RealtimeMessage>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = undefined;
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get id(): string | undefined {
    return this.clientId;
  }

  /* ── REST API helpers ── */
  async listChannels(): Promise<RealtimeChannelInfo[]> {
    return this.client.get('/v1/realtime/channels');
  }

  async getChannel(name: string): Promise<RealtimeChannelDetail> {
    return this.client.get(`/v1/realtime/channels/${name}`);
  }

  async adminBroadcast(body: {
    channel?: string;
    clientIds?: string[];
    event?: string;
    payload: Record<string, unknown>;
  }): Promise<{ sent: boolean }> {
    return this.client.post('/v1/realtime/broadcast', body);
  }

  async projectBroadcast(body: {
    channel: string;
    event?: string;
    payload: Record<string, unknown>;
  }): Promise<{ sent: boolean }> {
    return this.client.post('/v1/realtime/broadcast/project', body);
  }

  async stats(): Promise<RealtimeStats> {
    return this.client.get('/v1/realtime/stats');
  }
}
