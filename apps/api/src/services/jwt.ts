import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { env } from '../lib/env.js';

const privateKey = await crypto.subtle.importKey(
  'pkcs8',
  pemToArrayBuffer(env.JWT_PRIVATE_KEY, 'PRIVATE KEY'),
  { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
  false,
  ['sign']
);

const publicKey = await crypto.subtle.importKey(
  'spki',
  pemToArrayBuffer(env.JWT_PUBLIC_KEY, 'PUBLIC KEY'),
  { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
  false,
  ['verify']
);

function pemToArrayBuffer(pem: string, label: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, '\n');
  const b64 = normalized
    .replace(new RegExp(`-----BEGIN ${label}-----`), '')
    .replace(new RegExp(`-----END ${label}-----`), '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export interface AccessTokenPayload extends JWTPayload {
  sub: string; // userId
  projectId: string;
  role: string;
  type: 'access';
}

export interface RefreshTokenPayload extends JWTPayload {
  sub: string; // sessionId
  type: 'refresh';
}

export async function createAccessToken(
  userId: string,
  projectId: string,
  role: string
): Promise<string> {
  return new SignJWT({ projectId, role, type: 'access' })
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setIssuer('authify')
    .setAudience('authify-api')
    .setExpirationTime('15m')
    .sign(privateKey);
}

export async function createRefreshToken(sessionId: string): Promise<string> {
  return new SignJWT({ type: 'refresh' })
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject(sessionId)
    .setIssuedAt()
    .setIssuer('authify')
    .setAudience('authify-api')
    .setExpirationTime('30d')
    .sign(privateKey);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, publicKey, {
    issuer: 'authify',
    audience: 'authify-api',
    clockTolerance: 60,
  });
  if (payload.type !== 'access') throw new Error('Invalid token type');
  return payload as AccessTokenPayload;
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, publicKey, {
    issuer: 'authify',
    audience: 'authify-api',
    clockTolerance: 60,
  });
  if (payload.type !== 'refresh') throw new Error('Invalid token type');
  return payload as RefreshTokenPayload;
}
