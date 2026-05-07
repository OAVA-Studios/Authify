import type { ConnectionState, ChannelPresence, RealtimeMessage } from './types.js';

class ChannelManager {
  private connections = new Map<string, ConnectionState>();
  private channels = new Map<string, Set<string>>(); // channel -> Set of clientIds
  private presence = new Map<string, Map<string, ChannelPresence>>(); // channel -> Map of clientId -> presence

  addConnection(clientId: string, state: ConnectionState): void {
    this.connections.set(clientId, state);
  }

  removeConnection(clientId: string): void {
    const state = this.connections.get(clientId);
    if (!state) return;

    // Unsubscribe from all channels
    for (const channel of state.channels) {
      this.unsubscribe(clientId, channel, false);
    }

    this.connections.delete(clientId);
  }

  getConnection(clientId: string): ConnectionState | undefined {
    return this.connections.get(clientId);
  }

  subscribe(clientId: string, channel: string): boolean {
    const state = this.connections.get(clientId);
    if (!state) return false;

    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
      this.presence.set(channel, new Map());
    }

    this.channels.get(channel)!.add(clientId);
    state.channels.add(channel);

    // Update presence
    const pres: ChannelPresence = {
      clientId,
      userId: state.userId,
      joinedAt: new Date().toISOString(),
      metadata: state.metadata,
    };
    this.presence.get(channel)!.set(clientId, pres);

    return true;
  }

  unsubscribe(clientId: string, channel: string, removeFromState = true): boolean {
    const channelSet = this.channels.get(channel);
    if (channelSet) {
      channelSet.delete(clientId);
      if (channelSet.size === 0) {
        this.channels.delete(channel);
        this.presence.delete(channel);
      } else {
        this.presence.get(channel)?.delete(clientId);
      }
    }

    if (removeFromState) {
      const state = this.connections.get(clientId);
      state?.channels.delete(channel);
    }

    return true;
  }

  getChannelSubscribers(channel: string): ConnectionState[] {
    const clientIds = this.channels.get(channel);
    if (!clientIds) return [];

    const states: ConnectionState[] = [];
    for (const id of clientIds) {
      const state = this.connections.get(id);
      if (state) states.push(state);
    }
    return states;
  }

  getChannelPresence(channel: string): ChannelPresence[] {
    const pres = this.presence.get(channel);
    if (!pres) return [];
    return Array.from(pres.values());
  }

  getAllChannels(): string[] {
    return Array.from(this.channels.keys());
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getChannelCount(): number {
    return this.channels.size;
  }

  updateLastPing(clientId: string): void {
    const state = this.connections.get(clientId);
    if (state) state.lastPingAt = new Date();
  }

  getAllConnections(): ConnectionState[] {
    return Array.from(this.connections.values());
  }
}

export const channelManager = new ChannelManager();
