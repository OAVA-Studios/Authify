import { Hono } from 'hono';
import { eq, and, sql as drizzleSql } from 'drizzle-orm';
import { db, pool } from '@authify/db';
import { collections, collectionPolicies } from '@authify/db/schema';
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
} from '@authify/shared';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.js';
import { projectAuth } from '../middleware/project-auth.js';
import { validateJson, validateQuery } from '../middleware/index.js';
import { evaluateCondition, type RlsContext, type RlsCondition } from '../services/rls.js';
import { validateDocument, type CollectionSchema } from '../services/schema-validator.js';
import { logAudit } from '../services/audit.js';
import type { Variables } from '../types/context.js';
import type { PoolClient } from 'pg';

const database = new Hono<{ Variables: Variables }>();

function isAdmin(c: import('hono').Context): boolean {
  return c.get('role') === 'admin';
}

function sanitizeTableName(name: string): string {
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,62}$/.test(name)) {
    throw new BadRequestError(
      'Invalid table name. Must start with a letter and contain only letters, numbers, underscores (max 63 chars)'
    );
  }
  return `collection_${name}`;
}

function resolveTableName(c: import('hono').Context): string {
  return sanitizeTableName(c.req.param('name'));
}

async function ensureCollectionExists(projectId: string, tableName: string) {
  const rows = await db
    .select()
    .from(collections)
    .where(and(eq(collections.projectId, projectId), eq(collections.tableName, tableName)))
    .limit(1);
  if (rows.length === 0) throw new NotFoundError('Collection not found');
  return rows[0];
}

async function getPolicies(collectionId: string, operation: string) {
  return db
    .select()
    .from(collectionPolicies)
    .where(
      and(
        eq(collectionPolicies.collectionId, collectionId),
        eq(collectionPolicies.enabled, true),
        drizzleSql`(${collectionPolicies.operation} = ${operation} OR ${collectionPolicies.operation} = 'all')`
      )
    );
}

async function runQuery(client: PoolClient, query: string, params: unknown[]) {
  return client.query(query, params);
}

async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/* ───────────────────── Collections (Admin) ───────────────────── */

const createCollectionSchema = z.object({
  name: z.string().min(1).max(256),
  tableName: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  schema: z.record(
    z.object({
      type: z.enum(['string', 'text', 'integer', 'float', 'boolean', 'timestamp', 'uuid', 'json', 'array']),
      required: z.boolean().optional(),
      default: z.unknown().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      regex: z.string().optional(),
    })
  ),
  rlsEnabled: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});

