import { db } from '@authify/db';
import { auditLogs } from '@authify/db/schema';
import type { NewAuditLog } from '@authify/db/schema';

export async function logAudit(entry: Omit<NewAuditLog, 'id' | 'createdAt'>): Promise<void> {
  await db.insert(auditLogs).values(entry).execute();
}
