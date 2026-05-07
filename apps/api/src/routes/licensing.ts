import { Hono } from 'hono';
import { eq, and, count } from 'drizzle-orm';
import { db } from '@authify/db';
import {
  licenseApps,
  licenseKeys,
  licenseActivations,
  licenseVariables,
  blacklist,
} from '@authify/db/schema';
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
} from '@authify/shared';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateJson, validateQuery } from '../middleware/index.js';
import { hashHwid, normalizeHwid } from '../services/hwid.js';
import { encryptValue, decryptValue } from '../services/crypto.js';
import { deliverLicenseWebhook } from '../services/webhook.js';
import { logAudit } from '../services/audit.js';
import { rateLimit } from '../middleware/rate-limit.js';
import type { Variables } from '../types/context.js';

const licensing = new Hono<{ Variables: Variables }>();

function isAdmin(c: import('hono').Context): boolean {
  return c.get('role') === 'admin';
}

/* ───────────────────── License Apps ───────────────────── */

const createAppSchema = z.object({
  name: z.string().min(1).max(256),
  description: z.string().optional(),
  version: z.string().max(64).default('1.0.0'),
  hwidLocking: z.boolean().default(true),
  maxDevices: z.number().int().min(1).default(1),
  webhookUrl: z.string().url().optional(),
  antiDebug: z.boolean().default(false),
  encryptionKey: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

licensing.post('/apps', requireAuth, validateJson(createAppSchema), async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const body = c.req.valid('json');

  const [app] = await db
    .insert(licenseApps)
    .values({ projectId, ...body })
    .returning();

  await logAudit({
    projectId,
    userId: c.get('userId')!,
    action: 'license_app.create',
    resourceType: 'license_app',
    resourceId: app.id,
    ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? undefined,
    userAgent: c.req.header('user-agent') ?? undefined,
  });

  return c.json({ success: true, data: app }, 201);
});

licensing.get('/apps', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();

  const rows = await db.select().from(licenseApps).where(eq(licenseApps.projectId, projectId));
  return c.json({ success: true, data: rows });
});

licensing.get('/apps/:id', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  const id = c.req.param('id');

  const rows = await db
    .select()
    .from(licenseApps)
    .where(and(eq(licenseApps.id, id), eq(licenseApps.projectId, projectId)))
    .limit(1);

  if (rows.length === 0) throw new NotFoundError('License app not found');
  return c.json({ success: true, data: rows[0] });
});

const updateAppSchema = z.object({
  name: z.string().min(1).max(256).optional(),
  description: z.string().optional(),
  version: z.string().max(64).optional(),
  hwidLocking: z.boolean().optional(),
  maxDevices: z.number().int().min(1).optional(),
  webhookUrl: z.string().url().optional().nullable(),
  antiDebug: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

licensing.patch('/apps/:id', requireAuth, validateJson(updateAppSchema), async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const rows = await db
    .update(licenseApps)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(licenseApps.id, id), eq(licenseApps.projectId, projectId)))
    .returning();

  if (rows.length === 0) throw new NotFoundError('License app not found');
  return c.json({ success: true, data: rows[0] });
});

licensing.delete('/apps/:id', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const id = c.req.param('id');

  await db
    .delete(licenseApps)
    .where(and(eq(licenseApps.id, id), eq(licenseApps.projectId, projectId)));

  return c.json({ success: true });
});

/* ───────────────────── License Keys ───────────────────── */

function generateLicenseKey(): string {
  const segments = 4;
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let key = '';
  for (let s = 0; s < segments; s++) {
    let segment = '';
    for (let i = 0; i < 5; i++) {
      segment += chars[Math.floor(Math.random() * chars.length)];
    }
    key += (s > 0 ? '-' : '') + segment;
  }
  return key;
}

const createKeySchema = z.object({
  appId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  tier: z.string().max(64).default('basic'),
  maxActivations: z.number().int().min(1).default(1),
  expiresAt: z.string().datetime().optional(),
  note: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  quantity: z.number().int().min(1).max(1000).default(1),
});

