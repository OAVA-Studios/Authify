import { Hono } from 'hono';
import { eq, and, count } from 'drizzle-orm';
import { db } from '@authify/db';
import { serverlessFunctions, functionExecutions } from '@authify/db/schema';
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from '@authify/shared';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateJson, validateQuery } from '../middleware/index.js';
import { runFunction, type FunctionInput } from '../services/function-runner.js';
import { enqueueFunctionExecution } from '../services/queue.js';
import { logAudit } from '../services/audit.js';
import { rateLimit } from '../middleware/rate-limit.js';
import type { Variables } from '../types/context.js';

const functions = new Hono<{ Variables: Variables }>();

function isAdmin(c: import('hono').Context): boolean {
  return c.get('role') === 'admin';
}

/* ───────────────────── CRUD ───────────────────── */

const createFunctionSchema = z.object({
  name: z.string().min(1).max(256),
  slug: z.string().min(1).max(256),
  entrypoint: z.string().max(512).default('index.js'),
  runtime: z.enum(['node22', 'node20', 'bun']).default('node22'),
  sourceCode: z.string().min(1),
  sourcePath: z.string().max(512).optional(),
  envVars: z.record(z.string()).default({}),
  triggerType: z.enum(['http', 'schedule', 'event', 'webhook']).default('http'),
  triggerConfig: z.record(z.unknown()).default({}),
  timeout: z.number().int().min(1000).max(300000).default(30000),
  memory: z.number().int().min(64).max(1024).default(256),
  metadata: z.record(z.unknown()).optional(),
});

functions.post('/', requireAuth, validateJson(createFunctionSchema), async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const body = c.req.valid('json');

  // Check slug uniqueness
  const existing = await db
    .select()
    .from(serverlessFunctions)
    .where(and(eq(serverlessFunctions.projectId, projectId), eq(serverlessFunctions.slug, body.slug)))
    .limit(1);

  if (existing.length > 0) throw new ConflictError('Function slug already exists');

  const [fn] = await db
    .insert(serverlessFunctions)
    .values({
      projectId,
      name: body.name,
      slug: body.slug,
      entrypoint: body.entrypoint,
      runtime: body.runtime,
      sourceCode: body.sourceCode,
      sourcePath: body.sourcePath,
      envVars: body.envVars,
      triggerType: body.triggerType,
      triggerConfig: body.triggerConfig,
      timeout: body.timeout,
      memory: body.memory,
      metadata: body.metadata ?? {},
    })
    .returning();

  await logAudit({
    projectId,
    userId: c.get('userId')!,
    action: 'function.create',
    resourceType: 'function',
    resourceId: fn.id,
    ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? undefined,
    userAgent: c.req.header('user-agent') ?? undefined,
  });

  return c.json({ success: true, data: fn }, 201);
});

const listQuery = z.object({
  page: z.string().default('1').transform(Number),
  limit: z.string().default('50').transform(Number),
  triggerType: z.enum(['http', 'schedule', 'event', 'webhook']).optional(),
});

functions.get('/', requireAuth, validateQuery(listQuery), async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const q = c.req.valid('query');

  const conditions = [eq(serverlessFunctions.projectId, projectId)];
  if (q.triggerType) conditions.push(eq(serverlessFunctions.triggerType, q.triggerType));

  const offset = (q.page - 1) * q.limit;
  const [rows, totalResult] = await Promise.all([
    db
      .select()
      .from(serverlessFunctions)
      .where(and(...conditions))
      .limit(q.limit)
      .offset(offset)
      .orderBy(serverlessFunctions.createdAt),
    db.select({ count: count() }).from(serverlessFunctions).where(and(...conditions)),
  ]);

  return c.json({
    success: true,
    data: rows,
    meta: {
      page: q.page,
      limit: q.limit,
      total: totalResult[0]?.count ?? 0,
      totalPages: Math.ceil((totalResult[0]?.count ?? 0) / q.limit),
    },
  });
});

functions.get('/:id', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  const id = c.req.param('id');

  const rows = await db
    .select()
    .from(serverlessFunctions)
    .where(and(eq(serverlessFunctions.id, id), eq(serverlessFunctions.projectId, projectId)))
    .limit(1);

  if (rows.length === 0) throw new NotFoundError('Function not found');
  return c.json({ success: true, data: rows[0] });
});

