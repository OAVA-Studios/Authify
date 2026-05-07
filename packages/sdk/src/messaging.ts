import type { AuthifyClient } from './client.js';
import type { MessagingProvider, MessageTemplate, Message, SendMessageResponse, PaginatedResponse } from './types.js';

export class AuthifyMessaging {
  constructor(private client: AuthifyClient) {}

  /* ── Providers ── */
  async createProvider(body: {
    name: string;
    type: 'smtp' | 'resend' | 'mailgun' | 'sendgrid' | 'twilio' | 'vonage' | 'fcm';
    config: Record<string, unknown>;
    isDefault?: boolean;
  }): Promise<MessagingProvider> {
    return this.client.post('/v1/messaging/providers', body);
  }

  async listProviders(): Promise<MessagingProvider[]> {
    return this.client.get('/v1/messaging/providers');
  }

  async getProvider(id: string): Promise<MessagingProvider> {
    return this.client.get(`/v1/messaging/providers/${id}`);
  }

  async updateProvider(
    id: string,
    body: {
      name?: string;
      config?: Record<string, unknown>;
      isDefault?: boolean;
      active?: boolean;
    }
  ): Promise<MessagingProvider> {
    return this.client.patch(`/v1/messaging/providers/${id}`, body);
  }

  async deleteProvider(id: string): Promise<void> {
    return this.client.delete(`/v1/messaging/providers/${id}`);
  }

  /* ── Templates ── */
  async createTemplate(body: {
    name: string;
    type: 'email' | 'sms' | 'push';
    subject?: string;
    body: string;
    htmlBody?: string;
    variables?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<MessageTemplate> {
    return this.client.post('/v1/messaging/templates', body);
  }

  async listTemplates(): Promise<MessageTemplate[]> {
    return this.client.get('/v1/messaging/templates');
  }

  async getTemplate(id: string): Promise<MessageTemplate> {
    return this.client.get(`/v1/messaging/templates/${id}`);
  }

  async updateTemplate(
    id: string,
    body: {
      name?: string;
      type?: 'email' | 'sms' | 'push';
      subject?: string | null;
      body?: string;
      htmlBody?: string | null;
      variables?: string[];
      metadata?: Record<string, unknown>;
    }
  ): Promise<MessageTemplate> {
    return this.client.patch(`/v1/messaging/templates/${id}`, body);
  }

  async deleteTemplate(id: string): Promise<void> {
    return this.client.delete(`/v1/messaging/templates/${id}`);
  }

  /* ── Send ── */
  async sendMessage(body: {
    providerId?: string;
    templateId?: string;
    type: 'email' | 'sms' | 'push';
    to: string;
    subject?: string;
    body?: string;
    htmlBody?: string;
    variables?: Record<string, string>;
    metadata?: Record<string, unknown>;
  }): Promise<SendMessageResponse> {
    return this.client.post('/v1/messaging/send', body);
  }

  /* ── Messages ── */
  async listMessages(params?: {
    status?: 'pending' | 'sent' | 'failed' | 'delivered';
    type?: 'email' | 'sms' | 'push';
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Message[]>> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.type) query.set('type', params.type);
    if (params?.page !== undefined) query.set('page', String(params.page));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    return this.client.getPaginated(`/v1/messaging/messages?${query.toString()}`);
  }

  async getMessage(id: string): Promise<Message> {
    return this.client.get(`/v1/messaging/messages/${id}`);
  }

  async deleteMessage(id: string): Promise<void> {
    return this.client.delete(`/v1/messaging/messages/${id}`);
  }
}
