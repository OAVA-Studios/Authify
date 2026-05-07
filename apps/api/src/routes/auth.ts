import { Hono } from 'hono';
import { eq, and, gt, ne } from 'drizzle-orm';
import { db } from '@authify/db';
import {
  users,
  sessions,
  oauthAccounts,
  passwordResetTokens,
  emailVerificationTokens,
  twoFactorAuth,
} from '@authify/db/schema';
import {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
} from '@authify/shared';
import { z } from 'zod';
import { authenticator } from 'otplib';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.js';
import { validateJson } from '../middleware/index.js';
import { hashPassword, verifyPassword } from '../services/password.js';
import { createAccessToken, createRefreshToken, verifyRefreshToken } from '../services/jwt.js';
import { logAudit } from '../services/audit.js';
import { env } from '../lib/env.js';
import type { Variables } from '../types/context.js';

const auth = new Hono<{ Variables: Variables }>();

function setSessionCookie(c: import('hono').Context, token: string) {
  const secure = env.NODE_ENV === 'production';
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  c.header(
    'Set-Cookie',
    `authify_session=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure ? '; Secure' : ''}`
  );
}

function clearSessionCookie(c: import('hono').Context) {
  c.header('Set-Cookie', 'authify_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
}

function resolveProjectId(c: import('hono').Context): string {
  return c.req.header('x-project-id') ?? c.req.header('x-api-key')?.slice(0, 36) ?? '';
}

/* ─────────────── Register ─────────────── */
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  metadata: z.record(z.unknown()).optional(),
});

auth.post('/register', validateJson(registerSchema), async (c) => {
  const projectId = resolveProjectId(c);
  if (!projectId) throw new BadRequestError('Project ID required');
  const { email, password, metadata } = c.req.valid('json');

  const existing = await db
    .select()
    .from(users)
    .where(and(eq(users.projectId, projectId), eq(users.email, email.toLowerCase())))
    .limit(1);

  if (existing.length > 0) throw new ConflictError('Email already registered');

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({
      projectId,
      email: email.toLowerCase(),
      passwordHash,
      metadata: metadata ?? {},
    })
    .returning();

  await logAudit({
    projectId,
    userId: user.id,
    action: 'user.register',
    resourceType: 'user',
    resourceId: user.id,
    ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? undefined,
    userAgent: c.req.header('user-agent') ?? undefined,
  });

  return c.json({ success: true, data: { id: user.id, email: user.email, createdAt: user.createdAt } }, 201);
});

/* ─────────────── Login ─────────────── */
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  twoFactorCode: z.string().length(6).optional(),
});

auth.post('/login', validateJson(loginSchema), async (c) => {
  const projectId = resolveProjectId(c);
  if (!projectId) throw new BadRequestError('Project ID required');
  const { email, password, twoFactorCode } = c.req.valid('json');

  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.projectId, projectId), eq(users.email, email.toLowerCase())))
    .limit(1);

  if (rows.length === 0) throw new UnauthorizedError('Invalid credentials');
  const user = rows[0];

  if (!user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    throw new UnauthorizedError('Invalid credentials');
  }

  if (user.banned) throw new UnauthorizedError('Account banned');

  // Check 2FA
  const tfaRows = await db
    .select()
    .from(twoFactorAuth)
    .where(eq(twoFactorAuth.userId, user.id))
    .limit(1);

  if (tfaRows.length > 0 && tfaRows[0].enabled) {
    if (!twoFactorCode) throw new UnauthorizedError('2FA required');
    const verified = authenticator.check(twoFactorCode, tfaRows[0].secret);
    if (!verified) throw new UnauthorizedError('Invalid 2FA code');
  }

  const session = await db
    .insert(sessions)
    .values({
      userId: user.id,
      projectId,
      token: uuidv4(),
      refreshToken: uuidv4(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? undefined,
      deviceInfo: { userAgent: c.req.header('user-agent') ?? undefined },
    })
    .returning()
    .then((r) => r[0]);

  const accessToken = await createAccessToken(user.id, projectId, user.role);
  const refreshToken = await createRefreshToken(session.id);

  // Update session with JWT tokens
  await db
    .update(sessions)
    .set({ token: accessToken, refreshToken })
    .where(eq(sessions.id, session.id));

  await db
    .update(users)
    .set({ lastLoginAt: new Date(), lastLoginIp: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? undefined })
    .where(eq(users.id, user.id));

  setSessionCookie(c, accessToken);

  await logAudit({
    projectId,
    userId: user.id,
    action: 'user.login',
    resourceType: 'session',
    resourceId: session.id,
    ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? undefined,
    userAgent: c.req.header('user-agent') ?? undefined,
  });

  return c.json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: { id: user.id, email: user.email, role: user.role, emailVerified: user.emailVerified },
    },
  });
});

