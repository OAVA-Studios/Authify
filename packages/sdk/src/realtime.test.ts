import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthifyRealtime as AuthifyRealtimeType } from './realtime.js';
import { AuthifyClient } from './client.js';

function createMockWs() {
  return {
    readyState: 0,
    send: vi.fn(),
    close: vi.fn(),
    onopen: null as unknown as (() => void) | null,
    onmessage: null as unknown as ((event: { data: unknown }) => void) | null,
    onerror: null as unknown as ((err: Error) => void) | null,
    onclose: null as unknown as (() => void) | null,
  };
}

let activeMock = createMockWs();

const MockWebSocket = vi.fn(() => activeMock);
(MockWebSocket as unknown as { OPEN: number }).OPEN = 1;
(MockWebSocket as unknown as { CONNECTING: number }).CONNECTING = 0;

vi.mock('isomorphic-ws', () => {
  return {
    default: MockWebSocket,
  };
});

const baseConfig = {
  baseUrl: 'http://localhost:4000',
  projectId: 'proj-1',
};

describe('AuthifyRealtime', () => {
  let client: AuthifyClient;
  let rt: AuthifyRealtimeType;

  beforeEach(async () => {
    vi.clearAllMocks();
    activeMock = createMockWs();
    client = new AuthifyClient(baseConfig);
    const { AuthifyRealtime } = await import('./realtime.js');
    rt = new AuthifyRealtime(client, { autoReconnect: false });
  });

  it('connects and resolves on open', async () => {
    const promise = rt.connect();
    activeMock.readyState = 1;
    activeMock.onopen?.();
    await promise;
    expect(rt.connected).toBe(true);
  });

  it('subscribes to a channel', async () => {
    const promise = rt.connect();
    activeMock.readyState = 1;
    activeMock.onopen?.();
    await promise;
    activeMock.send.mockClear();
    rt.subscribe('updates', 'new', () => {});
    expect(activeMock.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'subscribe', channel: 'updates' })
    );
  });

  it('re-subscribes on reconnect', async () => {
    rt.subscribe('updates', 'new', () => {});
    const promise = rt.connect();
    activeMock.readyState = 1;
    activeMock.onopen?.();
    await promise;
    expect(activeMock.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'subscribe', channel: 'updates' })
    );
  });

  it('handles incoming messages', async () => {
    const handler = vi.fn();
    rt.subscribe('updates', 'new', handler);
    const promise = rt.connect();
    activeMock.readyState = 1;
    activeMock.onopen?.();
    await promise;

    activeMock.onmessage?.({
      data: JSON.stringify({
        type: 'message',
        channel: 'updates',
        event: 'new',
        data: { id: 1 },
      }),
    });
    expect(handler).toHaveBeenCalledWith({ id: 1 });
  });

  it('sets clientId from system message', async () => {
    const promise = rt.connect();
    activeMock.readyState = 1;
    activeMock.onopen?.();
    await promise;

    activeMock.onmessage?.({
      data: JSON.stringify({ type: 'system', clientId: 'client-123' }),
    });
    expect(rt.id).toBe('client-123');
  });

  it('broadcasts a message', async () => {
    const promise = rt.connect();
    activeMock.readyState = 1;
    activeMock.onopen?.();
    await promise;
    activeMock.send.mockClear();
    rt.broadcast('updates', 'action', { foo: 'bar' });
    expect(activeMock.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'broadcast', channel: 'updates', event: 'action', payload: { foo: 'bar' } })
    );
  });

  it('disconnects', async () => {
    const promise = rt.connect();
    activeMock.readyState = 1;
    activeMock.onopen?.();
    await promise;
    rt.disconnect();
    expect(activeMock.close).toHaveBeenCalled();
    expect(rt.connected).toBe(false);
  });
});
