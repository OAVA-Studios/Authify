import type { AuthifyClient } from './client.js';
import type { ServerlessFunction, FunctionExecution, PaginatedResponse } from './types.js';

export class AuthifyFunctions {
  constructor(private client: AuthifyClient) {}

  /* ── CRUD ── */
  async createFunction(body: {
    name: string;
    slug: string;
    entrypoint?: string;
    runtime?: 'node22' | 'node20' | 'bun';
    sourceCode: string;
    sourcePath?: string;
    envVars?: Record<string, string>;
    triggerType?: 'http' | 'schedule' | 'event' | 'webhook';
    triggerConfig?: Record<string, unknown>;
    timeout?: number;
    memory?: number;
    metadata?: Record<string, unknown>;
  }): Promise<ServerlessFunction> {
    return this.client.post('/v1/functions', body);
  }

  async listFunctions(params?: {
    page?: number;
    limit?: number;
    triggerType?: 'http' | 'schedule' | 'event' | 'webhook';
  }): Promise<PaginatedResponse<ServerlessFunction[]>> {
    const query = new URLSearchParams();
    if (params?.page !== undefined) query.set('page', String(params.page));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.triggerType) query.set('triggerType', params.triggerType);
    return this.client.getPaginated(`/v1/functions?${query.toString()}`);
  }

  async getFunction(id: string): Promise<ServerlessFunction> {
    return this.client.get(`/v1/functions/${id}`);
  }

  async updateFunction(
    id: string,
    body: {
      name?: string;
      slug?: string;
      entrypoint?: string;
      runtime?: 'node22' | 'node20' | 'bun';
      sourceCode?: string;
      sourcePath?: string | null;
      envVars?: Record<string, string>;
      triggerType?: 'http' | 'schedule' | 'event' | 'webhook';
      triggerConfig?: Record<string, unknown>;
      timeout?: number;
      memory?: number;
      active?: boolean;
      metadata?: Record<string, unknown>;
    }
  ): Promise<ServerlessFunction> {
    return this.client.patch(`/v1/functions/${id}`, body);
  }

  async deleteFunction(id: string): Promise<void> {
    return this.client.delete(`/v1/functions/${id}`);
  }

  /* ── Invoke ── */
  async invoke(
    slug: string,
    options?: {
      method?: string;
      body?: unknown;
      query?: Record<string, string>;
      signal?: AbortSignal;
    }
  ): Promise<unknown> {
    const query = options?.query ? `?${new URLSearchParams(options.query).toString()}` : '';
    return this.client.request(
      options?.method ?? 'POST',
      `/v1/functions/${slug}/invoke${query}`,
      options?.body,
      { signal: options?.signal }
    );
  }

  /* ── Async Trigger ── */
  async trigger(
    slug: string,
    body: { event: string; payload?: Record<string, unknown> }
  ): Promise<{ jobId: string; status: string }> {
    return this.client.post(`/v1/functions/${slug}/trigger`, body);
  }

  /* ── Executions ── */
  async listExecutions(params?: {
    functionId?: string;
    status?: 'pending' | 'running' | 'completed' | 'failed';
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<FunctionExecution[]>> {
    const query = new URLSearchParams();
    if (params?.functionId) query.set('functionId', params.functionId);
    if (params?.status) query.set('status', params.status);
    if (params?.page !== undefined) query.set('page', String(params.page));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    return this.client.getPaginated(`/v1/functions/executions?${query.toString()}`);
  }

  async getExecution(id: string): Promise<FunctionExecution> {
    return this.client.get(`/v1/functions/executions/${id}`);
  }

  async deleteExecution(id: string): Promise<void> {
    return this.client.delete(`/v1/functions/executions/${id}`);
  }
}
