import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db } from '@authify/db';
import { users, oauthAccounts, sessions } from '@authify/db/schema';
import { BadRequestError, UnauthorizedError } from '@authify/shared';
import { v4 as uuidv4 } from 'uuid';
import { getOAuthConfig, getOAuthClientCredentials, exchangeCodeForToken } from '../services/oauth.js';
import { createAccessToken, createRefreshToken } from '../services/jwt.js';
import { logAudit } from '../services/audit.js';
import { env } from '../lib/env.js';
import { requireAuth } from '../middleware/auth.js';
import type { Variables } from '../types/context.js';

const oauth = new Hono<{ Variables: Variables }>();

function resolveProjectId(c: import('hono').Context): string {
  return c.req.header('x-project-id') ?? c.req.header('x-api-key')?.slice(0, 36) ?? '';
}

function setSessionCookie(c: import('hono').Context, token: string) {
  const secure = env.NODE_ENV === 'production';
  const maxAge = 60 * 60 * 24 * 30;
  c.header(
    'Set-Cookie',
    `authify_session=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure ? '; Secure' : ''}`
  );
}

/* ─────────────── OAuth Authorize ─────────────── */
oauth.get('/:provider', async (c) => {
  const provider = c.req.param('provider').toLowerCase();
  const projectId = resolveProjectId(c);
  if (!projectId) throw new BadRequestError('Project ID required');

  const config = getOAuthConfig(provider);
  const creds = getOAuthClientCredentials(provider);
  if (!config || !creds) throw new BadRequestError('OAuth provider not configured');

  const redirectUri = `${env.API_URL}/v1/auth/oauth/${provider}/callback`;
  const state = Buffer.from(
    JSON.stringify({ projectId, redirectUri, nonce: uuidv4() })
  ).toString('base64url');

  const url = new URL(config.authorizeUrl);
  url.searchParams.set('client_id', creds.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', config.scopes.join(' '));
  url.searchParams.set('state', state);

  if (provider === 'google') {
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
  }

  return c.redirect(url.toString());
});

/* ─────────────── OAuth Callback ─────────────── */
oauth.get('/:provider/callback', async (c) => {
  const provider = c.req.param('provider').toLowerCase();
  const code = c.req.query('code');
  const stateParam = c.req.query('state');
  const error = c.req.query('error');

  if (error) throw new BadRequestError(`OAuth error: ${error}`);
  if (!code || !stateParam) throw new BadRequestError('Missing code or state');

  let state: { projectId: string; redirectUri: string };
  try {
    state = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
  } catch {
    throw new BadRequestError('Invalid state');
  }

  const config = getOAuthConfig(provider);
  if (!config) throw new BadRequestError('OAuth provider not configured');

  const accessToken = await exchangeCodeForToken(provider, code, state.redirectUri);
  const profile = await config.getUserInfo(accessToken);

  // Find or create user
  const existingOauth = await db
    .select()
    .from(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.projectId, state.projectId),
        eq(oauthAccounts.provider, provider),
        eq(oauthAccounts.providerAccountId, profile.id)
      )
    )
    .limit(1);

  let userId: string;

  if (existingOauth.length > 0) {
    userId = existingOauth[0].userId;
    await db
      .update(oauthAccounts)
      .set({ accessToken, updatedAt: new Date() })
      .where(eq(oauthAccounts.id, existingOauth[0].id));
  } else {
    // Check if user with same email exists
    const emailUsers = await db
      .select()
      .from(users)
      .where(and(eq(users.projectId, state.projectId), eq(users.email, profile.email.toLowerCase())))
      .limit(1);

    if (emailUsers.length > 0) {
      userId = emailUsers[0].id;
    } else {
      const [user] = await db
        .insert(users)
        .values({
          projectId: state.projectId,
          email: profile.email.toLowerCase(),
          emailVerified: true,
          metadata: { name: profile.name, avatar: profile.avatar },
        })
        .returning();
      userId = user.id;
    }

    await db.insert(oauthAccounts).values({
      userId,
      projectId: state.projectId,
      provider,
      providerAccountId: profile.id,
      accessToken,
      metadata: { name: profile.name, avatar: profile.avatar },
    });
  }

  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userRows[0];

  const session = await db
    .insert(sessions)
    .values({
      userId: user.id,
      projectId: state.projectId,
      token: uuidv4(),
      refreshToken: uuidv4(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? undefined,
      deviceInfo: { userAgent: c.req.header('user-agent') ?? undefined },
    })
    .returning()
    .then((r) => r[0]);

  const accessJwt = await createAccessToken(user.id, state.projectId, user.role);
  const refreshJwt = await createRefreshToken(session.id);

  await db
    .update(sessions)
    .set({ token: accessJwt, refreshToken: refreshJwt })
    .where(eq(sessions.id, session.id));

  setSessionCookie(c, accessJwt);

  await logAudit({
    projectId: state.projectId,
    userId: user.id,
    action: 'user.oauth_login',
    resourceType: 'session',
    resourceId: session.id,
    metadata: { provider },
    ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? undefined,
    userAgent: c.req.header('user-agent') ?? undefined,
  });

  return c.json({
    success: true,
    data: {
      accessToken: accessJwt,
      refreshToken: refreshJwt,
      expiresIn: 900,
      user: { id: user.id, email: user.email, role: user.role, emailVerified: user.emailVerified },
    },
  });
});