licensing.post('/keys', requireAuth, validateJson(createKeySchema), async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const body = c.req.valid('json');

  // Verify app exists
  const apps = await db
    .select()
    .from(licenseApps)
    .where(and(eq(licenseApps.id, body.appId), eq(licenseApps.projectId, projectId)))
    .limit(1);
  if (apps.length === 0) throw new NotFoundError('License app not found');

  const created: typeof licenseApps.$inferSelect[] = [];
  for (let i = 0; i < body.quantity; i++) {
    let key = generateLicenseKey();
    // Ensure uniqueness
    while (true) {
      const existing = await db.select().from(licenseKeys).where(eq(licenseKeys.key, key)).limit(1);
      if (existing.length === 0) break;
      key = generateLicenseKey();
    }

    const [row] = await db
      .insert(licenseKeys)
      .values({
        appId: body.appId,
        projectId,
        key,
        userId: body.userId,
        tier: body.tier,
        maxActivations: body.maxActivations,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
        note: body.note,
        metadata: body.metadata ?? {},
      })
      .returning();
    created.push(row);
  }

  await logAudit({
    projectId,
    userId: c.get('userId')!,
    action: 'license_key.create',
    resourceType: 'license_key',
    resourceId: created[0]?.id,
    metadata: { quantity: body.quantity, appId: body.appId },
    ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? undefined,
    userAgent: c.req.header('user-agent') ?? undefined,
  });

  return c.json({ success: true, data: body.quantity === 1 ? created[0] : created }, 201);
});

const listKeysQuery = z.object({
  appId: z.string().uuid().optional(),
  status: z.enum(['pending', 'active', 'expired', 'revoked', 'banned']).optional(),
  userId: z.string().uuid().optional(),
  page: z.string().default('1').transform(Number),
  limit: z.string().default('50').transform(Number),
});

licensing.get('/keys', requireAuth, validateQuery(listKeysQuery), async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const q = c.req.valid('query');

  const conditions = [eq(licenseKeys.projectId, projectId)];
  if (q.appId) conditions.push(eq(licenseKeys.appId, q.appId));
  if (q.status) conditions.push(eq(licenseKeys.status, q.status));
  if (q.userId) conditions.push(eq(licenseKeys.userId, q.userId));

  const offset = (q.page - 1) * q.limit;
  const [rows, totalResult] = await Promise.all([
    db
      .select()
      .from(licenseKeys)
      .where(and(...conditions))
      .limit(q.limit)
      .offset(offset)
      .orderBy(licenseKeys.createdAt),
    db
      .select({ count: count() })
      .from(licenseKeys)
      .where(and(...conditions)),
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

licensing.get('/keys/:id', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  const id = c.req.param('id');

  const rows = await db
    .select()
    .from(licenseKeys)
    .where(and(eq(licenseKeys.id, id), eq(licenseKeys.projectId, projectId)))
    .limit(1);

  if (rows.length === 0) throw new NotFoundError('License key not found');
  return c.json({ success: true, data: rows[0] });
});

const updateKeySchema = z.object({
  tier: z.string().max(64).optional(),
  maxActivations: z.number().int().min(1).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  status: z.enum(['pending', 'active', 'expired', 'revoked', 'banned']).optional(),
  note: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
  userId: z.string().uuid().optional().nullable(),
});

licensing.patch('/keys/:id', requireAuth, validateJson(updateKeySchema), async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const updates: Record<string, unknown> = {};
  if (body.tier !== undefined) updates.tier = body.tier;
  if (body.maxActivations !== undefined) updates.maxActivations = body.maxActivations;
  if (body.expiresAt !== undefined) updates.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if (body.status !== undefined) updates.status = body.status;
  if (body.note !== undefined) updates.note = body.note;
  if (body.metadata !== undefined) updates.metadata = body.metadata;
  if (body.userId !== undefined) updates.userId = body.userId;
  updates.updatedAt = new Date();

  const rows = await db
    .update(licenseKeys)
    .set(updates)
    .where(and(eq(licenseKeys.id, id), eq(licenseKeys.projectId, projectId)))
    .returning();

  if (rows.length === 0) throw new NotFoundError('License key not found');
  return c.json({ success: true, data: rows[0] });
});

licensing.delete('/keys/:id', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const id = c.req.param('id');

  await db
    .delete(licenseKeys)
    .where(and(eq(licenseKeys.id, id), eq(licenseKeys.projectId, projectId)));

  return c.json({ success: true });
});

