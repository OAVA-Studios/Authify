import { pgTable, uuid, varchar, timestamp, jsonb, text, boolean, integer, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const messagingProviders = pgTable(
  'messaging_providers',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    projectId: uuid('project_id').notNull(),
    name: varchar('name', { length: 256 }).notNull(),
    type: varchar('type', { length: 32 }).notNull(), // smtp, resend, mailgun, sendgrid, twilio, vonage, fcm
    config: jsonb('config').default(sql`'{}'::jsonb`).notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    active: boolean('active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('messaging_providers_project_id_idx').on(table.projectId),
    typeIdx: index('messaging_providers_type_idx').on(table.type),
  })
);

export const messageTemplates = pgTable(
  'message_templates',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    projectId: uuid('project_id').notNull(),
    name: varchar('name', { length: 256 }).notNull(),
    type: varchar('type', { length: 32 }).notNull(), // email, sms, push
    subject: varchar('subject', { length: 512 }),
    body: text('body').notNull(),
    htmlBody: text('html_body'),
    variables: jsonb('variables').default(sql`'[]'::jsonb`),
    metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('templates_project_id_idx').on(table.projectId),
    nameIdx: index('templates_name_idx').on(table.name),
  })
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    projectId: uuid('project_id').notNull(),
    providerId: uuid('provider_id').notNull(),
    templateId: uuid('template_id'),
    type: varchar('type', { length: 32 }).notNull(),
    to: varchar('to', { length: 512 }).notNull(),
    subject: varchar('subject', { length: 512 }),
    body: text('body'),
    status: varchar('status', { length: 32 }).default('pending').notNull(),
    retries: integer('retries').default(0).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('messages_project_id_idx').on(table.projectId),
    statusIdx: index('messages_status_idx').on(table.status),
    createdAtIdx: index('messages_created_at_idx').on(table.createdAt),
  })
);

export type MessagingProvider = typeof messagingProviders.$inferSelect;
export type NewMessagingProvider = typeof messagingProviders.$inferInsert;
export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type NewMessageTemplate = typeof messageTemplates.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
