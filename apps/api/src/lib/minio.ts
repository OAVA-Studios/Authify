import { Client } from 'minio';
import { env } from './env.js';

export const minioClient = new Client({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: env.NODE_ENV === 'production' || env.MINIO_PORT === 443,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
});

export const bucketPrefix = env.MINIO_BUCKET_PREFIX;

export function getBucketName(projectId: string): string {
  return `${bucketPrefix}-${projectId}`;
}
