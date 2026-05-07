import { pgTable, uuid, varchar, timestamp, jsonb, text, boolean, integer, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const webhooks = pgTable(
  'webhooks',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    projectId: uuid('project_id').notNull(),
    name: varchar('name', { length: 256 }).notNull(),
    url: text('url').notNull(),
    secret: varchar('secret', { length: 512 }),
    events: jsonb('events').default(sql`'[]'::jsonb`).notNull(),
    active: boolean('active').default(true).notNull(),
    retries: integer('retries').default(3).notNull(),
    metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('webhooks_project_id_idx').on(table.projectId),
    activeIdx: index('webhooks_active_idx').on(table.active),
  })
);

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    webhookId: uuid('webhook_id').notNull(),
    projectId: uuid('project_id').notNull(),
    event: varchar('event', { length: 128 }).notNull(),
    payload: jsonb('payload').default(sql`'{}'::jsonb`),
    statusCode: integer('status_code'),
    responseBody: text('response_body'),
    success: boolean('success').default(false).notNull(),
    attempt: integer('attempt').default(1).notNull(),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    webhookIdIdx: index('webhook_deliveries_webhook_id_idx').on(table.webhookId),
    eventIdx: index('webhook_deliveries_event_idx').on(table.event),
    successIdx: index('webhook_deliveries_success_idx').on(table.success),
    createdAtIdx: index('webhook_deliveries_created_at_idx').on(table.createdAt),
  })
);

export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
