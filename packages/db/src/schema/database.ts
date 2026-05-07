import { pgTable, uuid, varchar, timestamp, jsonb, text, boolean, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const collections = pgTable(
  'collections',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    projectId: uuid('project_id').notNull(),
    name: varchar('name', { length: 256 }).notNull(),
    tableName: varchar('table_name', { length: 256 }).notNull().unique(),
    schema: jsonb('schema').default(sql`'{}'::jsonb`).notNull(),
    rlsEnabled: boolean('rls_enabled').default(true).notNull(),
    metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('collections_project_id_idx').on(table.projectId),
    nameIdx: index('collections_name_idx').on(table.name),
  })
);

export const collectionPolicies = pgTable(
  'collection_policies',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    collectionId: uuid('collection_id').notNull(),
    projectId: uuid('project_id').notNull(),
    name: varchar('name', { length: 256 }).notNull(),
    operation: varchar('operation', { length: 32 }).notNull(), // read, write, delete, all
    condition: text('condition').notNull(), // JSON/DSL condition
    role: varchar('role', { length: 64 }),
    enabled: boolean('enabled').default(true).notNull(),
    metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    collectionIdIdx: index('policies_collection_id_idx').on(table.collectionId),
    operationIdx: index('policies_operation_idx').on(table.operation),
  })
);

export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;
export type CollectionPolicy = typeof collectionPolicies.$inferSelect;
export type NewCollectionPolicy = typeof collectionPolicies.$inferInsert;
