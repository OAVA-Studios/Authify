import { Hono } from 'hono';
import { eq, and, count } from 'drizzle-orm';
import { db } from '@authify/db';
import { storageBuckets, storageFiles } from '@authify/db/schema';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '@authify/shared';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.js';
import { projectAuth } from '../middleware/project-auth.js';
import { validateJson, validateQuery } from '../middleware/index.js';
import {
  ensureBucket,
  deleteBucket,
  uploadFile,
  uploadChunk,
  completeMultipartUpload,
  getPresignedUrl,
  getFileStream,
  deleteFile,
  transformImage,
  getPublicUrl,
} from '../services/storage.js';
import { getBucketName } from '../lib/minio.js';
import { logAudit } from '../services/audit.js';
import type { Variables } from '../types/context.js';

const storage = new Hono<{ Variables: Variables }>();

function isAdmin(c: import('hono').Context): boolean {
  return c.get('role') === 'admin';
}

/* ───────────────────── Buckets ───────────────────── */

const createBucketSchema = z.object({
  name: z.string().min(1).max(256),
  public: z.boolean().default(false),
  maxFileSize: z.number().int().min(1).max(10737418240).default(1073741824), // 1GB
  allowedMimeTypes: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).optional(),
});

storage.post('/buckets', requireAuth, validateJson(createBucketSchema), async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const body = c.req.valid('json');

  const existing = await db
    .select()
    .from(storageBuckets)
    .where(and(eq(storageBuckets.projectId, projectId), eq(storageBuckets.name, body.name)))
    .limit(1);

  if (existing.length > 0) throw new ConflictError('Bucket with this name already exists');

  // Ensure MinIO bucket exists
  await ensureBucket(projectId);

  const [bucket] = await db
    .insert(storageBuckets)
    .values({
      projectId,
      name: body.name,
      public: body.public,
      maxFileSize: body.maxFileSize,
      allowedMimeTypes: body.allowedMimeTypes,
      metadata: body.metadata ?? {},
    })
    .returning();

  await logAudit({
    projectId,
    userId: c.get('userId')!,
    action: 'storage.bucket.create',
    resourceType: 'storage_bucket',
    resourceId: bucket.id,
    ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? undefined,
    userAgent: c.req.header('user-agent') ?? undefined,
  });

  return c.json({ success: true, data: bucket }, 201);
});

storage.get('/buckets', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();

  const rows = await db
    .select()
    .from(storageBuckets)
    .where(eq(storageBuckets.projectId, projectId))
    .orderBy(storageBuckets.createdAt);

  return c.json({ success: true, data: rows });
});

storage.get('/buckets/:id', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  const id = c.req.param('id');

  const rows = await db
    .select()
    .from(storageBuckets)
    .where(and(eq(storageBuckets.id, id), eq(storageBuckets.projectId, projectId)))
    .limit(1);

  if (rows.length === 0) throw new NotFoundError('Bucket not found');
  return c.json({ success: true, data: rows[0] });
});

const updateBucketSchema = z.object({
  name: z.string().min(1).max(256).optional(),
  public: z.boolean().optional(),
  maxFileSize: z.number().int().min(1).max(10737418240).optional(),
  allowedMimeTypes: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

storage.patch('/buckets/:id', requireAuth, validateJson(updateBucketSchema), async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.public !== undefined) updates.public = body.public;
  if (body.maxFileSize !== undefined) updates.maxFileSize = body.maxFileSize;
  if (body.allowedMimeTypes !== undefined) updates.allowedMimeTypes = body.allowedMimeTypes;
  if (body.metadata !== undefined) updates.metadata = body.metadata;
  updates.updatedAt = new Date();

  const rows = await db
    .update(storageBuckets)
    .set(updates)
    .where(and(eq(storageBuckets.id, id), eq(storageBuckets.projectId, projectId)))
    .returning();

  if (rows.length === 0) throw new NotFoundError('Bucket not found');
  return c.json({ success: true, data: rows[0] });
});