/* ─────────────── Link OAuth Account ─────────────── */
oauth.post('/:provider/link', requireAuth, async (c) => {
  const provider = c.req.param('provider').toLowerCase();
  const userId = c.get('userId')!;
  const projectId = c.get('projectId')!;

  const body = await c.req.json().catch(() => ({}));
  const { code } = body as { code?: string };
  if (!code) throw new BadRequestError('Authorization code required');

  const redirectUri = `${env.API_URL}/v1/auth/oauth/${provider}/callback`;
  const accessToken = await exchangeCodeForToken(provider, code, redirectUri);
  const config = getOAuthConfig(provider);
  if (!config) throw new BadRequestError('OAuth provider not configured');

  const profile = await config.getUserInfo(accessToken);

  const existing = await db
    .select()
    .from(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.projectId, projectId),
        eq(oauthAccounts.provider, provider),
        eq(oauthAccounts.providerAccountId, profile.id)
      )
    )
    .limit(1);

  if (existing.length > 0 && existing[0].userId !== userId) {
    throw new UnauthorizedError('Account already linked to another user');
  }

  if (existing.length > 0) {
    await db
      .update(oauthAccounts)
      .set({ accessToken, updatedAt: new Date() })
      .where(eq(oauthAccounts.id, existing[0].id));
  } else {
    await db.insert(oauthAccounts).values({
      userId,
      projectId,
      provider,
      providerAccountId: profile.id,
      accessToken,
      metadata: { name: profile.name, avatar: profile.avatar },
    });
  }

  return c.json({ success: true, data: { provider, linked: true } });
});

/* ─────────────── Unlink OAuth Account ─────────────── */
oauth.delete('/:provider/link', requireAuth, async (c) => {
  const provider = c.req.param('provider').toLowerCase();
  const userId = c.get('userId')!;
  const projectId = c.get('projectId')!;

  await db
    .delete(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.userId, userId),
        eq(oauthAccounts.projectId, projectId),
        eq(oauthAccounts.provider, provider)
      )
    );

  return c.json({ success: true });
});

/* ─────────────── List Linked Accounts ─────────────── */
oauth.get('/accounts', requireAuth, async (c) => {
  const userId = c.get('userId')!;

  const rows = await db
    .select()
    .from(oauthAccounts)
    .where(eq(oauthAccounts.userId, userId));

  return c.json({
    success: true,
    data: rows.map((r) => ({
      provider: r.provider,
      providerAccountId: r.providerAccountId,
      createdAt: r.createdAt,
    })),
  });
});

export default oauth;