/* ───────────────────── Activate / Validate / Heartbeat ───────────────────── */

const activateSchema = z.object({
  key: z.string().min(1),
  hwid: z.string().min(1),
  deviceName: z.string().optional(),
  appVersion: z.string().optional(),
});

licensing.post(
  '/activate',
  rateLimit({ windowMs: 60000, maxRequests: 10, keyPrefix: 'license:activate' }),
  validateJson(activateSchema),
  async (c) => {
    const projectId = c.get('projectId')!;
    const { key, hwid, deviceName, appVersion } = c.req.valid('json');
    const normalizedHwid = normalizeHwid(hwid);
    const hwidHash = hashHwid(normalizedHwid);

    // Find key
    const keyRows = await db
      .select()
      .from(licenseKeys)
      .where(and(eq(licenseKeys.key, key.toUpperCase()), eq(licenseKeys.projectId, projectId)))
      .limit(1);

    if (keyRows.length === 0) throw new UnauthorizedError('Invalid license key');
    const lic = keyRows[0];

    // Check status
    if (lic.status === 'revoked' || lic.status === 'banned') {
      throw new UnauthorizedError('License key revoked');
    }
    if (lic.status === 'expired') {
      throw new UnauthorizedError('License key expired');
    }
    if (lic.expiresAt && new Date(lic.expiresAt) < new Date()) {
      await db
        .update(licenseKeys)
        .set({ status: 'expired' })
        .where(eq(licenseKeys.id, lic.id));
      throw new UnauthorizedError('License key expired');
    }

    // Get app config
    const apps = await db
      .select()
      .from(licenseApps)
      .where(and(eq(licenseApps.id, lic.appId), eq(licenseApps.projectId, projectId)))
      .limit(1);
    const app = apps[0];

    // Blacklist check
    const blacklistCheck = await db
      .select()
      .from(blacklist)
      .where(
        and(
          eq(blacklist.projectId, projectId),
          eq(blacklist.type, 'hwid'),
          eq(blacklist.value, hwidHash)
        )
      )
      .limit(1);
    if (blacklistCheck.length > 0 && blacklistCheck[0].permanent) {
      throw new UnauthorizedError('Device blacklisted');
    }

    // Check existing activations for this HWID
    const existing = await db
      .select()
      .from(licenseActivations)
      .where(
        and(
          eq(licenseActivations.keyId, lic.id),
          eq(licenseActivations.hwid, hwidHash),
          eq(licenseActivations.projectId, projectId)
        )
      )
      .limit(1);

    if (existing.length > 0 && existing[0].active) {
      // Reactivation of same device
      await db
        .update(licenseActivations)
        .set({ lastSeenAt: new Date() })
        .where(eq(licenseActivations.id, existing[0].id));
    } else {
      // Check activation limit
      if (lic.currentActivations >= lic.maxActivations) {
        throw new UnauthorizedError('Max activations reached');
      }

      await db.insert(licenseActivations).values({
        keyId: lic.id,
        projectId,
        hwid: hwidHash,
        deviceName: deviceName ?? 'Unknown',
        ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? undefined,
      });

      await db
        .update(licenseKeys)
        .set({ currentActivations: lic.currentActivations + 1, status: 'active' })
        .where(eq(licenseKeys.id, lic.id));
    }

    // Fetch variables
    const vars = await db
      .select()
      .from(licenseVariables)
      .where(and(eq(licenseVariables.appId, lic.appId), eq(licenseVariables.projectId, projectId)));

    const decryptedVars: Record<string, string> = {};
    for (const v of vars) {
      try {
        decryptedVars[v.name] = await decryptValue(v.value);
      } catch {
        decryptedVars[v.name] = v.value;
      }
    }

    // Webhook
    if (app?.webhookUrl) {
      deliverLicenseWebhook(
        {
          appId: lic.appId,
          projectId,
          event: 'license.activated',
          payload: {
            key: lic.key,
            hwid: hwidHash,
            deviceName: deviceName ?? 'Unknown',
            appVersion,
            activatedAt: new Date().toISOString(),
          },
        },
        app.webhookUrl
      ).catch(() => {});
    }

    return c.json({
      success: true,
      data: {
        key: lic.key,
        tier: lic.tier,
        expiresAt: lic.expiresAt,
        maxActivations: lic.maxActivations,
        currentActivations: lic.currentActivations + (existing.length > 0 && existing[0].active ? 0 : 1),
        hwidLocked: app?.hwidLocking ?? true,
        variables: decryptedVars,
      },
    });
  }
);

