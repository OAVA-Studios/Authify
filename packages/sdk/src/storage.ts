import type { AuthifyClient } from './client.js';
import type { StorageBucket, StorageFile, UploadInitResponse, PaginatedResponse } from './types.js';

export class AuthifyStorage {
  constructor(private client: AuthifyClient) {}

  /* ── Buckets ── */
  async createBucket(body: {
    name: string;
    public?: boolean;
    maxFileSize?: number;
    allowedMimeTypes?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<StorageBucket> {
    return this.client.post('/v1/storage/buckets', body);
  }

  async listBuckets(): Promise<StorageBucket[]> {
    return this.client.get('/v1/storage/buckets');
  }

  async getBucket(id: string): Promise<StorageBucket> {
    return this.client.get(`/v1/storage/buckets/${id}`);
  }

  async updateBucket(
    id: string,
    body: {
      name?: string;
      public?: boolean;
      maxFileSize?: number;
      allowedMimeTypes?: string[];
      metadata?: Record<string, unknown>;
    }
  ): Promise<StorageBucket> {
    return this.client.patch(`/v1/storage/buckets/${id}`, body);
  }

  async deleteBucket(id: string): Promise<void> {
    return this.client.delete(`/v1/storage/buckets/${id}`);
  }

  /* ── Upload ── */
  async uploadFile(
    bucketId: string,
    file: Blob | ArrayBuffer | Uint8Array,
    options?: { path?: string }
  ): Promise<StorageFile> {
    const query = new URLSearchParams();
    query.set('bucketId', bucketId);
    if (options?.path) query.set('path', options.path);
    return this.client.upload(`/v1/storage/upload?${query.toString()}`, file);
  }

  async initChunkedUpload(body: {
    bucketId: string;
    name: string;
    totalChunks: number;
    mimeType: string;
  }): Promise<UploadInitResponse> {
    return this.client.post('/v1/storage/uploads/init', body);
  }

  async uploadChunk(
    uploadId: string,
    chunkNumber: number,
    totalChunks: number,
    chunk: Blob | ArrayBuffer | Uint8Array
  ): Promise<{ chunkNumber: number; received: number }> {
    const query = new URLSearchParams();
    query.set('uploadId', uploadId);
    query.set('chunkNumber', String(chunkNumber));
    query.set('totalChunks', String(totalChunks));
    return this.client.upload(`/v1/storage/uploads/chunk?${query.toString()}`, chunk);
  }

  async completeChunkedUpload(body: {
    uploadId: string;
    bucketId: string;
    name: string;
    totalChunks: number;
    mimeType: string;
  }): Promise<StorageFile> {
    return this.client.post('/v1/storage/uploads/complete', body);
  }

  /* ── Files ── */
  async listFiles(
    bucketId: string,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<StorageFile[]>> {
    const query = new URLSearchParams();
    query.set('bucketId', bucketId);
    if (params?.page !== undefined) query.set('page', String(params.page));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    return this.client.getPaginated(`/v1/storage/files?${query.toString()}`);
  }

  async getFile(id: string): Promise<StorageFile> {
    return this.client.get(`/v1/storage/files/${id}`);
  }

  async downloadFile(id: string): Promise<Blob> {
    return this.client.download(`/v1/storage/files/${id}/download`);
  }

  async deleteFile(id: string): Promise<void> {
    return this.client.delete(`/v1/storage/files/${id}`);
  }

  async transformImage(
    id: string,
    params?: {
      w?: number;
      h?: number;
      q?: number;
      f?: 'jpeg' | 'png' | 'webp' | 'avif';
      fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
    }
  ): Promise<Blob> {
    const query = new URLSearchParams();
    if (params?.w !== undefined) query.set('w', String(params.w));
    if (params?.h !== undefined) query.set('h', String(params.h));
    if (params?.q !== undefined) query.set('q', String(params.q));
    if (params?.f) query.set('f', params.f);
    if (params?.fit) query.set('fit', params.fit);
    return this.client.download(`/v1/storage/files/${id}/transform?${query.toString()}`);
  }
}
