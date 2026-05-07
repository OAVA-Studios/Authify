import type { AuthifyClient } from './client.js';
import type { AuthResponse, User, Session, TokenPair } from './types.js';

export class AuthifyAuth {
  constructor(private client: AuthifyClient) {}

  async register(body: { email: string; password: string; metadata?: Record<string, unknown> }): Promise<{ id: string; email: string; createdAt: string }> {
    return this.client.post('/v1/auth/register', body);
  }

  async login(body: { email: string; password: string; twoFactorCode?: string }): Promise<AuthResponse> {
    return this.client.post('/v1/auth/login', body);
  }

  async logout(): Promise<void> {
    return this.client.post('/v1/auth/logout');
  }

  async refresh(body: { refreshToken: string }): Promise<TokenPair> {
    return this.client.post('/v1/auth/refresh', body);
  }

  async me(): Promise<User> {
    return this.client.get('/v1/auth/me');
  }

  async updateMe(body: {
    email?: string;
    metadata?: Record<string, unknown>;
    preferences?: Record<string, unknown>;
    currentPassword?: string;
    newPassword?: string;
  }): Promise<{ id: string; email: string; updatedAt: string }> {
    return this.client.patch('/v1/auth/me', body);
  }

  async passwordResetRequest(body: { email: string }): Promise<{ message: string }> {
    return this.client.post('/v1/auth/password-reset-request', body);
  }

  async passwordReset(body: { token: string; newPassword: string }): Promise<{ message: string }> {
    return this.client.post('/v1/auth/password-reset', body);
  }

  async verifyEmailRequest(): Promise<{ message: string }> {
    return this.client.post('/v1/auth/verify-email-request');
  }

  async verifyEmail(body: { token: string }): Promise<{ message: string }> {
    return this.client.post('/v1/auth/verify-email', body);
  }

  async enable2FA(): Promise<{ secret: string; otpauth: string; backupCodes: string[] }> {
    return this.client.post('/v1/auth/2fa/enable');
  }

  async verify2FA(body: { code: string }): Promise<{ enabled: boolean }> {
    return this.client.post('/v1/auth/2fa/verify', body);
  }

  async disable2FA(body: { code: string }): Promise<void> {
    return this.client.post('/v1/auth/2fa/disable', body);
  }

  async sessions(): Promise<Session[]> {
    return this.client.get('/v1/auth/sessions');
  }

  async deleteSession(id: string): Promise<void> {
    return this.client.delete(`/v1/auth/sessions/${id}`);
  }

  async deleteOtherSessions(): Promise<void> {
    return this.client.delete('/v1/auth/sessions');
  }
}
