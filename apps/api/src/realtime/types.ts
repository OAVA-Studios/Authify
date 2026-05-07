export interface RealtimeMessage {
  type: 'subscribe' | 'unsubscribe' | 'broadcast' | 'presence' | 'message' | 'error' | 'system';
  channel?: string;
  payload?: Record<string, unknown>;
  event?: string;
  data?: unknown;
  error?: string;
  timestamp?: string;
}

export interface ChannelPresence {
  userId?: string;
  clientId: string;
  joinedAt: string;
  metadata?: Record<string, unknown>;
}

export interface ConnectionState {
  clientId: string;
  projectId?: string;
  userId?: string;
  role?: string;
  channels: Set<string>;
  metadata: Record<string, unknown>;
  connectedAt: Date;
  lastPingAt: Date;
}