const updateSchema = z.object({
  name: z.string().min(1).max(256).optional(),
  slug: z.string().min(1).max(256).optional(),
  entrypoint: z.string().max(512).optional(),
  runtime: z.enum(['node22', 'node20', 'bun']).optional(),
  sourceCode: z.string().min(1).optional(),
  sourcePath: z.string().max(512).optional().nullable(),
  envVars: z.record(z.string()).optional(),
  triggerType: z.enum(['http', 'schedule', 'event', 'webhook']).optional(),
  triggerConfig: z.record(z.unknown()).optional(),
  timeout: z.number().int().min(1000).max(300000).optional(),
  memory: z.number().int().min(64).max(1024).optional(),
  active: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

functions.patch('/:id', requireAuth, validateJson(updateSchema), async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.slug !== undefined) updates.slug = body.slug;
  if (body.entrypoint !== undefined) updates.entrypoint = body.entrypoint;
  if (body.runtime !== undefined) updates.runtime = body.runtime;
  if (body.sourceCode !== undefined) updates.sourceCode = body.sourceCode;
  if (body.sourcePath !== undefined) updates.sourcePath = body.sourcePath;
  if (body.envVars !== undefined) updates.envVars = body.envVars;
  if (body.triggerType !== undefined) updates.triggerType = body.triggerType;
  if (body.triggerConfig !== undefined) updates.triggerConfig = body.triggerConfig;
  if (body.timeout !== undefined) updates.timeout = body.timeout;
  if (body.memory !== undefined) updates.memory = body.memory;
  if (body.active !== undefined) updates.active = body.active;
  if (body.metadata !== undefined) updates.metadata = body.metadata;
  updates.updatedAt = new Date();

  const rows = await db
    .update(serverlessFunctions)
    .set(updates)
    .where(and(eq(serverlessFunctions.id, id), eq(serverlessFunctions.projectId, projectId)))
    .returning();

  if (rows.length === 0) throw new NotFoundError('Function not found');
  return c.json({ success: true, data: rows[0] });
});

functions.delete('/:id', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const id = c.req.param('id');

  await db.delete(serverlessFunctions).where(and(eq(serverlessFunctions.id, id), eq(serverlessFunctions.projectId, projectId)));
  return c.json({ success: true });
});

/* ───────────────────── HTTP Trigger ───────────────────── */

functions.all(
  '/:slug/invoke',
  rateLimit({ windowMs: 60000, maxRequests: 100, keyPrefix: 'function:invoke' }),
  async (c) => {
    const projectId = c.get('projectId') ?? c.req.header('x-project-id');
    if (!projectId) throw new BadRequestError('Project ID required');
    const slug = c.req.param('slug');

    const rows = await db
      .select()
      .from(serverlessFunctions)
      .where(
        and(
          eq(serverlessFunctions.projectId, projectId),
          eq(serverlessFunctions.slug, slug),
          eq(serverlessFunctions.triggerType, 'http'),
          eq(serverlessFunctions.active, true)
        )
      )
      .limit(1);

    if (rows.length === 0) throw new NotFoundError('Function not found or inactive');
    const fn = rows[0];

    // Parse body
    let body: unknown = null;
    const contentType = c.req.header('content-type') ?? '';
    if (contentType.includes('application/json')) {
      try { body = await c.req.json(); } catch { /* ignore */ }
    } else if (contentType.includes('text/')) {
      body = await c.req.text();
    } else if (contentType.includes('multipart/form-data')) {
      const form = await c.req.parseBody();
      body = Object.fromEntries(Object.entries(form));
    }

    const input: FunctionInput = {
      body,
      query: Object.fromEntries(new URL(c.req.url).searchParams),
      headers: Object.fromEntries(
        ['content-type', 'authorization', 'x-request-id', 'x-project-id', 'user-agent'].map((h) => [
          h,
          c.req.header(h) ?? '',
        ])
      ),
      params: {},
      projectId,
      userId: c.get('userId') ?? undefined,
      env: (fn.envVars as Record<string, string>) ?? {},
    };

    const execution = await db
      .insert(functionExecutions)
      .values({
        functionId: fn.id,
        projectId,
        status: 'running',
        request: input as Record<string, unknown>,
      })
      .returning()
      .then((r) => r[0]);

    const output = await runFunction(fn.sourceCode, input, fn.timeout, fn.memory);

    await db
      .update(functionExecutions)
      .set({
        status: output.error ? 'failed' : 'completed',
        response: output.body as Record<string, unknown>,
        logs: output.logs.join('\n'),
        durationMs: output.durationMs,
        memoryUsedMb: output.memoryUsedMb,
        errorMessage: output.error,
        completedAt: new Date(),
      })
      .where(eq(functionExecutions.id, execution.id));

    // Set custom headers
    for (const [key, val] of Object.entries(output.headers)) {
      c.header(key, val);
    }

    if (output.error) {
      return c.json(
        {
          success: false,
          error: { code: 'FUNCTION_ERROR', message: output.error },
          data: { logs: output.logs, durationMs: output.durationMs },
        },
        (output.statusCode as 500) ?? 500
      );
    }

    return c.json(
      {
        success: true,
        data: output.body,
        meta: { logs: output.logs, durationMs: output.durationMs },
      },
      (output.statusCode as 200) ?? 200
    );
  }
);