storage.delete('/buckets/:id', requireAuth, async (c) => {
  const projectId = c.get('projectId')!;
  if (!isAdmin(c)) throw new ForbiddenError();
  const id = c.req.param('id');

  const bucketRows = await db
    .select()
    .from(storageBuckets)
    .where(and(eq(storageBuckets.id, id), eq(storageBuckets.projectId, projectId)))
    .limit(1);

  if (bucketRows.length === 0) throw new NotFoundError('Bucket not found');

  // Delete all files from MinIO
  const files = await db
    .select()
    .from(storageFiles)
    .where(eq(storageFiles.bucketId, id));

  const bucketName = getBucketName(projectId);
  for (const file of files) {
    await deleteFile(bucketName, file.path);
  }

  await db.delete(storageFiles).where(eq(storageFiles.bucketId, id));
  await db
    .delete(storageBuckets)
    .where(and(eq(storageBuckets.id, id), eq(storageBuckets.projectId, projectId)));

  return c.json({ success: true });
});

/* ───────────────────── Files ───────────────────── */

const uploadQuery = z.object({
  bucketId: z.string().uuid(),
  path: z.string().min(1).max(512).optional(),
});

storage.post('/upload', projectAuth, validateQuery(uploadQuery), async (c) => {
  const projectId = c.get('projectId')!;
  const q = c.req.valid('query');

  const bucketRows = await db
    .select()
    .from(storageBuckets)
    .where(and(eq(storageBuckets.id, q.bucketId), eq(storageBuckets.projectId, projectId)))
    .limit(1);

  if (bucketRows.length === 0) throw new NotFoundError('Bucket not found');
  const bucket = bucketRows[0];

  const body = await c.req.blob();
  if (!body || body.size === 0) throw new BadRequestError('No file provided');

  if (body.size > bucket.maxFileSize) {
    throw new BadRequestError(`File exceeds max size of ${bucket.maxFileSize} bytes`);
  }

  const allowed = bucket.allowedMimeTypes as string[];
  if (allowed.length > 0 && !allowed.includes(body.type)) {
    throw new BadRequestError(`File type ${body.type} not allowed`);
  }

  const buffer = Buffer.from(await body.arrayBuffer());
  const filePath = q.path ?? `${uuidv4()}/${body.type.split('/')[1] ?? 'bin'}`;
  const bucketName = getBucketName(projectId);

  const result = await uploadFile(bucketName, filePath, buffer, body.type);

  const [file] = await db
    .insert(storageFiles)
    .values({
      bucketId: q.bucketId,
      projectId,
      name: filePath.split('/').pop() ?? filePath,
      path: filePath,
      mimeType: body.type,
      size: body.size,
      etag: result.etag,
      metadata: {},
    })
    .returning();

  const url = bucket.public ? getPublicUrl(projectId, filePath) : await getPresignedUrl(bucketName, filePath);

  return c.json({
    success: true,
    data: {
      ...file,
      url,
    },
  }, 201);
});

/* ───────────────────── Chunked Upload ───────────────────── */

const initUploadSchema = z.object({
  bucketId: z.string().uuid(),
  name: z.string().min(1).max(512),
  totalChunks: z.number().int().min(1).max(1000),
  mimeType: z.string().min(1).max(256),
});

storage.post('/uploads/init', projectAuth, validateJson(initUploadSchema), async (c) => {
  const projectId = c.get('projectId')!;
  const body = c.req.valid('json');

  const bucketRows = await db
    .select()
    .from(storageBuckets)
    .where(and(eq(storageBuckets.id, body.bucketId), eq(storageBuckets.projectId, projectId)))
    .limit(1);

  if (bucketRows.length === 0) throw new NotFoundError('Bucket not found');

  const uploadId = uuidv4();

  return c.json({
    success: true,
    data: { uploadId, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString() },
  });
});

