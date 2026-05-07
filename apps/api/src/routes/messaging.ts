import { Hono } from 'hono';
import { eq, and, count } from 'drizzle-orm';
import { db } from '@authify/db';
import { messagingProviders, messageTemplates, messages } from '@authify/db/schema';
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from '@authify/shared';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.js';
import { projectAuth } from '../middleware/project-auth.js';
import { validateJson, validateQuery } from '../middleware/index.js';
import { sendEmailSmtp, renderTemplate } from '../services/messaging.js';
import { logAudit } from '../services/audit.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { env } from '../lib/env.js';
import type { Variables } from '../types/context.js';

const messaging = new Hono<{ Variables: Variables }>();

function isAdmin(c: import('hono').Context): boolean {
  return c.get('role') === 'admin';
}

/* ───────────────────── Providers ───────────────────── */

const createProviderSchema = z.object({
  name: z.string().min(1).max(256),
  type: z.enum(['smtp', 'resend', 'mailgun', 'sendgrid', 'twilio', 'vonage', 'fcm']),
  config: z.record(z.unknown()),
  isDefault: z.boolean().default(false),
});

messaging.post('/providers', requireAuth, validateJson(createProviderSchema), async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const body = c.req.valid('json');

  // If setting as default, unset existing default
  if (body.isDefault) {
    await db
      .update(messagingProviders)
      .set({ isDefault: false })
      .where(
        and(
          eq(messagingProviders.projectId, projectId),
          eq(messagingProviders.type, body.type)
        )
      );
  }

  const [provider] = await db
    .insert(messagingProviders)
    .values({
      projectId,
      name: body.name,
      type: body.type,
      config: body.config,
      isDefault: body.isDefault,
    })
    .returning();

  await logAudit({
    projectId,
    userId: c.get('userId')!,
    action: 'messaging.provider.create',
    resourceType: 'messaging_provider',
    resourceId: provider.id,
    ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? undefined,
    userAgent: c.req.header('user-agent') ?? undefined,
  });

  return c.json({ success: true, data: provider }, 201);
});

messaging.get('/providers', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();

  const rows = await db
    .select()
    .from(messagingProviders)
    .where(eq(messagingProviders.projectId, projectId))
    .orderBy(messagingProviders.createdAt);

  return c.json({ success: true, data: rows });
});

messaging.get('/providers/:id', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  const id = c.req.param('id');

  const rows = await db
    .select()
    .from(messagingProviders)
    .where(and(eq(messagingProviders.id, id), eq(messagingProviders.projectId, projectId)))
    .limit(1);

  if (rows.length === 0) throw new NotFoundError('Provider not found');
  return c.json({ success: true, data: rows[0] });
});

const updateProviderSchema = z.object({
  name: z.string().min(1).max(256).optional(),
  config: z.record(z.unknown()).optional(),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
});

messaging.patch('/providers/:id', requireAuth, validateJson(updateProviderSchema), async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const id = c.req.param('id');
  const body = c.req.valid('json');

  if (body.isDefault) {
    const existing = await db
      .select()
      .from(messagingProviders)
      .where(and(eq(messagingProviders.id, id), eq(messagingProviders.projectId, projectId)))
      .limit(1);
    if (existing.length > 0) {
      await db
        .update(messagingProviders)
        .set({ isDefault: false })
        .where(
          and(
            eq(messagingProviders.projectId, projectId),
            eq(messagingProviders.type, existing[0].type)
          )
        );
    }
  }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.config !== undefined) updates.config = body.config;
  if (body.isDefault !== undefined) updates.isDefault = body.isDefault;
  if (body.active !== undefined) updates.active = body.active;
  updates.updatedAt = new Date();

  const rows = await db
    .update(messagingProviders)
    .set(updates)
    .where(and(eq(messagingProviders.id, id), eq(messagingProviders.projectId, projectId)))
    .returning();

  if (rows.length === 0) throw new NotFoundError('Provider not found');
  return c.json({ success: true, data: rows[0] });
});

messaging.delete('/providers/:id', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const id = c.req.param('id');

  await db
    .delete(messagingProviders)
    .where(and(eq(messagingProviders.id, id), eq(messagingProviders.projectId, projectId)));

  return c.json({ success: true });
});

/* ───────────────────── Templates ───────────────────── */

