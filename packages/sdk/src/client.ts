import type { ApiResponse, PaginatedResponse, AuthifyConfig } from './types.js';

export class AuthifyError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly requestId?: string
  ) {
    super(message);
    this.name = 'AuthifyError';
  }
}

export class AuthifyClient {
  public config: AuthifyConfig;
  private onTokenRefresh?: (token: string, refreshToken: string) => void;

  constructor(config: AuthifyConfig) {
    this.config = config;
  }

  setToken(token: string, refreshToken?: string): void {
    this.config.token = token;
    if (refreshToken) this.config.refreshToken = refreshToken;
  }

  onRefresh(cb: (token: string, refreshToken: string) => void): void {
    this.onTokenRefresh = cb;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.projectId) {
      headers['x-project-id'] = this.config.projectId;
    }
    if (this.config.apiKey) {
      headers['x-api-key'] = this.config.apiKey;
    }
    if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }
    return headers;
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.config.projectId) {
      headers['x-project-id'] = this.config.projectId;
    }
    if (this.config.apiKey) {
      headers['x-api-key'] = this.config.apiKey;
    }
    if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }
    return headers;
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: { retry?: boolean | undefined; signal?: AbortSignal | undefined }
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const init: RequestInit = {
      method,
      headers: this.getHeaders(),
    };
    if (options?.signal !== undefined) {
      init.signal = options.signal;
    }
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      throw new AuthifyError(0, 'NETWORK_ERROR', err instanceof Error ? err.message : String(err));
    }

    let json: ApiResponse<T>;
    try {
      json = (await res.json()) as ApiResponse<T>;
    } catch {
      throw new AuthifyError(res.status, 'PARSE_ERROR', 'Failed to parse response');
    }

    if (!res.ok) {
      if (res.status === 401 && this.config.refreshToken && options?.retry !== false) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          return this.request<T>(method, path, body, { retry: false, signal: options?.signal });
        }
      }
      throw new AuthifyError(
        res.status,
        json.error?.code ?? 'UNKNOWN_ERROR',
        json.error?.message ?? 'Request failed',
        json.requestId
      );
    }

    return json.data;
  }

  private async refreshToken(): Promise<boolean> {
    if (!this.config.refreshToken) return false;
    try {
      const res = await fetch(`${this.config.baseUrl}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.config.refreshToken }),
      });
      const json = (await res.json()) as ApiResponse<{ accessToken: string; refreshToken: string }>;
      if (res.ok && json.data) {
        this.config.token = json.data.accessToken;
        this.config.refreshToken = json.data.refreshToken;
        this.onTokenRefresh?.(json.data.accessToken, json.data.refreshToken);
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }

  async get<T>(path: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>('GET', path, undefined, { signal });
  }

  async getPaginated<T>(path: string, signal?: AbortSignal): Promise<PaginatedResponse<T>> {
    return this.request<PaginatedResponse<T>>('GET', path, undefined, { signal });
  }

  async post<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    return this.request<T>('POST', path, body, { signal });
  }

  async patch<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    return this.request<T>('PATCH', path, body, { signal });
  }

  async delete<T>(path: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>('DELETE', path, undefined, { signal });
  }

  async upload<T>(path: string, body: Blob | ArrayBuffer | Uint8Array, signal?: AbortSignal): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const blob = body instanceof Blob ? body : new Blob([body as ArrayBuffer | Uint8Array<ArrayBuffer>]);
    const headers = this.getAuthHeaders();
    if (blob.type) {
      headers['Content-Type'] = blob.type;
    }

    let res: Response;
    try {
      const init: RequestInit = { method: 'POST', headers, body: blob };
      if (signal !== undefined) init.signal = signal;
      res = await fetch(url, init);
    } catch (err) {
      throw new AuthifyError(0, 'NETWORK_ERROR', err instanceof Error ? err.message : String(err));
    }

    let json: ApiResponse<T>;
    try {
      json = (await res.json()) as ApiResponse<T>;
    } catch {
      throw new AuthifyError(res.status, 'PARSE_ERROR', 'Failed to parse response');
    }

    if (!res.ok) {
      throw new AuthifyError(
        res.status,
        json.error?.code ?? 'UNKNOWN_ERROR',
        json.error?.message ?? 'Request failed',
        json.requestId
      );
    }

    return json.data;
  }

  async download(path: string, signal?: AbortSignal): Promise<Blob> {
    const url = `${this.config.baseUrl}${path}`;
    const headers = this.getAuthHeaders();

    let res: Response;
    try {
      const init: RequestInit = { method: 'GET', headers };
      if (signal !== undefined) init.signal = signal;
      res = await fetch(url, init);
    } catch (err) {
      throw new AuthifyError(0, 'NETWORK_ERROR', err instanceof Error ? err.message : String(err));
    }

    if (!res.ok) {
      let json: ApiResponse<unknown>;
      try {
        json = (await res.json()) as ApiResponse<unknown>;
      } catch {
        throw new AuthifyError(res.status, 'DOWNLOAD_ERROR', 'Download failed');
      }
      throw new AuthifyError(
        res.status,
        json.error?.code ?? 'DOWNLOAD_ERROR',
        json.error?.message ?? 'Download failed',
        json.requestId
      );
    }

    return res.blob();
  }
}

export { type AuthifyConfig };
