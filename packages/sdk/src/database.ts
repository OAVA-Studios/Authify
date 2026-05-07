import type { AuthifyClient } from './client.js';
import type { Collection, CollectionPolicy, Document, DocumentListMeta } from './types.js';

export class AuthifyDatabase {
  constructor(private client: AuthifyClient) {}

  /* ── Collections ── */
  async createCollection(body: {
    name: string;
    tableName: string;
    schema: Record<string, unknown>;
    rlsEnabled?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<Collection> {
    return this.client.post('/v1/database/collections', body);
  }

  async listCollections(): Promise<Collection[]> {
    return this.client.get('/v1/database/collections');
  }

  async getCollection(id: string): Promise<Collection> {
    return this.client.get(`/v1/database/collections/${id}`);
  }

  async updateCollection(
    id: string,
    body: {
      name?: string;
      schema?: Record<string, unknown>;
      rlsEnabled?: boolean;
      metadata?: Record<string, unknown>;
    }
  ): Promise<Collection> {
    return this.client.patch(`/v1/database/collections/${id}`, body);
  }

  async deleteCollection(id: string): Promise<void> {
    return this.client.delete(`/v1/database/collections/${id}`);
  }

  /* ── Policies ── */
  async createPolicy(
    collectionId: string,
    body: {
      name: string;
      operation: 'read' | 'write' | 'delete' | 'all';
      condition: Record<string, unknown>;
      role?: string;
      enabled?: boolean;
    }
  ): Promise<CollectionPolicy> {
    return this.client.post(`/v1/database/collections/${collectionId}/policies`, body);
  }

  async listPolicies(collectionId: string): Promise<CollectionPolicy[]> {
    return this.client.get(`/v1/database/collections/${collectionId}/policies`);
  }

  async updatePolicy(
    policyId: string,
    body: {
      name?: string;
      operation?: 'read' | 'write' | 'delete' | 'all';
      condition?: Record<string, unknown>;
      role?: string | null;
      enabled?: boolean;
    }
  ): Promise<CollectionPolicy> {
    return this.client.patch(`/v1/database/policies/${policyId}`, body);
  }

  async deletePolicy(policyId: string): Promise<void> {
    return this.client.delete(`/v1/database/policies/${policyId}`);
  }

  /* ── Documents ── */
  async listDocuments(
    collectionName: string,
    params?: {
      cursor?: string;
      limit?: number;
      orderBy?: string;
      order?: 'asc' | 'desc';
      filter?: Record<string, unknown>;
    }
  ): Promise<{ data: Document[]; meta: DocumentListMeta }> {
    const query = new URLSearchParams();
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.orderBy) query.set('orderBy', params.orderBy);
    if (params?.order) query.set('order', params.order);
    if (params?.filter) query.set('filter', JSON.stringify(params.filter));
    return this.client.get(`/v1/database/collections/${collectionName}/documents?${query.toString()}`);
  }

  async createDocument(
    collectionName: string,
    body: { id?: string; data: Record<string, unknown> }
  ): Promise<Document> {
    return this.client.post(`/v1/database/collections/${collectionName}/documents`, body);
  }

  async getDocument(collectionName: string, docId: string): Promise<Document> {
    return this.client.get(`/v1/database/collections/${collectionName}/documents/${docId}`);
  }

  async updateDocument(
    collectionName: string,
    docId: string,
    body: { data: Record<string, unknown> }
  ): Promise<Document> {
    return this.client.patch(`/v1/database/collections/${collectionName}/documents/${docId}`, body);
  }

  async deleteDocument(collectionName: string, docId: string): Promise<void> {
    return this.client.delete(`/v1/database/collections/${collectionName}/documents/${docId}`);
  }
}
