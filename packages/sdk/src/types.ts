export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
  error?: { code: string; message: string; details?: Record<string, unknown> };
  requestId?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    nextCursor?: string;
    hasMore?: boolean;
  };
}

export interface AuthifyConfig {
  baseUrl: string;
  projectId: string;
  apiKey?: string;
  token?: string;
  refreshToken?: string;
}

export interface RealtimeMessage {
  type: 'subscribe' | 'unsubscribe' | 'broadcast' | 'presence' | 'message' | 'error' | 'system';
  channel?: string;
  payload?: Record<string, unknown>;
  event?: string;
  data?: unknown;
  error?: string;
  timestamp?: string;
  clientId?: string;
}

export interface RealtimePresence {
  clientId: string;
  userId?: string;
  joinedAt: string;
  metadata?: Record<string, unknown>;
}

/* ─────────── Auth ─────────── */
export interface User {
  id: string;
  email: string;
  role: string;
  emailVerified: boolean;
  banned?: boolean;
  metadata?: Record<string, unknown>;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Session {
  id: string;
  ipAddress?: string;
  deviceInfo?: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/* ─────────── Licensing ─────────── */
export interface LicenseApp {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  version: string;
  hwidLocking: boolean;
  maxDevices: number;
  webhookUrl?: string;
  antiDebug: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface LicenseKey {
  id: string;
  appId: string;
  projectId: string;
  key: string;
  userId?: string;
  tier: string;
  maxActivations: number;
  currentActivations: number;
  status: 'pending' | 'active' | 'expired' | 'revoked' | 'banned';
  expiresAt?: string;
  note?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface LicenseActivation {
  id: string;
  keyId: string;
  projectId: string;
  hwid: string;
  deviceName: string;
  ipAddress?: string;
  active: boolean;
  activatedAt: string;
  lastSeenAt?: string;
}

export interface LicenseVariable {
  id: string;
  appId: string;
  projectId: string;
  name: string;
  value: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

export interface BlacklistEntry {
  id: string;
  projectId: string;
  appId?: string;
  type: 'ip' | 'hwid' | 'username' | 'email' | 'license_key';
  value: string;
  reason?: string;
  permanent: boolean;
  expiresAt?: string;
  createdAt: string;
}

export interface ActivationResponse {
  key: string;
  tier: string;
  expiresAt?: string;
  maxActivations: number;
  currentActivations: number;
  hwidLocked: boolean;
  variables: Record<string, string>;
}

export interface ValidationResponse {
  valid: boolean;
  key: string;
  tier: string;
  expiresAt?: string;
  maxActivations: number;
  currentActivations: number;
}

/* ─────────── Database ─────────── */
export interface Collection {
  id: string;
  projectId: string;
  name: string;
  tableName: string;
  schema: Record<string, unknown>;
  rlsEnabled: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionPolicy {
  id: string;
  collectionId: string;
  projectId: string;
  name: string;
  operation: 'read' | 'write' | 'delete' | 'all';
  condition: string;
  role?: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  [key: string]: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentListMeta {
  limit: number;
  nextCursor?: string;
  hasMore?: boolean;
}

/* ─────────── Storage ─────────── */
export interface StorageBucket {
  id: string;
  projectId: string;
  name: string;
  public: boolean;
  maxFileSize: number;
  allowedMimeTypes: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface StorageFile {
  id: string;
  bucketId: string;
  projectId: string;
  name: string;
  path: string;
  mimeType: string;
  size: number;
  etag?: string;
  metadata?: Record<string, unknown>;
  url?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadInitResponse {
  uploadId: string;
  expiresAt: string;
}

/* ─────────── Functions ─────────── */
export interface ServerlessFunction {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  entrypoint: string;
  runtime: 'node22' | 'node20' | 'bun';
  sourceCode: string;
  sourcePath?: string | null;
  envVars: Record<string, string>;
  triggerType: 'http' | 'schedule' | 'event' | 'webhook';
  triggerConfig: Record<string, unknown>;
  timeout: number;
  memory: number;
  active: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FunctionExecution {
  id: string;
  functionId: string;
  projectId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
  logs?: string;
  durationMs?: number;
  memoryUsedMb?: number;
  errorMessage?: string;
  completedAt?: string;
  createdAt: string;
}

export interface InvokeResponse {
  data: unknown;
  meta?: { logs: string[]; durationMs: number };
}

/* ─────────── Messaging ─────────── */
export interface MessagingProvider {
  id: string;
  projectId: string;
  name: string;
  type: 'smtp' | 'resend' | 'mailgun' | 'sendgrid' | 'twilio' | 'vonage' | 'fcm';
  config: Record<string, unknown>;
  isDefault: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MessageTemplate {
  id: string;
  projectId: string;
  name: string;
  type: 'email' | 'sms' | 'push';
  subject?: string | null;
  body: string;
  htmlBody?: string | null;
  variables: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  projectId: string;
  providerId: string;
  templateId?: string;
  type: 'email' | 'sms' | 'push';
  to: string;
  subject?: string | null;
  body: string;
  status: 'pending' | 'sent' | 'failed' | 'delivered';
  sentAt?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SendMessageResponse {
  messageId: string;
  status: 'sent' | 'failed';
  providerMessageId?: string;
  error?: string;
}

/* ─────────── Webhooks ─────────── */
export interface Webhook {
  id: string;
  projectId: string;
  name: string;
  url: string;
  secret?: string;
  events: string[];
  active: boolean;
  retries: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  projectId: string;
  event: string;
  payload?: Record<string, unknown>;
  statusCode?: number;
  responseBody?: string;
  success: boolean;
  attempt: number;
  deliveredAt?: string;
  createdAt: string;
}

export interface WebhookTriggerResult {
  delivered: number;
  failed: number;
  results: Array<{ webhookId: string; success: boolean; error?: string }>;
}

/* ─────────── Realtime ─────────── */
export interface RealtimeChannelInfo {
  name: string;
  subscriberCount: number;
  presence: RealtimePresence[];
}

export interface RealtimeChannelDetail extends RealtimeChannelInfo {
  subscribers: Array<{
    clientId: string;
    userId?: string;
    projectId?: string;
    connectedAt: string;
    channels: string[];
  }>;
}

export interface RealtimeStats {
  totalConnections: number;
  totalChannels: number;
}