const validateSchema = z.object({
  key: z.string().min(1),
  hwid: z.string().min(1),
});

licensing.post(
  '/validate',
  rateLimit({ windowMs: 60000, maxRequests: 30, keyPrefix: 'license:validate' }),
  validateJson(validateSchema),
  async (c) => {
    const projectId = c.get('projectId')!;
    const { key, hwid } = c.req.valid('json');
    const hwidHash = hashHwid(normalizeHwid(hwid));

    const keyRows = await db
      .select()
      .from(licenseKeys)
      .where(and(eq(licenseKeys.key, key.toUpperCase()), eq(licenseKeys.projectId, projectId)))
      .limit(1);

    if (keyRows.length === 0) throw new UnauthorizedError('Invalid license key');
    const lic = keyRows[0];

    if (lic.status !== 'active') {
      throw new UnauthorizedError(`License key ${lic.status}`);
    }
    if (lic.expiresAt && new Date(lic.expiresAt) < new Date()) {
      throw new UnauthorizedError('License key expired');
    }

    // Check HWID binding
    const apps = await db
      .select()
      .from(licenseApps)
      .where(eq(licenseApps.id, lic.appId))
      .limit(1);
    const app = apps[0];

    if (app?.hwidLocking) {
      const acts = await db
        .select()
        .from(licenseActivations)
        .where(
          and(
            eq(licenseActivations.keyId, lic.id),
            eq(licenseActivations.hwid, hwidHash),
            eq(licenseActivations.active, true)
          )
        )
        .limit(1);
      if (acts.length === 0) {
        throw new UnauthorizedError('Device not activated');
      }
      await db
        .update(licenseActivations)
        .set({ lastSeenAt: new Date() })
        .where(eq(licenseActivations.id, acts[0].id));
    }

    return c.json({
      success: true,
      data: {
        valid: true,
        key: lic.key,
        tier: lic.tier,
        expiresAt: lic.expiresAt,
        maxActivations: lic.maxActivations,
        currentActivations: lic.currentActivations,
      },
    });
  }
);

const heartbeatSchema = z.object({
  key: z.string().min(1),
  hwid: z.string().min(1),
});

