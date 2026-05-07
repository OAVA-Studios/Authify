import type { AuthifyClient } from './client.js';
import type {
  LicenseApp,
  LicenseKey,
  LicenseActivation,
  LicenseVariable,
  BlacklistEntry,
  ActivationResponse,
  ValidationResponse,
  PaginatedResponse,
} from './types.js';

export class AuthifyLicensing {
  constructor(private client: AuthifyClient) {}

  /* ── Apps ── */
  async createApp(body: {
    name: string;
    description?: string;
    version?: string;
    hwidLocking?: boolean;
    maxDevices?: number;
    webhookUrl?: string;
    antiDebug?: boolean;
    encryptionKey?: string;
    metadata?: Record<string, unknown>;
  }): Promise<LicenseApp> {
    return this.client.post('/v1/licensing/apps', body);
  }

  async listApps(): Promise<LicenseApp[]> {
    return this.client.get('/v1/licensing/apps');
  }

  async getApp(id: string): Promise<LicenseApp> {
    return this.client.get(`/v1/licensing/apps/${id}`);
  }

  async updateApp(
    id: string,
    body: {
      name?: string;
      description?: string;
      version?: string;
      hwidLocking?: boolean;
      maxDevices?: number;
      webhookUrl?: string | null;
      antiDebug?: boolean;
      metadata?: Record<string, unknown>;
    }
  ): Promise<LicenseApp> {
    return this.client.patch(`/v1/licensing/apps/${id}`, body);
  }

  async deleteApp(id: string): Promise<void> {
    return this.client.delete(`/v1/licensing/apps/${id}`);
  }

  /* ── Keys ── */
  async createKey(body: {
    appId: string;
    userId?: string;
    tier?: string;
    maxActivations?: number;
    expiresAt?: string;
    note?: string;
    metadata?: Record<string, unknown>;
    quantity?: number;
  }): Promise<LicenseKey | LicenseKey[]> {
    return this.client.post('/v1/licensing/keys', body);
  }

  async listKeys(params?: {
    appId?: string;
    status?: 'pending' | 'active' | 'expired' | 'revoked' | 'banned';
    userId?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<LicenseKey[]>> {
    const query = new URLSearchParams();
    if (params?.appId) query.set('appId', params.appId);
    if (params?.status) query.set('status', params.status);
    if (params?.userId) query.set('userId', params.userId);
    if (params?.page !== undefined) query.set('page', String(params.page));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    return this.client.getPaginated(`/v1/licensing/keys?${query.toString()}`);
  }

  async getKey(id: string): Promise<LicenseKey> {
    return this.client.get(`/v1/licensing/keys/${id}`);
  }

  async updateKey(
    id: string,
    body: {
      tier?: string;
      maxActivations?: number;
      expiresAt?: string | null;
      status?: 'pending' | 'active' | 'expired' | 'revoked' | 'banned';
      note?: string | null;
      metadata?: Record<string, unknown>;
      userId?: string | null;
    }
  ): Promise<LicenseKey> {
    return this.client.patch(`/v1/licensing/keys/${id}`, body);
  }

  async deleteKey(id: string): Promise<void> {
    return this.client.delete(`/v1/licensing/keys/${id}`);
  }

  /* ── Activation / Validation ── */
  async activate(body: {
    key: string;
    hwid: string;
    deviceName?: string;
    appVersion?: string;
  }): Promise<ActivationResponse> {
    return this.client.post('/v1/licensing/activate', body);
  }

  async validate(body: { key: string; hwid: string }): Promise<ValidationResponse> {
    return this.client.post('/v1/licensing/validate', body);
  }

  async heartbeat(body: { key: string; hwid: string }): Promise<{ alive: boolean }> {
    return this.client.post('/v1/licensing/heartbeat', body);
  }

  async deactivate(body: { key: string; hwid: string }): Promise<void> {
    return this.client.post('/v1/licensing/deactivate', body);
  }

  /* ── Activations (Admin) ── */
  async listActivations(keyId?: string): Promise<LicenseActivation[]> {
    const query = keyId ? `?keyId=${keyId}` : '';
    return this.client.get(`/v1/licensing/activations${query}`);
  }

  async deleteActivation(id: string): Promise<void> {
    return this.client.delete(`/v1/licensing/activations/${id}`);
  }

  /* ── Variables ── */
  async createVariable(body: {
    appId: string;
    name: string;
    value: string;
    type?: string;
  }): Promise<LicenseVariable> {
    return this.client.post('/v1/licensing/variables', body);
  }

  async listVariables(appId?: string): Promise<LicenseVariable[]> {
    const query = appId ? `?appId=${appId}` : '';
    return this.client.get(`/v1/licensing/variables${query}`);
  }

  async updateVariable(
    id: string,
    body: { name?: string; value?: string; type?: string }
  ): Promise<LicenseVariable> {
    return this.client.patch(`/v1/licensing/variables/${id}`, body);
  }

  async deleteVariable(id: string): Promise<void> {
    return this.client.delete(`/v1/licensing/variables/${id}`);
  }

  /* ── Blacklist ── */
  async createBlacklistEntry(body: {
    appId?: string;
    type: 'ip' | 'hwid' | 'username' | 'email' | 'license_key';
    value: string;
    reason?: string;
    permanent?: boolean;
    expiresAt?: string;
  }): Promise<BlacklistEntry> {
    return this.client.post('/v1/licensing/blacklist', body);
  }

  async listBlacklistEntries(type?: string): Promise<BlacklistEntry[]> {
    const query = type ? `?type=${type}` : '';
    return this.client.get(`/v1/licensing/blacklist${query}`);
  }

  async deleteBlacklistEntry(id: string): Promise<void> {
    return this.client.delete(`/v1/licensing/blacklist/${id}`);
  }
}
