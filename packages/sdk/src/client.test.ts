import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthifyClient, AuthifyError } from './client.js';

const baseConfig = {
  baseUrl: 'http://localhost:4000',
  projectId: 'proj-1',
  apiKey: 'api-key-123',
};

function mockResponse(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    blob: () => Promise.resolve(new Blob(['test'])),
    headers: new Headers(),
  } as Response);
}

describe('AuthifyClient', () => {
  let client: AuthifyClient;

  beforeEach(() => {
    client = new AuthifyClient(baseConfig);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets headers correctly', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockReturnValue(mockResponse(200, { success: true, data: {} }));

    await client.get('/test');
    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(call[1].headers).toMatchObject({
      'Content-Type': 'application/json',
      'x-project-id': 'proj-1',
      'x-api-key': 'api-key-123',
    });
  });

  it('includes bearer token when set', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockReturnValue(mockResponse(200, { success: true, data: {} }));

    client.setToken('my-token');
    await client.get('/test');
    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((call[1].headers as Record<string, string>)['Authorization']).toBe('Bearer my-token');
  });

  it('returns data on success', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockReturnValue(mockResponse(200, { success: true, data: { id: '1' } }));

    const data = await client.get<{ id: string }>('/test');
    expect(data).toEqual({ id: '1' });
  });

  it('throws AuthifyError on API failure', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockReturnValue(
      mockResponse(400, {
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Invalid' },
        requestId: 'req-1',
      })
    );

    await expect(client.get('/test')).rejects.toThrow(AuthifyError);
    await expect(client.get('/test')).rejects.toMatchObject({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'Invalid',
      requestId: 'req-1',
    });
  });

  it('retries once on 401 with refresh token', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockReturnValueOnce(
        mockResponse(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'Expired' } })
      )
      .mockReturnValueOnce(
        mockResponse(200, { success: true, data: { accessToken: 'new-token', refreshToken: 'new-refresh' } })
      )
      .mockReturnValueOnce(mockResponse(200, { success: true, data: { ok: true } }));

    client.setToken('old-token', 'old-refresh');
    const data = await client.get<{ ok: boolean }>('/test');
    expect(data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(client.config.token).toBe('new-token');
  });

  it('sends POST body as JSON', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockReturnValue(mockResponse(201, { success: true, data: { id: '1' } }));

    await client.post('/test', { name: 'hello' });
    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(call[1].body).toBe('{"name":"hello"}');
  });

  it('passes AbortSignal', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockReturnValue(mockResponse(200, { success: true, data: {} }));

    const ctrl = new AbortController();
    await client.get('/test', ctrl.signal);
    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(call[1].signal).toBe(ctrl.signal);
  });

  it('throws NETWORK_ERROR on fetch failure', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValue(new Error('net::ERR_CONNECTION_REFUSED'));

    await expect(client.get('/test')).rejects.toThrow(AuthifyError);
    await expect(client.get('/test')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });

  it('throws PARSE_ERROR on invalid JSON', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockReturnValue(
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('invalid')),
      } as Response)
    );

    await expect(client.get('/test')).rejects.toMatchObject({
      code: 'PARSE_ERROR',
    });
  });
});