const uploadChunkSchema = z.object({
  uploadId: z.string().uuid(),
  chunkNumber: z.number().int().min(1),
  totalChunks: z.number().int().min(1),
});

storage.post('/uploads/chunk', projectAuth, validateQuery(uploadChunkSchema), async (c) => {
  const projectId = c.get('projectId')!;
  const q = c.req.valid('query');

  const body = await c.req.blob();
  if (!body || body.size === 0) throw new BadRequestError('No chunk data provided');

  const buffer = Buffer.from(await body.arrayBuffer());
  const bucketName = getBucketName(projectId);

  await uploadChunk(bucketName, q.uploadId, q.chunkNumber, buffer);

  return c.json({ success: true, data: { chunkNumber: q.chunkNumber, received: buffer.length } });
});

const completeUploadSchema = z.object({
  uploadId: z.string().uuid(),
  bucketId: z.string().uuid(),
  name: z.string().min(1).max(512),
  totalChunks: z.number().int().min(1),
  mimeType: z.string().min(1).max(256),
});

storage.post('/uploads/complete', projectAuth, validateJson(completeUploadSchema), async (c) => {
  const projectId = c.get('projectId')!;
  const body = c.req.valid('json');

  const bucketRows = await db
    .select()
    .from(storageBuckets)
    .where(and(eq(storageBuckets.id, body.bucketId), eq(storageBuckets.projectId, projectId)))
    .limit(1);

  if (bucketRows.length === 0) throw new NotFoundError('Bucket not found');
  const bucket = bucketRows[0];

  const filePath = `${uuidv4()}/${body.name}`;
  const bucketName = getBucketName(projectId);

  const result = await completeMultipartUpload(
    bucketName,
    body.uploadId,
    body.totalChunks,
    filePath,
    body.mimeType
  );

  const [file] = await db
    .insert(storageFiles)
    .values({
      bucketId: body.bucketId,
      projectId,
      name: body.name,
      path: filePath,
      mimeType: body.mimeType,
      size: result.size,
      etag: result.etag,
      metadata: {},
    })
    .returning();

  const url = bucket.public ? getPublicUrl(projectId, filePath) : await getPresignedUrl(bucketName, filePath);

  return c.json({
    success: true,
    data: {
      ...file,
      url,
    },
  });
});

/* ───────────────────── File Operations ───────────────────── */

const listFilesQuery = z.object({
  bucketId: z.string().uuid(),
  page: z.string().default('1').transform(Number),
  limit: z.string().default('50').transform(Number),
});

storage.get('/files', projectAuth, validateQuery(listFilesQuery), async (c) => {
  const projectId = c.get('projectId')!;
  const q = c.req.valid('query');

  const bucketRows = await db
    .select()
    .from(storageBuckets)
    .where(and(eq(storageBuckets.id, q.bucketId), eq(storageBuckets.projectId, projectId)))
    .limit(1);

  if (bucketRows.length === 0) throw new NotFoundError('Bucket not found');

  const offset = (q.page - 1) * q.limit;
  const [rows, totalResult] = await Promise.all([
    db
      .select()
      .from(storageFiles)
      .where(and(eq(storageFiles.bucketId, q.bucketId), eq(storageFiles.projectId, projectId)))
      .limit(q.limit)
      .offset(offset)
      .orderBy(storageFiles.createdAt),
    db
      .select({ count: count() })
      .from(storageFiles)
      .where(and(eq(storageFiles.bucketId, q.bucketId), eq(storageFiles.projectId, projectId))),
  ]);

  const bucketName = getBucketName(projectId);
  const filesWithUrls = await Promise.all(
    rows.map(async (file) => ({
      ...file,
      url: bucketRows[0].public
        ? getPublicUrl(projectId, file.path)
        : await getPresignedUrl(bucketName, file.path, 3600),
    }))
  );

  return c.json({
    success: true,
    data: filesWithUrls,
    meta: {
      page: q.page,
      limit: q.limit,
      total: totalResult[0]?.count ?? 0,
      totalPages: Math.ceil((totalResult[0]?.count ?? 0) / q.limit),
    },
  });
});