const createTemplateSchema = z.object({
  name: z.string().min(1).max(256),
  type: z.enum(['email', 'sms', 'push']),
  subject: z.string().max(512).optional(),
  body: z.string().min(1),
  htmlBody: z.string().optional(),
  variables: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).optional(),
});

messaging.post('/templates', requireAuth, validateJson(createTemplateSchema), async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const body = c.req.valid('json');

  const [template] = await db
    .insert(messageTemplates)
    .values({
      projectId,
      name: body.name,
      type: body.type,
      subject: body.subject,
      body: body.body,
      htmlBody: body.htmlBody,
      variables: body.variables,
      metadata: body.metadata ?? {},
    })
    .returning();

  return c.json({ success: true, data: template }, 201);
});

messaging.get('/templates', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();

  const rows = await db
    .select()
    .from(messageTemplates)
    .where(eq(messageTemplates.projectId, projectId))
    .orderBy(messageTemplates.createdAt);

  return c.json({ success: true, data: rows });
});

messaging.get('/templates/:id', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  const id = c.req.param('id');

  const rows = await db
    .select()
    .from(messageTemplates)
    .where(and(eq(messageTemplates.id, id), eq(messageTemplates.projectId, projectId)))
    .limit(1);

  if (rows.length === 0) throw new NotFoundError('Template not found');
  return c.json({ success: true, data: rows[0] });
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(256).optional(),
  type: z.enum(['email', 'sms', 'push']).optional(),
  subject: z.string().max(512).optional().nullable(),
  body: z.string().min(1).optional(),
  htmlBody: z.string().optional().nullable(),
  variables: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

messaging.patch('/templates/:id', requireAuth, validateJson(updateTemplateSchema), async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.type !== undefined) updates.type = body.type;
  if (body.subject !== undefined) updates.subject = body.subject;
  if (body.body !== undefined) updates.body = body.body;
  if (body.htmlBody !== undefined) updates.htmlBody = body.htmlBody;
  if (body.variables !== undefined) updates.variables = body.variables;
  if (body.metadata !== undefined) updates.metadata = body.metadata;
  updates.updatedAt = new Date();

  const rows = await db
    .update(messageTemplates)
    .set(updates)
    .where(and(eq(messageTemplates.id, id), eq(messageTemplates.projectId, projectId)))
    .returning();

  if (rows.length === 0) throw new NotFoundError('Template not found');
  return c.json({ success: true, data: rows[0] });
});

messaging.delete('/templates/:id', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const id = c.req.param('id');

  await db
    .delete(messageTemplates)
    .where(and(eq(messageTemplates.id, id), eq(messageTemplates.projectId, projectId)));

  return c.json({ success: true });
});

/* ───────────────────── Send Message ───────────────────── */

const sendMessageSchema = z.object({
  providerId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  type: z.enum(['email', 'sms', 'push']),
  to: z.string().min(1).max(512),
  subject: z.string().max(512).optional(),
  body: z.string().min(1).optional(),
  htmlBody: z.string().optional(),
  variables: z.record(z.string()).default({}),
  metadata: z.record(z.unknown()).optional(),
});

