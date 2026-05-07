export { AuthifyClient, AuthifyError } from './client.js';
export type { AuthifyConfig } from './types.js';

export { AuthifyAuth } from './auth.js';
export { AuthifyDatabase } from './database.js';
export { AuthifyFunctions } from './functions.js';
export { AuthifyLicensing } from './licensing.js';
export { AuthifyMessaging } from './messaging.js';
export { AuthifyRealtime } from './realtime.js';
export { AuthifyStorage } from './storage.js';
export { AuthifyWebhooks } from './webhooks.js';

export type {
  ApiResponse,
  PaginatedResponse,
  RealtimeMessage,
  RealtimePresence,
  User,
  Session,
  AuthResponse,
  TokenPair,
  LicenseApp,
  LicenseKey,
  LicenseActivation,
  LicenseVariable,
  BlacklistEntry,
  ActivationResponse,
  ValidationResponse,
  Collection,
  CollectionPolicy,
  Document,
  DocumentListMeta,
  StorageBucket,
  StorageFile,
  UploadInitResponse,
  ServerlessFunction,
  FunctionExecution,
  InvokeResponse,
  MessagingProvider,
  MessageTemplate,
  Message,
  SendMessageResponse,
  Webhook,
  WebhookDelivery,
  WebhookTriggerResult,
  RealtimeChannelInfo,
  RealtimeChannelDetail,
  RealtimeStats,
} from './types.js';
