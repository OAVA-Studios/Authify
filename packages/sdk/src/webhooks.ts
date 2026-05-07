import type { AuthifyClient } from './client.js';
import type { Webhook, WebhookDelivery, WebhookTriggerResult, PaginatedResponse } from './types.js';

export class AuthifyWebhooks {
  constructor(private client: AuthifyClient) {}

  /* ── CRUD ── */
  async createWebhook(body: {
    name: string;
    url: string;
    secret?: string;
    events: string[];
    active?: boolean;
    retries?: number;
    metadata?: Record<string, unknown>;
  }): Promise<Webhook> {
    return this.client.post('/v1/webhooks', body);
  }

  async listWebhooks(): Promise<Webhook[]> {
    return this.client.get('/v1/webhooks');
  }

  async getWebhook(id: string): Promise<Webhook> {
    return this.client.get(`/v1/webhooks/${id}`);
  }

  async updateWebhook(
    id: string,
    body: {
      name?: string;
      url?: string;
      secret?: string | null;
      events?: string[];
      active?: boolean;
      retries?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<Webhook> {
    return this.client.patch(`/v1/webhooks/${id}`, body);
  }

  async deleteWebhook(id: string): Promise<void> {
    return this.client.delete(`/v1/webhooks/${id}`);
  }

  /* ── Deliveries ── */
  async listDeliveries(params?: {
    webhookId?: string;
    event?: string;
    status?: 'success' | 'failed';
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<WebhookDelivery[]>> {
    const query = new URLSearchParams();
    if (params?.webhookId) query.set('webhookId', params.webhookId);
    if (params?.event) query.set('event', params.event);
    if (params?.status) query.set('status', params.status);
    if (params?.page !== undefined) query.set('page', String(params.page));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    return this.client.getPaginated(`/v1/webhooks/deliveries?${query.toString()}`);
  }

  /* ── Trigger ── */
  async trigger(event: string, payload?: Record<string, unknown>): Promise<WebhookTriggerResult> {
    return this.client.post('/v1/webhooks/trigger', { event, payload: payload ?? {} });
  }
}
