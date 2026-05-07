import { Hono } from 'hono';
import { eq, and, count } from 'drizzle-orm';
import { db } from '@authify/db';
import { webhooks, webhookDeliveries } from '@authify/db/schema';
import { BadRequestError, NotFoundError, ForbiddenError } from '@authify/shared';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { projectAuth } from '../middleware/project-auth.js';
import { validateJson, validateQuery } from '../middleware/index.js';
import { sendWebhookRequest } from '../services/messaging.js';
import { logAudit } from '../services/audit.js';
import { enqueueFunctionExecution } from '../services/queue.js';
import { rateLimit } from '../middleware/rate-limit.js';
import type { Variables } from '../types/context.js';

const webhooksRoute = new Hono<{ Variables: Variables }>();

function isAdmin(c: import('hono').Context): boolean {
  return c.get('role') === 'admin';
}

/* ───────────────────── Webhook CRUD ───────────────────── */

const createWebhookSchema = z.object({
  name: z.string().min(1).max(256),
  url: z.string().url(),
  secret: z.string().max(512).optional(),
  events: z.array(z.string()).min(1),
  active: z.boolean().default(true),
  retries: z.number().int().min(0).max(10).default(3),
  metadata: z.record(z.unknown()).optional(),
});

webhooksRoute.post('/', requireAuth, validateJson(createWebhookSchema), async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const body = c.req.valid('json');

  const [hook] = await db
    .insert(webhooks)
    .values({
      projectId,
      name: body.name,
      url: body.url,
      secret: body.secret,
      events: body.events,
      active: body.active,
      retries: body.retries,
      metadata: body.metadata ?? {},
    })
    .returning();

  await logAudit({
    projectId,
    userId: c.get('userId')!,
    action: 'webhook.create',
    resourceType: 'webhook',
    resourceId: hook.id,
    ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? undefined,
    userAgent: c.req.header('user-agent') ?? undefined,
  });

  return c.json({ success: true, data: hook }, 201);
});

webhooksRoute.get('/', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();

  const rows = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.projectId, projectId))
    .orderBy(webhooks.createdAt);

  return c.json({ success: true, data: rows });
});

webhooksRoute.get('/:id', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  const id = c.req.param('id');

  const rows = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.projectId, projectId)))
    .limit(1);

  if (rows.length === 0) throw new NotFoundError('Webhook not found');
  return c.json({ success: true, data: rows[0] });
});

const updateWebhookSchema = z.object({
  name: z.string().min(1).max(256).optional(),
  url: z.string().url().optional(),
  secret: z.string().max(512).optional().nullable(),
  events: z.array(z.string()).optional(),
  active: z.boolean().optional(),
  retries: z.number().int().min(0).max(10).optional(),
  metadata: z.record(z.unknown()).optional(),
});

webhooksRoute.patch('/:id', requireAuth, validateJson(updateWebhookSchema), async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.url !== undefined) updates.url = body.url;
  if (body.secret !== undefined) updates.secret = body.secret;
  if (body.events !== undefined) updates.events = body.events;
  if (body.active !== undefined) updates.active = body.active;
  if (body.retries !== undefined) updates.retries = body.retries;
  if (body.metadata !== undefined) updates.metadata = body.metadata;
  updates.updatedAt = new Date();

  const rows = await db
    .update(webhooks)
    .set(updates)
    .where(and(eq(webhooks.id, id), eq(webhooks.projectId, projectId)))
    .returning();

  if (rows.length === 0) throw new NotFoundError('Webhook not found');
  return c.json({ success: true, data: rows[0] });
});

webhooksRoute.delete('/:id', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const id = c.req.param('id');

  await db
    .delete(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.projectId, projectId)));
  await db
    .delete(webhookDeliveries)
    .where(and(eq(webhookDeliveries.webhookId, id), eq(webhookDeliveries.projectId, projectId)));

  return c.json({ success: true });
});

/* ───────────────────── Deliveries ───────────────────── */

const deliveryQuery = z.object({
  webhookId: z.string().uuid().optional(),
  event: z.string().optional(),
  status: z.enum(['success', 'failed']).optional(),
  page: z.string().default('1').transform(Number),
  limit: z.string().default('50').transform(Number),
});

webhooksRoute.get('/deliveries', requireAuth, validateQuery(deliveryQuery), async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const q = c.req.valid('query');

  const conditions = [eq(webhookDeliveries.projectId, projectId)];
  if (q.webhookId) conditions.push(eq(webhookDeliveries.webhookId, q.webhookId));
  if (q.event) conditions.push(eq(webhookDeliveries.event, q.event));
  if (q.status !== undefined) conditions.push(eq(webhookDeliveries.success, q.status === 'success'));

  const offset = (q.page - 1) * q.limit;
  const [rows, totalResult] = await Promise.all([
    db
      .select()
      .from(webhookDeliveries)
      .where(and(...conditions))
      .limit(q.limit)
      .offset(offset)
      .orderBy(webhookDeliveries.createdAt),
    db.select({ count: count() }).from(webhookDeliveries).where(and(...conditions)),
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

/* ───────────────────── Trigger Webhook ───────────────────── */

const triggerSchema = z.object({
  event: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
});

webhooksRoute.post(
  '/trigger',
  projectAuth,
  rateLimit({ windowMs: 60000, maxRequests: 100, keyPrefix: 'webhook:trigger' }),
  validateJson(triggerSchema),
  async (c) => {
    const projectId = c.get('projectId')!;
    const body = c.req.valid('json');

    // Find matching webhooks
    const hooks = await db
      .select()
      .from(webhooks)
      .where(
        and(
          eq(webhooks.projectId, projectId),
          eq(webhooks.active, true),
          // Check if event is in the events array
          // Using JSON array check
        )
      );

    const matchingHooks = hooks.filter((h) => {
      const events = (h.events as string[]) ?? [];
      return events.includes(body.event) || events.includes('*');
    });

    if (matchingHooks.length === 0) {
      return c.json({ success: true, data: { delivered: 0 } });
    }

    const results: Array<{ webhookId: string; success: boolean; error?: string }> = [];

    for (const hook of matchingHooks) {
      const result = await sendWebhookRequest(
        hook.url,
        {
          event: body.event,
          payload: body.payload,
          timestamp: new Date().toISOString(),
          id: crypto.randomUUID(),
        },
        hook.secret ?? undefined
      );

      // Record delivery
      await db.insert(webhookDeliveries).values({
        webhookId: hook.id,
        projectId,
        event: body.event,
        payload: body.payload,
        statusCode: result.statusCode,
        responseBody: result.responseBody,
        success: result.success,
        attempt: 1,
        deliveredAt: result.success ? new Date() : undefined,
      });

      results.push({
        webhookId: hook.id,
        success: result.success,
        error: result.error,
      });

      if (!result.success && hook.retries > 0) {
        // Schedule retry via BullMQ (simplified - enqueue to function queue as retry task)
        // In production, you'd have a dedicated webhook retry queue
        // For now, we just record the failure
      }
    }

    await logAudit({
      projectId,
      userId: c.get('userId') ?? undefined,
      action: 'webhook.trigger',
      resourceType: 'webhook',
      metadata: { event: body.event, delivered: results.filter((r) => r.success).length },
      ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? undefined,
      userAgent: c.req.header('user-agent') ?? undefined,
    });

    return c.json({
      success: true,
      data: {
        delivered: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        results,
      },
    });
  }
);

export default webhooksRoute;