storage.get('/files/:id', projectAuth, async (c) => {
  const projectId = c.get('projectId')!;
  const id = c.req.param('id');

  const rows = await db
    .select()
    .from(storageFiles)
    .where(and(eq(storageFiles.id, id), eq(storageFiles.projectId, projectId)))
    .limit(1);

  if (rows.length === 0) throw new NotFoundError('File not found');
  const file = rows[0];

  const bucketRows = await db
    .select()
    .from(storageBuckets)
    .where(eq(storageBuckets.id, file.bucketId))
    .limit(1);

  const bucketName = getBucketName(projectId);
  const url = bucketRows[0]?.public
    ? getPublicUrl(projectId, file.path)
    : await getPresignedUrl(bucketName, file.path, 3600);

  return c.json({
    success: true,
    data: { ...file, url },
  });
});

storage.get('/files/:id/download', projectAuth, async (c) => {
  const projectId = c.get('projectId')!;
  const id = c.req.param('id');

  const rows = await db
    .select()
    .from(storageFiles)
    .where(and(eq(storageFiles.id, id), eq(storageFiles.projectId, projectId)))
    .limit(1);

  if (rows.length === 0) throw new NotFoundError('File not found');
  const file = rows[0];

  const bucketName = getBucketName(projectId);
  const stream = await getFileStream(bucketName, file.path);

  c.header('Content-Type', file.mimeType);
  c.header('Content-Disposition', `attachment; filename="${file.name}"`);

  return new Response(stream as unknown as ReadableStream, { status: 200 });
});

storage.delete('/files/:id', projectAuth, async (c) => {
  const projectId = c.get('projectId')!;
  const id = c.req.param('id');

  const rows = await db
    .select()
    .from(storageFiles)
    .where(and(eq(storageFiles.id, id), eq(storageFiles.projectId, projectId)))
    .limit(1);

  if (rows.length === 0) throw new NotFoundError('File not found');
  const file = rows[0];

  const bucketName = getBucketName(projectId);
  await deleteFile(bucketName, file.path);

  await db
    .delete(storageFiles)
    .where(and(eq(storageFiles.id, id), eq(storageFiles.projectId, projectId)));

  return c.json({ success: true });
});

/* ───────────────────── Image Transformations ───────────────────── */

const transformQuery = z.object({
  w: z.string().optional().transform((v) => (v ? Number(v) : undefined)),
  h: z.string().optional().transform((v) => (v ? Number(v) : undefined)),
  q: z.string().optional().transform((v) => (v ? Number(v) : undefined)),
  f: z.enum(['jpeg', 'png', 'webp', 'avif']).optional(),
  fit: z.enum(['cover', 'contain', 'fill', 'inside', 'outside']).optional(),
});

storage.get('/files/:id/transform', projectAuth, validateQuery(transformQuery), async (c) => {
  const projectId = c.get('projectId')!;
  const id = c.req.param('id');
  const q = c.req.valid('query');

  const rows = await db
    .select()
    .from(storageFiles)
    .where(and(eq(storageFiles.id, id), eq(storageFiles.projectId, projectId)))
    .limit(1);

  if (rows.length === 0) throw new NotFoundError('File not found');
  const file = rows[0];

  if (!file.mimeType.startsWith('image/')) {
    throw new BadRequestError('Transformations only supported for images');
  }

  const bucketName = getBucketName(projectId);
  const transformed = await transformImage(bucketName, file.path, {
    width: q.w,
    height: q.h,
    quality: q.q,
    format: q.f,
    fit: q.fit,
  });

  const contentType = q.f ? `image/${q.f}` : file.mimeType;
  c.header('Content-Type', contentType);
  c.header('Cache-Control', 'public, max-age=86400');

  return new Response(transformed, { status: 200 });
});

export default storage;