licensing.post(
  '/heartbeat',
  rateLimit({ windowMs: 60000, maxRequests: 60, keyPrefix: 'license:heartbeat' }),
  validateJson(heartbeatSchema),
  async (c) => {
    const projectId = c.get('projectId')!;
    const { key, hwid } = c.req.valid('json');
    const hwidHash = hashHwid(normalizeHwid(hwid));

    const keyRows = await db
      .select()
      .from(licenseKeys)
      .where(and(eq(licenseKeys.key, key.toUpperCase()), eq(licenseKeys.projectId, projectId)))
      .limit(1);

    if (keyRows.length === 0) throw new UnauthorizedError('Invalid license key');
    const lic = keyRows[0];

    if (lic.status !== 'active') throw new UnauthorizedError(`License key ${lic.status}`);
    if (lic.expiresAt && new Date(lic.expiresAt) < new Date()) {
      throw new UnauthorizedError('License key expired');
    }

    const acts = await db
      .select()
      .from(licenseActivations)
      .where(
        and(
          eq(licenseActivations.keyId, lic.id),
          eq(licenseActivations.hwid, hwidHash),
          eq(licenseActivations.active, true)
        )
      )
      .limit(1);

    if (acts.length === 0) throw new UnauthorizedError('Device not activated');

    await db
      .update(licenseActivations)
      .set({ lastSeenAt: new Date() })
      .where(eq(licenseActivations.id, acts[0].id));

    return c.json({ success: true, data: { alive: true } });
  }
);

/* ───────────────────── Deactivate ───────────────────── */

const deactivateSchema = z.object({
  key: z.string().min(1),
  hwid: z.string().min(1),
});

licensing.post(
  '/deactivate',
  rateLimit({ windowMs: 60000, maxRequests: 10, keyPrefix: 'license:deactivate' }),
  validateJson(deactivateSchema),
  async (c) => {
    const projectId = c.get('projectId')!;
    const { key, hwid } = c.req.valid('json');
    const hwidHash = hashHwid(normalizeHwid(hwid));

    const keyRows = await db
      .select()
      .from(licenseKeys)
      .where(and(eq(licenseKeys.key, key.toUpperCase()), eq(licenseKeys.projectId, projectId)))
      .limit(1);

    if (keyRows.length === 0) throw new UnauthorizedError('Invalid license key');
    const lic = keyRows[0];

    const acts = await db
      .select()
      .from(licenseActivations)
      .where(
        and(
          eq(licenseActivations.keyId, lic.id),
          eq(licenseActivations.hwid, hwidHash),
          eq(licenseActivations.projectId, projectId)
        )
      )
      .limit(1);

    if (acts.length === 0) throw new NotFoundError('Activation not found');

    await db
      .delete(licenseActivations)
      .where(eq(licenseActivations.id, acts[0].id));
    await db
      .update(licenseKeys)
      .set({ currentActivations: Math.max(0, lic.currentActivations - 1) })
      .where(eq(licenseKeys.id, lic.id));

    return c.json({ success: true });
  }
);

/* ───────────────────── Activations (Admin) ───────────────────── */

licensing.get('/activations', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();

  const keyId = c.req.query('keyId');
  const conditions = [eq(licenseActivations.projectId, projectId)];
  if (keyId) conditions.push(eq(licenseActivations.keyId, keyId));

  const rows = await db
    .select()
    .from(licenseActivations)
    .where(and(...conditions))
    .orderBy(licenseActivations.activatedAt);

  return c.json({ success: true, data: rows });
});

licensing.delete('/activations/:id', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const id = c.req.param('id');

  const rows = await db
    .select()
    .from(licenseActivations)
    .where(and(eq(licenseActivations.id, id), eq(licenseActivations.projectId, projectId)))
    .limit(1);

  if (rows.length === 0) throw new NotFoundError('Activation not found');

  await db.delete(licenseActivations).where(eq(licenseActivations.id, id));

  // Decrement key counter
  await db
    .update(licenseKeys)
    .set({ currentActivations: Math.max(0, (rows[0] as { keyId: string }).keyId.length - 1) }) // placeholder, will recalc
    .where(eq(licenseKeys.id, (rows[0] as { keyId: string }).keyId));

  // Recalc accurate count
  const countResult = await db
    .select({ count: count() })
    .from(licenseActivations)
    .where(eq(licenseActivations.keyId, (rows[0] as { keyId: string }).keyId));

  await db
    .update(licenseKeys)
    .set({ currentActivations: countResult[0]?.count ?? 0 })
    .where(eq(licenseKeys.id, (rows[0] as { keyId: string }).keyId));

  return c.json({ success: true });
});