/* ───────────────────── Async Trigger (Event) ───────────────────── */

const triggerSchema = z.object({
  event: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
});

functions.post(
  '/:slug/trigger',
  requireAuth,
  validateJson(triggerSchema),
  async (c) => {
    const projectId = c.get('projectId')!;
    const slug = c.req.param('slug');
    const body = c.req.valid('json');

    const rows = await db
      .select()
      .from(serverlessFunctions)
      .where(
        and(
          eq(serverlessFunctions.projectId, projectId),
          eq(serverlessFunctions.slug, slug),
          eq(serverlessFunctions.active, true)
        )
      )
      .limit(1);

    if (rows.length === 0) throw new NotFoundError('Function not found or inactive');
    const fn = rows[0];

    const jobId = await enqueueFunctionExecution({
      functionId: fn.id,
      projectId,
      triggerType: fn.triggerType,
      payload: body.payload,
      sourceCode: fn.sourceCode,
      timeout: fn.timeout,
      memory: fn.memory,
      envVars: (fn.envVars as Record<string, string>) ?? {},
    });

    return c.json({
      success: true,
      data: { jobId, status: 'queued' },
    });
  }
);

/* ───────────────────── Executions ───────────────────── */

const executionQuery = z.object({
  functionId: z.string().uuid().optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed']).optional(),
  page: z.string().default('1').transform(Number),
  limit: z.string().default('50').transform(Number),
});

functions.get('/executions', requireAuth, validateQuery(executionQuery), async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const q = c.req.valid('query');

  const conditions = [eq(functionExecutions.projectId, projectId)];
  if (q.functionId) conditions.push(eq(functionExecutions.functionId, q.functionId));
  if (q.status) conditions.push(eq(functionExecutions.status, q.status));

  const offset = (q.page - 1) * q.limit;
  const [rows, totalResult] = await Promise.all([
    db
      .select()
      .from(functionExecutions)
      .where(and(...conditions))
      .limit(q.limit)
      .offset(offset)
      .orderBy(functionExecutions.createdAt),
    db.select({ count: count() }).from(functionExecutions).where(and(...conditions)),
  ]);

  return c.json({
    success: true,
    data: rows,
    meta: {
      page: q.page,
      limit: q.limit,
      total: totalResult[0]?.count ?? 0,
      totalPages: Math.ceil((totalResult[0]?.count ?? 0) / q.limit),
    },
  });
});

functions.get('/executions/:id', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  const id = c.req.param('id');

  const rows = await db
    .select()
    .from(functionExecutions)
    .where(and(eq(functionExecutions.id, id), eq(functionExecutions.projectId, projectId)))
    .limit(1);

  if (rows.length === 0) throw new NotFoundError('Execution not found');
  return c.json({ success: true, data: rows[0] });
});

functions.delete('/executions/:id', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const id = c.req.param('id');

  await db
    .delete(functionExecutions)
    .where(and(eq(functionExecutions.id, id), eq(functionExecutions.projectId, projectId)));

  return c.json({ success: true });
});

export default functions;
