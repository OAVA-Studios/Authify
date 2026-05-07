import { minioClient, getBucketName } from '../lib/minio.js';
import { env } from '../lib/env.js';
import { BadRequestError, NotFoundError, InternalError } from '@authify/shared';
import sharp from 'sharp';

export async function ensureBucket(projectId: string): Promise<string> {
  const bucket = getBucketName(projectId);
  const exists = await minioClient.bucketExists(bucket);
  if (!exists) {
    await minioClient.makeBucket(bucket, 'us-east-1');
    const policy = {
      Version: '2012-10-17',
      Statement: [],
    };
    await minioClient.setBucketPolicy(bucket, JSON.stringify(policy));
  }
  return bucket;
}

export async function deleteBucket(projectId: string): Promise<void> {
  const bucket = getBucketName(projectId);
  const exists = await minioClient.bucketExists(bucket);
  if (!exists) return;

  const objects = await listAllObjects(bucket, '');
  for (const obj of objects) {
    await minioClient.removeObject(bucket, obj);
  }
  await minioClient.removeBucket(bucket);
}

async function listAllObjects(bucket: string, prefix: string): Promise<string[]> {
  const stream = minioClient.listObjectsV2(bucket, prefix, true);
  const objects: string[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (obj) => {
      if (obj.name) objects.push(obj.name);
    });
    stream.on('end', () => resolve(objects));
    stream.on('error', reject);
  });
}

export async function uploadFile(
  bucket: string,
  path: string,
  data: Buffer,
  mimeType: string
): Promise<{ etag: string; size: number }> {
  const result = await minioClient.putObject(bucket, path, data, data.length, {
    'Content-Type': mimeType,
  });
  return { etag: result.etag, size: data.length };
}

export async function uploadChunk(
  bucket: string,
  uploadId: string,
  chunkNumber: number,
  data: Buffer
): Promise<void> {
  const path = `_chunks/${uploadId}/${chunkNumber}`;
  await minioClient.putObject(bucket, path, data, data.length);
}

export async function completeMultipartUpload(
  bucket: string,
  uploadId: string,
  totalChunks: number,
  finalPath: string,
  mimeType: string
): Promise<{ etag: string; size: number }> {
  const chunks: Buffer[] = [];
  let totalSize = 0;

  for (let i = 1; i <= totalChunks; i++) {
    const chunkPath = `_chunks/${uploadId}/${i}`;
    const stream = await minioClient.getObject(bucket, chunkPath);
    const buffer = await streamToBuffer(stream);
    chunks.push(buffer);
    totalSize += buffer.length;
  }

  const merged = Buffer.concat(chunks);
  const result = await minioClient.putObject(bucket, finalPath, merged, merged.length, {
    'Content-Type': mimeType,
  });

  // Cleanup chunks
  for (let i = 1; i <= totalChunks; i++) {
    await minioClient.removeObject(bucket, `_chunks/${uploadId}/${i}`);
  }

  return { etag: result.etag, size: totalSize };
}

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

export async function getPresignedUrl(
  bucket: string,
  path: string,
  expirySeconds = 3600
): Promise<string> {
  return minioClient.presignedGetObject(bucket, path, expirySeconds);
}

export async function getFileStream(bucket: string, path: string): Promise<NodeJS.ReadableStream> {
  return minioClient.getObject(bucket, path);
}

export async function deleteFile(bucket: string, path: string): Promise<void> {
  await minioClient.removeObject(bucket, path);
}

export async function transformImage(
  bucket: string,
  path: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp' | 'avif';
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  }
): Promise<Buffer> {
  const stream = await minioClient.getObject(bucket, path);
  const buffer = await streamToBuffer(stream);

  let pipeline = sharp(buffer);

  if (options.width || options.height) {
    pipeline = pipeline.resize(options.width, options.height, {
      fit: options.fit ?? 'cover',
      withoutEnlargement: true,
    });
  }

  const format = options.format ?? 'jpeg';
  switch (format) {
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality: options.quality ?? 80, progressive: true });
      break;
    case 'png':
      pipeline = pipeline.png({ quality: options.quality ?? 80 });
      break;
    case 'webp':
      pipeline = pipeline.webp({ quality: options.quality ?? 80 });
      break;
    case 'avif':
      pipeline = pipeline.avif({ quality: options.quality ?? 80 });
      break;
  }

  return pipeline.toBuffer();
}

export function getPublicUrl(projectId: string, path: string): string {
  const bucket = getBucketName(projectId);
  if (env.NODE_ENV === 'production') {
    return `https://${env.MINIO_ENDPOINT}/${bucket}/${path}`;
  }
  return `http://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}/${bucket}/${path}`;
}