/* ─────────────── Logout ─────────────── */
auth.post('/logout', requireAuth, async (c) => {
  const sessionId = c.get('sessionId')!;
  const projectId = c.get('projectId')!;
  const userId = c.get('userId')!;

  await db.delete(sessions).where(eq(sessions.id, sessionId));
  clearSessionCookie(c);

  await logAudit({
    projectId,
    userId,
    action: 'user.logout',
    resourceType: 'session',
    resourceId: sessionId,
    ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? undefined,
    userAgent: c.req.header('user-agent') ?? undefined,
  });

  return c.json({ success: true });
});

/* ─────────────── Refresh ─────────────── */
const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

auth.post('/refresh', validateJson(refreshSchema), async (c) => {
  const { refreshToken: inputRefresh } = c.req.valid('json');

  let payload;
  try {
    payload = await verifyRefreshToken(inputRefresh);
  } catch {
    throw new UnauthorizedError('Invalid refresh token');
  }

  const sessionRows = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, payload.sub), eq(sessions.refreshToken, inputRefresh)))
    .limit(1);

  if (sessionRows.length === 0) throw new UnauthorizedError('Session not found');
  const session = sessionRows[0];

  if (new Date(session.expiresAt) < new Date()) {
    throw new UnauthorizedError('Session expired');
  }

  const userRows = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (userRows.length === 0) throw new UnauthorizedError('User not found');
  const user = userRows[0];

  const newAccess = await createAccessToken(user.id, session.projectId, user.role);
  const newRefresh = await createRefreshToken(session.id);

  await db
    .update(sessions)
    .set({ token: newAccess, refreshToken: newRefresh })
    .where(eq(sessions.id, session.id));

  setSessionCookie(c, newAccess);

  return c.json({
    success: true,
    data: { accessToken: newAccess, refreshToken: newRefresh, expiresIn: 900 },
  });
});

/* ─────────────── Me ─────────────── */
auth.get('/me', requireAuth, async (c) => {
  const userId = c.get('userId')!;
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (rows.length === 0) throw new NotFoundError('User not found');
  const user = rows[0];
  return c.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      banned: user.banned,
      metadata: user.metadata,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    },
  });
});

/* ─────────────── Update Profile ─────────────── */
const updateProfileSchema = z.object({
  email: z.string().email().optional(),
  metadata: z.record(z.unknown()).optional(),
  preferences: z.record(z.unknown()).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(128).optional(),
});

auth.patch('/me', requireAuth, validateJson(updateProfileSchema), async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.get('projectId')!;
  const body = c.req.valid('json');

  const updates: Record<string, unknown> = {};
  if (body.metadata !== undefined) updates.metadata = body.metadata;
  if (body.preferences !== undefined) updates.preferences = body.preferences;
  if (body.email !== undefined) updates.email = body.email.toLowerCase();

  if (body.newPassword) {
    if (!body.currentPassword) throw new BadRequestError('Current password required');
    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (rows.length === 0 || !rows[0].passwordHash) throw new UnauthorizedError();
    if (!(await verifyPassword(body.currentPassword, rows[0].passwordHash))) {
      throw new UnauthorizedError('Invalid current password');
    }
    updates.passwordHash = await hashPassword(body.newPassword);
  }

  const [user] = await db.update(users).set(updates).where(eq(users.id, userId)).returning();

  await logAudit({
    projectId,
    userId,
    action: 'user.update',
    resourceType: 'user',
    resourceId: userId,
    metadata: { fields: Object.keys(updates) },
    ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? undefined,
    userAgent: c.req.header('user-agent') ?? undefined,
  });

  return c.json({ success: true, data: { id: user.id, email: user.email, updatedAt: user.updatedAt } });
});

/* ─────────────── Password Reset Request ─────────────── */
const pwResetRequestSchema = z.object({ email: z.string().email() });

auth.post('/password-reset-request', validateJson(pwResetRequestSchema), async (c) => {
  const projectId = resolveProjectId(c);
  if (!projectId) throw new BadRequestError('Project ID required');
  const { email } = c.req.valid('json');

  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.projectId, projectId), eq(users.email, email.toLowerCase())))
    .limit(1);

  if (rows.length > 0) {
    const user = rows[0];
    const token = uuidv4();
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      projectId,
      token,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    });
    // TODO: send email with reset link
  }

  return c.json({ success: true, data: { message: 'If the email exists, a reset link has been sent' } });
});

/* ─────────────── Password Reset ─────────────── */
const pwResetSchema = z.object({
  token: z.string().uuid(),
  newPassword: z.string().min(8).max(128),
});

auth.post('/password-reset', validateJson(pwResetSchema), async (c) => {
  const { token, newPassword } = c.req.valid('json');

  const rows = await db
    .select()
    .from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.token, token), eq(passwordResetTokens.used, false), gt(passwordResetTokens.expiresAt, new Date())))
    .limit(1);

  if (rows.length === 0) throw new BadRequestError('Invalid or expired token');
  const reset = rows[0];

  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.id, reset.userId));
  await db
    .update(passwordResetTokens)
    .set({ used: true })
    .where(eq(passwordResetTokens.id, reset.id));

  // Revoke all sessions for user
  await db.delete(sessions).where(eq(sessions.userId, reset.userId));

  return c.json({ success: true, data: { message: 'Password updated successfully' } });
});

