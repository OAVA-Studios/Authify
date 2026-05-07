import { pgTable, uuid, varchar, timestamp, jsonb, text, boolean, integer, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const serverlessFunctions = pgTable(
  'serverless_functions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    projectId: uuid('project_id').notNull(),
    name: varchar('name', { length: 256 }).notNull(),
    slug: varchar('slug', { length: 256 }).notNull(),
    entrypoint: varchar('entrypoint', { length: 512 }).default('index.js').notNull(),
    runtime: varchar('runtime', { length: 64 }).default('node22').notNull(),
    sourceCode: text('source_code'),
    sourcePath: varchar('source_path', { length: 512 }),
    envVars: jsonb('env_vars').default(sql`'{}'::jsonb`),
    triggerType: varchar('trigger_type', { length: 64 }).default('http').notNull(),
    triggerConfig: jsonb('trigger_config').default(sql`'{}'::jsonb`),
    timeout: integer('timeout').default(30000).notNull(),
    memory: integer('memory').default(256).notNull(),
    active: boolean('active').default(true).notNull(),
    metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('functions_project_id_idx').on(table.projectId),
    slugIdx: index('functions_slug_idx').on(table.slug),
  })
);

export const functionExecutions = pgTable(
  'function_executions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    functionId: uuid('function_id').notNull(),
    projectId: uuid('project_id').notNull(),
    status: varchar('status', { length: 32 }).default('pending').notNull(),
    request: jsonb('request').default(sql`'{}'::jsonb`),
    response: jsonb('response').default(sql`'{}'::jsonb`),
    logs: text('logs'),
    durationMs: integer('duration_ms'),
    memoryUsedMb: integer('memory_used_mb'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    functionIdIdx: index('executions_function_id_idx').on(table.functionId),
    statusIdx: index('executions_status_idx').on(table.status),
    createdAtIdx: index('executions_created_at_idx').on(table.createdAt),
  })
);

export type ServerlessFunction = typeof serverlessFunctions.$inferSelect;
export type NewServerlessFunction = typeof serverlessFunctions.$inferInsert;
export type FunctionExecution = typeof functionExecutions.$inferSelect;
export type NewFunctionExecution = typeof functionExecutions.$inferInsert;
