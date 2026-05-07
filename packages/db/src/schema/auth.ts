import { pgTable, uuid, varchar, boolean, timestamp, jsonb, text, index, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    projectId: uuid('project_id').notNull(),
    email: varchar('email', { length: 320 }).notNull(),
    passwordHash: varchar('password_hash', { length: 256 }),
    emailVerified: boolean('email_verified').default(false).notNull(),
    banned: boolean('banned').default(false).notNull(),
    role: varchar('role', { length: 32 }).default('user').notNull(),
    metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
    preferences: jsonb('preferences').default(sql`'{}'::jsonb`),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    lastLoginIp: varchar('last_login_ip', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectEmailIdx: index('users_project_email_idx').on(table.projectId, table.email),
    projectIdIdx: index('users_project_id_idx').on(table.projectId),
    emailIdx: index('users_email_idx').on(table.email),
    roleIdx: index('users_role_idx').on(table.role),
    bannedIdx: index('users_banned_idx').on(table.banned),
  })
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id').notNull(),
    projectId: uuid('project_id').notNull(),
    token: varchar('token', { length: 512 }).notNull().unique(),
    refreshToken: varchar('refresh_token', { length: 512 }).unique(),
    deviceInfo: jsonb('device_info').default(sql`'{}'::jsonb`),
    ipAddress: varchar('ip_address', { length: 64 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('sessions_user_id_idx').on(table.userId),
    tokenIdx: index('sessions_token_idx').on(table.token),
    refreshTokenIdx: index('sessions_refresh_token_idx').on(table.refreshToken),
    expiresAtIdx: index('sessions_expires_at_idx').on(table.expiresAt),
  })
);

export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id').notNull(),
    projectId: uuid('project_id').notNull(),
    provider: varchar('provider', { length: 64 }).notNull(),
    providerAccountId: varchar('provider_account_id', { length: 512 }).notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    tokenType: varchar('token_type', { length: 32 }),
    scope: text('scope'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    providerAccountIdx: index('oauth_provider_account_idx').on(table.projectId, table.provider, table.providerAccountId),
    userIdIdx: index('oauth_user_id_idx').on(table.userId),
  })
);

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id').notNull(),
    projectId: uuid('project_id').notNull(),
    token: varchar('token', { length: 512 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    used: boolean('used').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tokenIdx: index('pw_reset_token_idx').on(table.token),
    userIdIdx: index('pw_reset_user_id_idx').on(table.userId),
  })
);

export const emailVerificationTokens = pgTable(
  'email_verification_tokens',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id').notNull(),
    projectId: uuid('project_id').notNull(),
    token: varchar('token', { length: 512 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tokenIdx: index('email_verif_token_idx').on(table.token),
  })
);

export const twoFactorAuth = pgTable(
  'two_factor_auth',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id').notNull().unique(),
    projectId: uuid('project_id').notNull(),
    secret: varchar('secret', { length: 512 }).notNull(),
    backupCodes: jsonb('backup_codes').default(sql`'[]'::jsonb`).notNull(),
    enabled: boolean('enabled').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('tfa_user_id_idx').on(table.userId),
  })
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    projectId: uuid('project_id').notNull(),
    userId: uuid('user_id'),
    actorType: varchar('actor_type', { length: 32 }).default('user').notNull(),
    action: varchar('action', { length: 128 }).notNull(),
    resourceType: varchar('resource_type', { length: 128 }).notNull(),
    resourceId: varchar('resource_id', { length: 256 }),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('audit_project_id_idx').on(table.projectId),
    userIdIdx: index('audit_user_id_idx').on(table.userId),
    actionIdx: index('audit_action_idx').on(table.action),
    createdAtIdx: index('audit_created_at_idx').on(table.createdAt),
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type OauthAccount = typeof oauthAccounts.$inferSelect;
export type NewOauthAccount = typeof oauthAccounts.$inferInsert;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type NewEmailVerificationToken = typeof emailVerificationTokens.$inferInsert;
export type TwoFactorAuth = typeof twoFactorAuth.$inferSelect;
export type NewTwoFactorAuth = typeof twoFactorAuth.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
