import { pgTable, uuid, varchar, timestamp, jsonb, bigint, boolean, text, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const storageBuckets = pgTable(
  'storage_buckets',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    projectId: uuid('project_id').notNull(),
    name: varchar('name', { length: 256 }).notNull(),
    public: boolean('public').default(false).notNull(),
    maxFileSize: bigint('max_file_size', { mode: 'number' }).default(1073741824), // 1GB
    allowedMimeTypes: jsonb('allowed_mime_types').default(sql`'[]'::jsonb`),
    metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('buckets_project_id_idx').on(table.projectId),
    nameIdx: index('buckets_name_idx').on(table.name),
  })
);

export const storageFiles = pgTable(
  'storage_files',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    bucketId: uuid('bucket_id').notNull(),
    projectId: uuid('project_id').notNull(),
    name: varchar('name', { length: 512 }).notNull(),
    path: text('path').notNull(),
    mimeType: varchar('mime_type', { length: 256 }).notNull(),
    size: bigint('size', { mode: 'number' }).default(0).notNull(),
    metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
    etag: varchar('etag', { length: 256 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    bucketIdIdx: index('files_bucket_id_idx').on(table.bucketId),
    pathIdx: index('files_path_idx').on(table.path),
    projectIdIdx: index('files_project_id_idx').on(table.projectId),
  })
);

export type StorageBucket = typeof storageBuckets.$inferSelect;
export type NewStorageBucket = typeof storageBuckets.$inferInsert;
export type StorageFile = typeof storageFiles.$inferSelect;
export type NewStorageFile = typeof storageFiles.$inferInsert;
