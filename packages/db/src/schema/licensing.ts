import { pgTable, uuid, varchar, timestamp, jsonb, text, boolean, integer, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const licenseApps = pgTable(
  'license_apps',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    projectId: uuid('project_id').notNull(),
    name: varchar('name', { length: 256 }).notNull(),
    description: text('description'),
    version: varchar('version', { length: 64 }).default('1.0.0').notNull(),
    hwidLocking: boolean('hwid_locking').default(true).notNull(),
    maxDevices: integer('max_devices').default(1).notNull(),
    webhookUrl: text('webhook_url'),
    antiDebug: boolean('anti_debug').default(false).notNull(),
    encryptionKey: varchar('encryption_key', { length: 512 }),
    metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('license_apps_project_id_idx').on(table.projectId),
    nameIdx: index('license_apps_name_idx').on(table.name),
  })
);

export const licenseKeys = pgTable(
  'license_keys',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    appId: uuid('app_id').notNull(),
    projectId: uuid('project_id').notNull(),
    key: varchar('key', { length: 128 }).notNull().unique(),
    userId: uuid('user_id'),
    tier: varchar('tier', { length: 64 }).default('basic').notNull(),
    maxActivations: integer('max_activations').default(1).notNull(),
    currentActivations: integer('current_activations').default(0).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    status: varchar('status', { length: 32 }).default('pending').notNull(),
    metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    appIdIdx: index('license_keys_app_id_idx').on(table.appId),
    keyIdx: index('license_keys_key_idx').on(table.key),
    projectIdIdx: index('license_keys_project_id_idx').on(table.projectId),
    statusIdx: index('license_keys_status_idx').on(table.status),
    userIdIdx: index('license_keys_user_id_idx').on(table.userId),
  })
);

export const licenseActivations = pgTable(
  'license_activations',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    keyId: uuid('key_id').notNull(),
    projectId: uuid('project_id').notNull(),
    hwid: varchar('hwid', { length: 512 }).notNull(),
    ipAddress: varchar('ip_address', { length: 64 }),
    deviceName: varchar('device_name', { length: 256 }),
    activatedAt: timestamp('activated_at', { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
    active: boolean('active').default(true).notNull(),
  },
  (table) => ({
    keyIdIdx: index('license_activations_key_id_idx').on(table.keyId),
    hwidIdx: index('license_activations_hwid_idx').on(table.hwid),
    activeIdx: index('license_activations_active_idx').on(table.active),
  })
);

export const licenseVariables = pgTable(
  'license_variables',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    appId: uuid('app_id').notNull(),
    projectId: uuid('project_id').notNull(),
    name: varchar('name', { length: 256 }).notNull(),
    value: text('value').notNull(),
    type: varchar('type', { length: 64 }).default('string').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    appNameIdx: index('license_variables_app_name_idx').on(table.appId, table.name),
  })
);

export const blacklist = pgTable(
  'blacklist',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    projectId: uuid('project_id').notNull(),
    appId: uuid('app_id'),
    type: varchar('type', { length: 32 }).notNull(),
    value: varchar('value', { length: 512 }).notNull(),
    reason: text('reason'),
    permanent: boolean('permanent').default(true).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectTypeValueIdx: index('blacklist_project_type_value_idx').on(table.projectId, table.type, table.value),
    appIdIdx: index('blacklist_app_id_idx').on(table.appId),
  })
);

export const licenseWebhookLogs = pgTable(
  'license_webhook_logs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    appId: uuid('app_id').notNull(),
    projectId: uuid('project_id').notNull(),
    event: varchar('event', { length: 128 }).notNull(),
    payload: jsonb('payload').default(sql`'{}'::jsonb`),
    sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
    success: boolean('success').default(false).notNull(),
    statusCode: integer('status_code'),
    responseBody: text('response_body'),
  },
  (table) => ({
    appIdIdx: index('license_webhook_logs_app_id_idx').on(table.appId),
    eventIdx: index('license_webhook_logs_event_idx').on(table.event),
    sentAtIdx: index('license_webhook_logs_sent_at_idx').on(table.sentAt),
  })
);

export type LicenseApp = typeof licenseApps.$inferSelect;
export type NewLicenseApp = typeof licenseApps.$inferInsert;
export type LicenseKey = typeof licenseKeys.$inferSelect;
export type NewLicenseKey = typeof licenseKeys.$inferInsert;
export type LicenseActivation = typeof licenseActivations.$inferSelect;
export type NewLicenseActivation = typeof licenseActivations.$inferInsert;
export type LicenseVariable = typeof licenseVariables.$inferSelect;
export type NewLicenseVariable = typeof licenseVariables.$inferInsert;
export type BlacklistEntry = typeof blacklist.$inferSelect;
export type NewBlacklistEntry = typeof blacklist.$inferInsert;
export type LicenseWebhookLog = typeof licenseWebhookLogs.$inferSelect;
export type NewLicenseWebhookLog = typeof licenseWebhookLogs.$inferInsert;