database.post('/collections', requireAuth, validateJson(createCollectionSchema), async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const body = c.req.valid('json');

  // Check for duplicate table name
  const existing = await db
    .select()
    .from(collections)
    .where(and(eq(collections.projectId, projectId), eq(collections.tableName, body.tableName)))
    .limit(1);
  if (existing.length > 0) throw new ConflictError('Collection with this table name already exists');

  const table = sanitizeTableName(body.tableName);

  // Create dynamic table
  await withClient(async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${table} (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL,
        data jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz DEFAULT now() NOT NULL,
        updated_at timestamptz DEFAULT now() NOT NULL
      )
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_${table}_project ON ${table}(project_id)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_${table}_data ON ${table} USING GIN (data)`
    );
  });

  const [col] = await db
    .insert(collections)
    .values({
      projectId,
      name: body.name,
      tableName: body.tableName,
      schema: { fields: body.schema } as CollectionSchema,
      rlsEnabled: body.rlsEnabled,
      metadata: body.metadata ?? {},
    })
    .returning();

  await logAudit({
    projectId,
    userId: c.get('userId')!,
    action: 'collection.create',
    resourceType: 'collection',
    resourceId: col.id,
    ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? undefined,
    userAgent: c.req.header('user-agent') ?? undefined,
  });

  return c.json({ success: true, data: col }, 201);
});

database.get('/collections', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();

  const rows = await db
    .select()
    .from(collections)
    .where(eq(collections.projectId, projectId))
    .orderBy(collections.createdAt);

  return c.json({ success: true, data: rows });
});

database.get('/collections/:id', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  const id = c.req.param('id');

  const rows = await db
    .select()
    .from(collections)
    .where(and(eq(collections.id, id), eq(collections.projectId, projectId)))
    .limit(1);

  if (rows.length === 0) throw new NotFoundError('Collection not found');
  return c.json({ success: true, data: rows[0] });
});

const updateCollectionSchema = z.object({
  name: z.string().min(1).max(256).optional(),
  schema: z
    .record(
      z.object({
        type: z.enum(['string', 'text', 'integer', 'float', 'boolean', 'timestamp', 'uuid', 'json', 'array']),
        required: z.boolean().optional(),
        default: z.unknown().optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        regex: z.string().optional(),
      })
    )
    .optional(),
  rlsEnabled: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

database.patch('/collections/:id', requireAuth, validateJson(updateCollectionSchema), async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.schema !== undefined) updates.schema = { fields: body.schema } as CollectionSchema;
  if (body.rlsEnabled !== undefined) updates.rlsEnabled = body.rlsEnabled;
  if (body.metadata !== undefined) updates.metadata = body.metadata;
  updates.updatedAt = new Date();

  const rows = await db
    .update(collections)
    .set(updates)
    .where(and(eq(collections.id, id), eq(collections.projectId, projectId)))
    .returning();

  if (rows.length === 0) throw new NotFoundError('Collection not found');
  return c.json({ success: true, data: rows[0] });
});

database.delete('/collections/:id', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const id = c.req.param('id');

  const colRows = await db
    .select()
    .from(collections)
    .where(and(eq(collections.id, id), eq(collections.projectId, projectId)))
    .limit(1);

  if (colRows.length === 0) throw new NotFoundError('Collection not found');

  const table = sanitizeTableName(colRows[0].tableName);

  await withClient(async (client) => {
    await client.query(`DROP TABLE IF EXISTS ${table}`);
  });

  await db.delete(collections).where(eq(collections.id, id));
  await db.delete(collectionPolicies).where(eq(collectionPolicies.collectionId, id));

  return c.json({ success: true });
});

/* ───────────────────── Policies (Admin) ───────────────────── */

const createPolicySchema = z.object({
  name: z.string().min(1).max(256),
  operation: z.enum(['read', 'write', 'delete', 'all']),
  condition: z.record(z.unknown()),
  role: z.string().max(64).optional(),
  enabled: z.boolean().default(true),
});

database.post('/collections/:id/policies', requireAuth, validateJson(createPolicySchema), async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const collectionId = c.req.param('id');
  const body = c.req.valid('json');

  // Verify collection exists
  const colRows = await db
    .select()
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.projectId, projectId)))
    .limit(1);
  if (colRows.length === 0) throw new NotFoundError('Collection not found');

  const [policy] = await db
    .insert(collectionPolicies)
    .values({
      collectionId,
      projectId,
      name: body.name,
      operation: body.operation,
      condition: JSON.stringify(body.condition),
      role: body.role,
      enabled: body.enabled,
    })
    .returning();

  return c.json({ success: true, data: policy }, 201);
});

database.get('/collections/:id/policies', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const collectionId = c.req.param('id');

  const rows = await db
    .select()
    .from(collectionPolicies)
    .where(and(eq(collectionPolicies.collectionId, collectionId), eq(collectionPolicies.projectId, projectId)))
    .orderBy(collectionPolicies.createdAt);

  return c.json({ success: true, data: rows });
});

const updatePolicySchema = z.object({
  name: z.string().min(1).max(256).optional(),
  operation: z.enum(['read', 'write', 'delete', 'all']).optional(),
  condition: z.record(z.unknown()).optional(),
  role: z.string().max(64).optional().nullable(),
  enabled: z.boolean().optional(),
});

database.patch('/policies/:policyId', requireAuth, validateJson(updatePolicySchema), async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const policyId = c.req.param('policyId');
  const body = c.req.valid('json');

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.operation !== undefined) updates.operation = body.operation;
  if (body.condition !== undefined) updates.condition = JSON.stringify(body.condition);
  if (body.role !== undefined) updates.role = body.role;
  if (body.enabled !== undefined) updates.enabled = body.enabled;
  updates.updatedAt = new Date();

  const rows = await db
    .update(collectionPolicies)
    .set(updates)
    .where(and(eq(collectionPolicies.id, policyId), eq(collectionPolicies.projectId, projectId)))
    .returning();

  if (rows.length === 0) throw new NotFoundError('Policy not found');
  return c.json({ success: true, data: rows[0] });
});

database.delete('/policies/:policyId', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const policyId = c.req.param('policyId');

  await db
    .delete(collectionPolicies)
    .where(and(eq(collectionPolicies.id, policyId), eq(collectionPolicies.projectId, projectId)));

  return c.json({ success: true });
});

/* ───────────────────── Document Auto-REST ───────────────────── */

interface DocumentRow {
  id: string;
  project_id: string;
  data: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

async function applyRlsFilter(
  docs: DocumentRow[],
  policies: Array<{ condition: string; role: string | null }>,
  ctx: RlsContext,
  operation: string
): Promise<DocumentRow[]> {
  if (policies.length === 0) return docs;

  return docs.filter((doc) => {
    return policies.some((policy) => {
      if (policy.role && policy.role !== ctx.role) return false;
      try {
        const cond = JSON.parse(policy.condition) as RlsCondition;
        return evaluateCondition(cond, { ...doc.data, id: doc.id }, ctx);
      } catch {
        return false;
      }
    });
  });
}

const listDocumentsQuery = z.object({
  cursor: z.string().optional(),
  limit: z.string().default('50').transform(Number),
  orderBy: z.string().default('created_at').optional(),
  order: z.enum(['asc', 'desc']).default('desc').optional(),
  filter: z.string().optional(), // JSON string of simple filters
});

database.get(
  '/collections/:name/documents',
  projectAuth,
  validateQuery(listDocumentsQuery),
  async (c) => {
    const projectId = c.get('projectId')!;
    const table = resolveTableName(c);
    const q = c.req.valid('query');

    const collection = await ensureCollectionExists(projectId, c.req.param('name'));

    // Build query
    const limit = Math.min(Math.max(q.limit, 1), 100);
    const orderColumn = ['created_at', 'updated_at', 'id'].includes(q.orderBy ?? '')
      ? (q.orderBy as string)
      : 'created_at';
    const orderDir = q.order === 'asc' ? 'ASC' : 'DESC';

    let cursorCondition = '';
    const params: unknown[] = [projectId, limit + 1];
    let paramIndex = 3;

    if (q.cursor) {
      cursorCondition = `AND ${orderColumn} ${orderDir === 'ASC' ? '>' : '<'} $${paramIndex}`;
      params.push(q.cursor);
      paramIndex++;
    }

    // Simple JSONB filters from query string
    let filterCondition = '';
    if (q.filter) {
      try {
        const filters = JSON.parse(q.filter) as Record<string, unknown>;
        for (const [key, val] of Object.entries(filters)) {
          filterCondition += ` AND data->>$${paramIndex} = $${paramIndex + 1}`;
          params.push(key, String(val));
          paramIndex += 2;
        }
      } catch {
        throw new BadRequestError('Invalid filter JSON');
      }
    }

    const query = `
      SELECT id, project_id, data, created_at, updated_at
      FROM ${table}
      WHERE project_id = $1 ${cursorCondition} ${filterCondition}
      ORDER BY ${orderColumn} ${orderDir}
      LIMIT $2
    `;

    const result = await withClient((client) => client.query(query, params));
    const rows = result.rows as DocumentRow[];

    let filtered = rows;

    // Apply RLS if enabled
    if (collection.rlsEnabled) {
      const policies = await getPolicies(collection.id, 'read');
      const ctx: RlsContext = {
        userId: c.get('userId') ?? undefined,
        role: c.get('role') ?? undefined,
        projectId,
      };
      filtered = await applyRlsFilter(rows, policies, ctx, 'read');
    }

    const hasMore = rows.length > limit;
    const data = hasMore ? filtered.slice(0, limit) : filtered;
    const nextCursor = hasMore && data.length > 0
      ? String((data[data.length - 1] as DocumentRow)[orderColumn as keyof DocumentRow])
      : undefined;

    return c.json({
      success: true,
      data: data.map((r) => ({
        id: r.id,
        ...r.data,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      meta: {
        limit,
        nextCursor,
        hasMore,
      },
    });
  }
);

const createDocumentSchema = z.object({
  id: z.string().uuid().optional(),
  data: z.record(z.unknown()),
});

database.post(
  '/collections/:name/documents',
  projectAuth,
  validateJson(createDocumentSchema),
  async (c) => {
    const projectId = c.get('projectId')!;
    const table = resolveTableName(c);
    const body = c.req.valid('json');

    const collection = await ensureCollectionExists(projectId, c.req.param('name'));

    // Validate against schema
    const schema = collection.schema as CollectionSchema;
    const validated = validateDocument(body.data, schema);

    // Apply RLS for write
    if (collection.rlsEnabled) {
      const policies = await getPolicies(collection.id, 'write');
      const ctx: RlsContext = {
        userId: c.get('userId') ?? undefined,
        role: c.get('role') ?? undefined,
        projectId,
      };
      const allowed = policies.some((p) => {
        if (p.role && p.role !== ctx.role) return false;
        try {
          const cond = JSON.parse(p.condition) as RlsCondition;
          return evaluateCondition(cond, { ...validated, id: body.id }, ctx);
        } catch {
          return false;
        }
      });
      if (!allowed && policies.length > 0) {
        throw new ForbiddenError('RLS policy denied this write');
      }
    }

    const docId = body.id ?? uuidv4();

    const result = await withClient((client) =>
      client.query(
        `INSERT INTO ${table} (id, project_id, data, created_at, updated_at)
         VALUES ($1, $2, $3, now(), now())
         RETURNING id, project_id, data, created_at, updated_at`,
        [docId, projectId, JSON.stringify(validated)]
      )
    );

    const row = result.rows[0] as DocumentRow;
    return c.json(
      {
        success: true,
        data: { id: row.id, ...row.data, createdAt: row.created_at, updatedAt: row.updated_at },
      },
      201
    );
  }
);

database.get('/collections/:name/documents/:docId', projectAuth, async (c) => {
  const projectId = c.get('projectId')!;
  const table = resolveTableName(c);
  const docId = c.req.param('docId');

  const collection = await ensureCollectionExists(projectId, c.req.param('name'));

  const result = await withClient((client) =>
    client.query(
      `SELECT id, project_id, data, created_at, updated_at
       FROM ${table}
       WHERE id = $1 AND project_id = $2`,
      [docId, projectId]
    )
  );

  if (result.rows.length === 0) throw new NotFoundError('Document not found');
  const row = result.rows[0] as DocumentRow;

  // Apply RLS read
  if (collection.rlsEnabled) {
    const policies = await getPolicies(collection.id, 'read');
    const ctx: RlsContext = {
      userId: c.get('userId') ?? undefined,
      role: c.get('role') ?? undefined,
      projectId,
    };
    const allowed = policies.some((p) => {
      if (p.role && p.role !== ctx.role) return false;
      try {
        const cond = JSON.parse(p.condition) as RlsCondition;
        return evaluateCondition(cond, { ...row.data, id: row.id }, ctx);
      } catch {
        return false;
      }
    });
    if (!allowed && policies.length > 0) {
      throw new NotFoundError('Document not found');
    }
  }

  return c.json({
    success: true,
    data: { id: row.id, ...row.data, createdAt: row.created_at, updatedAt: row.updated_at },
  });
});

const updateDocumentSchema = z.object({
  data: z.record(z.unknown()),
});

database.patch(
  '/collections/:name/documents/:docId',
  projectAuth,
  validateJson(updateDocumentSchema),
  async (c) => {
    const projectId = c.get('projectId')!;
    const table = resolveTableName(c);
    const docId = c.req.param('docId');
    const body = c.req.valid('json');

    const collection = await ensureCollectionExists(projectId, c.req.param('name'));

    // Fetch existing
    const existingResult = await withClient((client) =>
      client.query(
        `SELECT id, project_id, data, created_at, updated_at
         FROM ${table}
         WHERE id = $1 AND project_id = $2`,
        [docId, projectId]
      )
    );

    if (existingResult.rows.length === 0) throw new NotFoundError('Document not found');
    const existing = existingResult.rows[0] as DocumentRow;

    // Validate merged data against schema
    const schema = collection.schema as CollectionSchema;
    const merged = { ...existing.data, ...body.data };
    const validated = validateDocument(merged, schema);

    // Apply RLS for write
    if (collection.rlsEnabled) {
      const policies = await getPolicies(collection.id, 'write');
      const ctx: RlsContext = {
        userId: c.get('userId') ?? undefined,
        role: c.get('role') ?? undefined,
        projectId,
      };
      const allowed = policies.some((p) => {
        if (p.role && p.role !== ctx.role) return false;
        try {
          const cond = JSON.parse(p.condition) as RlsCondition;
          return evaluateCondition(cond, { ...validated, id: docId }, ctx);
        } catch {
          return false;
        }
      });
      if (!allowed && policies.length > 0) {
        throw new ForbiddenError('RLS policy denied this update');
      }
    }

    const result = await withClient((client) =>
      client.query(
        `UPDATE ${table}
         SET data = $1, updated_at = now()
         WHERE id = $2 AND project_id = $3
         RETURNING id, project_id, data, created_at, updated_at`,
        [JSON.stringify(validated), docId, projectId]
      )
    );

    const row = result.rows[0] as DocumentRow;
    return c.json({
      success: true,
      data: { id: row.id, ...row.data, createdAt: row.created_at, updatedAt: row.updated_at },
    });
  }
);

database.delete('/collections/:name/documents/:docId', projectAuth, async (c) => {
  const projectId = c.get('projectId')!;
  const table = resolveTableName(c);
  const docId = c.req.param('docId');

  const collection = await ensureCollectionExists(projectId, c.req.param('name'));

  // Fetch for RLS check
  const existingResult = await withClient((client) =>
    client.query(
      `SELECT id, project_id, data, created_at, updated_at
       FROM ${table}
       WHERE id = $1 AND project_id = $2`,
      [docId, projectId]
    )
  );

  if (existingResult.rows.length === 0) throw new NotFoundError('Document not found');
  const existing = existingResult.rows[0] as DocumentRow;

  // Apply RLS for delete
  if (collection.rlsEnabled) {
    const policies = await getPolicies(collection.id, 'delete');
    const ctx: RlsContext = {
      userId: c.get('userId') ?? undefined,
      role: c.get('role') ?? undefined,
      projectId,
    };
    const allowed = policies.some((p) => {
      if (p.role && p.role !== ctx.role) return false;
      try {
        const cond = JSON.parse(p.condition) as RlsCondition;
        return evaluateCondition(cond, { ...existing.data, id: docId }, ctx);
      } catch {
        return false;
      }
    });
    if (!allowed && policies.length > 0) {
      throw new ForbiddenError('RLS policy denied this delete');
    }
  }

  await withClient((client) =>
    client.query(`DELETE FROM ${table} WHERE id = $1 AND project_id = $2`, [docId, projectId])
  );

  return c.json({ success: true });
});

export default database;
