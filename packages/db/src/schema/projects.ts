import { pgTable, uuid, varchar, timestamp, jsonb, text } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 256 }).notNull(),
  slug: varchar('slug', { length: 256 }).notNull().unique(),
  description: text('description'),
  apiKeyHash: varchar('api_key_hash', { length: 512 }),
  apiKeySalt: varchar('api_key_salt', { length: 256 }),
  ownerId: uuid('owner_id').notNull(),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  corsOrigins: jsonb('cors_origins').default(sql`'["*"]'::jsonb`),
  rateLimitConfig: jsonb('rate_limit_config').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