messaging.post(
  '/send',
  projectAuth,
  rateLimit({ windowMs: 60000, maxRequests: 60, keyPrefix: 'messaging:send' }),
  validateJson(sendMessageSchema),
  async (c) => {
    const projectId = c.get('projectId')!;
    const body = c.req.valid('json');

    let providerId = body.providerId;
    let renderedBody = body.body ?? '';
    let renderedHtml = body.htmlBody ?? null;
    let renderedSubject = body.subject ?? null;

    // If template specified, render it
    if (body.templateId) {
      const templates = await db
        .select()
        .from(messageTemplates)
        .where(and(eq(messageTemplates.id, body.templateId), eq(messageTemplates.projectId, projectId)))
        .limit(1);

      if (templates.length === 0) throw new NotFoundError('Template not found');
      const template = templates[0];

      const rendered = renderTemplate(template, body.variables);
      renderedBody = rendered.body;
      renderedHtml = rendered.htmlBody;
      renderedSubject = rendered.subject;

      if (!providerId) {
        // Find default provider for this type
        const defaults = await db
          .select()
          .from(messagingProviders)
          .where(
            and(
              eq(messagingProviders.projectId, projectId),
              eq(messagingProviders.type, template.type),
              eq(messagingProviders.isDefault, true),
              eq(messagingProviders.active, true)
            )
          )
          .limit(1);
        if (defaults.length > 0) providerId = defaults[0].id;
      }
    }

    // Get provider
    if (!providerId) {
      throw new BadRequestError('No provider specified and no default provider found');
    }

    const providers = await db
      .select()
      .from(messagingProviders)
      .where(and(eq(messagingProviders.id, providerId), eq(messagingProviders.projectId, projectId)))
      .limit(1);

    if (providers.length === 0) throw new NotFoundError('Provider not found');
    const provider = providers[0];

    if (!provider.active) throw new BadRequestError('Provider is inactive');

    // Create message record
    const [message] = await db
      .insert(messages)
      .values({
        projectId,
        providerId: provider.id,
        templateId: body.templateId,
        type: body.type,
        to: body.to,
        subject: renderedSubject,
        body: renderedBody,
        status: 'pending',
        metadata: body.metadata ?? {},
      })
      .returning();

    // Send based on provider type
    let result: { success: boolean; messageId?: string; error?: string } = {
      success: false,
      error: 'Unknown provider type',
    };

    const config = provider.config as Record<string, string>;

    switch (provider.type) {
      case 'smtp': {
        result = await sendEmailSmtp(
          {
            host: config.host,
            port: Number(config.port),
            user: config.user,
            pass: config.pass,
            secure: config.secure === 'true',
          },
          {
            from: config.from ?? env.SMTP_USER ?? 'noreply@authify.local',
            to: body.to,
            subject: renderedSubject ?? '',
            text: renderedBody,
            html: renderedHtml ?? undefined,
          }
        );
        break;
      }
      case 'resend': {
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: config.from ?? 'onboarding@resend.dev',
              to: body.to,
              subject: renderedSubject,
              text: renderedBody,
              html: renderedHtml,
            }),
          });
          const data = (await res.json()) as { id?: string; error?: string };
          result = { success: res.ok, messageId: data.id, error: data.error };
        } catch (err) {
          result = { success: false, error: err instanceof Error ? err.message : String(err) };
        }
        break;
      }
      default:
        result = { success: false, error: `Provider type ${provider.type} not yet implemented` };
    }

    // Update message status
    await db
      .update(messages)
      .set({
        status: result.success ? 'sent' : 'failed',
        sentAt: result.success ? new Date() : undefined,
        errorMessage: result.error ?? undefined,
      })
      .where(eq(messages.id, message.id));

    await logAudit({
      projectId,
      userId: c.get('userId') ?? undefined,
      action: `messaging.${result.success ? 'sent' : 'failed'}`,
      resourceType: 'message',
      resourceId: message.id,
      metadata: { provider: provider.type, to: body.to, type: body.type },
      ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? undefined,
      userAgent: c.req.header('user-agent') ?? undefined,
    });

    return c.json({
      success: result.success,
      data: {
        messageId: message.id,
        status: result.success ? 'sent' : 'failed',
        providerMessageId: result.messageId,
        error: result.error,
      },
    });
  }
);

/* ───────────────────── Messages ───────────────────── */

const messageQuery = z.object({
  status: z.enum(['pending', 'sent', 'failed', 'delivered']).optional(),
  type: z.enum(['email', 'sms', 'push']).optional(),
  page: z.string().default('1').transform(Number),
  limit: z.string().default('50').transform(Number),
});

messaging.get('/messages', requireAuth, validateQuery(messageQuery), async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const q = c.req.valid('query');

  const conditions = [eq(messages.projectId, projectId)];
  if (q.status) conditions.push(eq(messages.status, q.status));
  if (q.type) conditions.push(eq(messages.type, q.type));

  const offset = (q.page - 1) * q.limit;
  const [rows, totalResult] = await Promise.all([
    db
      .select()
      .from(messages)
      .where(and(...conditions))
      .limit(q.limit)
      .offset(offset)
      .orderBy(messages.createdAt),
    db.select({ count: count() }).from(messages).where(and(...conditions)),
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

messaging.get('/messages/:id', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  const id = c.req.param('id');

  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, id), eq(messages.projectId, projectId)))
    .limit(1);

  if (rows.length === 0) throw new NotFoundError('Message not found');
  return c.json({ success: true, data: rows[0] });
});

messaging.delete('/messages/:id', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const id = c.req.param('id');

  await db
    .delete(messages)
    .where(and(eq(messages.id, id), eq(messages.projectId, projectId)));

  return c.json({ success: true });
});

export default messaging;