/* ───────────────────── License Variables ───────────────────── */

const createVariableSchema = z.object({
  appId: z.string().uuid(),
  name: z.string().min(1).max(256),
  value: z.string().min(1),
  type: z.string().max(64).default('string'),
});

licensing.post('/variables', requireAuth, validateJson(createVariableSchema), async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const body = c.req.valid('json');

  const encrypted = await encryptValue(body.value);

  const [row] = await db
    .insert(licenseVariables)
    .values({
      appId: body.appId,
      projectId,
      name: body.name,
      value: encrypted,
      type: body.type,
    })
    .returning();

  return c.json({ success: true, data: { ...row, value: body.value } }, 201);
});

licensing.get('/variables', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const appId = c.req.query('appId');

  const conditions = [eq(licenseVariables.projectId, projectId)];
  if (appId) conditions.push(eq(licenseVariables.appId, appId));

  const rows = await db
    .select()
    .from(licenseVariables)
    .where(and(...conditions))
    .orderBy(licenseVariables.name);

  return c.json({ success: true, data: rows });
});

const updateVariableSchema = z.object({
  name: z.string().min(1).max(256).optional(),
  value: z.string().min(1).optional(),
  type: z.string().max(64).optional(),
});

licensing.patch('/variables/:id', requireAuth, validateJson(updateVariableSchema), async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.value !== undefined) updates.value = await encryptValue(body.value);
  if (body.type !== undefined) updates.type = body.type;
  updates.updatedAt = new Date();

  const rows = await db
    .update(licenseVariables)
    .set(updates)
    .where(and(eq(licenseVariables.id, id), eq(licenseVariables.projectId, projectId)))
    .returning();

  if (rows.length === 0) throw new NotFoundError('Variable not found');
  return c.json({ success: true, data: rows[0] });
});

licensing.delete('/variables/:id', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const id = c.req.param('id');

  await db
    .delete(licenseVariables)
    .where(and(eq(licenseVariables.id, id), eq(licenseVariables.projectId, projectId)));

  return c.json({ success: true });
});

/* ───────────────────── Blacklist ───────────────────── */

const createBlacklistSchema = z.object({
  appId: z.string().uuid().optional(),
  type: z.enum(['ip', 'hwid', 'username', 'email', 'license_key']),
  value: z.string().min(1).max(512),
  reason: z.string().optional(),
  permanent: z.boolean().default(true),
  expiresAt: z.string().datetime().optional(),
});

licensing.post('/blacklist', requireAuth, validateJson(createBlacklistSchema), async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const body = c.req.valid('json');

  const [row] = await db
    .insert(blacklist)
    .values({
      projectId,
      appId: body.appId,
      type: body.type,
      value: body.type === 'hwid' ? hashHwid(normalizeHwid(body.value)) : body.value.toLowerCase(),
      reason: body.reason,
      permanent: body.permanent,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    })
    .returning();

  return c.json({ success: true, data: row }, 201);
});

licensing.get('/blacklist', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();

  const type = c.req.query('type');
  const conditions = [eq(blacklist.projectId, projectId)];
  if (type) conditions.push(eq(blacklist.type, type as string));

  const rows = await db
    .select()
    .from(blacklist)
    .where(and(...conditions))
    .orderBy(blacklist.createdAt);

  return c.json({ success: true, data: rows });
});

licensing.delete('/blacklist/:id', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const id = c.req.param('id');

  await db.delete(blacklist).where(and(eq(blacklist.id, id), eq(blacklist.projectId, projectId)));
  return c.json({ success: true });
});

export default licensing;