/* ─────────────── Verify Email Request ─────────────── */
auth.post('/verify-email-request', requireAuth, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.get('projectId')!;

  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (rows.length === 0) throw new NotFoundError('User not found');
  if (rows[0].emailVerified) {
    return c.json({ success: true, data: { message: 'Email already verified' } });
  }

  const token = uuidv4();
  await db.insert(emailVerificationTokens).values({
    userId,
    projectId,
    token,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
  });

  // TODO: send verification email

  return c.json({ success: true, data: { message: 'Verification email sent' } });
});

/* ─────────────── Verify Email ─────────────── */
const verifyEmailSchema = z.object({ token: z.string().uuid() });

auth.post('/verify-email', validateJson(verifyEmailSchema), async (c) => {
  const { token } = c.req.valid('json');

  const rows = await db
    .select()
    .from(emailVerificationTokens)
    .where(and(eq(emailVerificationTokens.token, token), gt(emailVerificationTokens.expiresAt, new Date())))
    .limit(1);

  if (rows.length === 0) throw new BadRequestError('Invalid or expired token');

  const verif = rows[0];
  await db.update(users).set({ emailVerified: true }).where(eq(users.id, verif.userId));
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, verif.id));

  return c.json({ success: true, data: { message: 'Email verified successfully' } });
});

/* ─────────────── 2FA Enable ─────────────── */
auth.post('/2fa/enable', requireAuth, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.get('projectId')!;

  const existing = await db.select().from(twoFactorAuth).where(eq(twoFactorAuth.userId, userId)).limit(1);
  if (existing.length > 0 && existing[0].enabled) {
    throw new ConflictError('2FA already enabled');
  }

  const secret = authenticator.generateSecret();
  const backupCodes = Array.from({ length: 8 }, () =>
    Math.random().toString(36).substring(2, 8).toUpperCase()
  );

  await db
    .insert(twoFactorAuth)
    .values({ userId, projectId, secret, backupCodes, enabled: false })
    .onConflictDoUpdate({
      target: twoFactorAuth.userId,
      set: { secret, backupCodes, enabled: false },
    });

  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const otpauth = authenticator.keyuri(userRows[0].email, 'Authify', secret);

  return c.json({
    success: true,
    data: { secret, otpauth, backupCodes },
  });
});

/* ─────────────── 2FA Verify & Enable ─────────────── */
const twoFactorVerifySchema = z.object({ code: z.string().length(6) });

auth.post('/2fa/verify', requireAuth, validateJson(twoFactorVerifySchema), async (c) => {
  const userId = c.get('userId')!;
  const { code } = c.req.valid('json');

  const rows = await db.select().from(twoFactorAuth).where(eq(twoFactorAuth.userId, userId)).limit(1);
  if (rows.length === 0) throw new BadRequestError('2FA not set up');

  const tfa = rows[0];
  const valid = authenticator.check(code, tfa.secret);
  if (!valid) throw new UnauthorizedError('Invalid 2FA code');

  await db.update(twoFactorAuth).set({ enabled: true }).where(eq(twoFactorAuth.userId, userId));

  return c.json({ success: true, data: { enabled: true } });
});

/* ─────────────── 2FA Disable ─────────────── */
const twoFactorDisableSchema = z.object({ code: z.string().length(6) });

auth.post('/2fa/disable', requireAuth, validateJson(twoFactorDisableSchema), async (c) => {
  const userId = c.get('userId')!;
  const { code } = c.req.valid('json');

  const rows = await db.select().from(twoFactorAuth).where(eq(twoFactorAuth.userId, userId)).limit(1);
  if (rows.length === 0 || !rows[0].enabled) {
    throw new BadRequestError('2FA not enabled');
  }

  const valid = authenticator.check(code, rows[0].secret);
  if (!valid) throw new UnauthorizedError('Invalid 2FA code');

  await db.delete(twoFactorAuth).where(eq(twoFactorAuth.userId, userId));

  return c.json({ success: true });
});

/* ─────────────── Sessions ─────────────── */
auth.get('/sessions', requireAuth, async (c) => {
  const userId = c.get('userId')!;
  const rows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(sessions.createdAt);

  return c.json({
    success: true,
    data: rows.map((s) => ({
      id: s.id,
      ipAddress: s.ipAddress,
      deviceInfo: s.deviceInfo,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    })),
  });
});

auth.delete('/sessions/:id', requireAuth, async (c) => {
  const userId = c.get('userId')!;
  const sessionId = c.req.param('id');

  const rows = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  if (rows.length === 0 || rows[0].userId !== userId) throw new NotFoundError('Session not found');

  await db.delete(sessions).where(eq(sessions.id, sessionId));
  return c.json({ success: true });
});

auth.delete('/sessions', requireAuth, async (c) => {
  const userId = c.get('userId')!;
  const currentSessionId = c.get('sessionId')!;

  await db
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), ne(sessions.id, currentSessionId)));
  clearSessionCookie(c);
  clearSessionCookie(c);

  return c.json({ success: true });
});

export default auth;
