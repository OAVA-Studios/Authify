import { db } from '@authify/db';
import { licenseWebhookLogs } from '@authify/db/schema';
import type { NewLicenseWebhookLog } from '@authify/db/schema';

export async function deliverLicenseWebhook(
  entry: Omit<NewLicenseWebhookLog, 'id' | 'sentAt' | 'success' | 'statusCode' | 'responseBody'>,
  url: string
): Promise<void> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Authify/1.0',
      },
      body: JSON.stringify(entry.payload),
    });
    const body = await res.text();
    await db.insert(licenseWebhookLogs).values({
      ...entry,
      success: res.ok,
      statusCode: res.status,
      responseBody: body,
    });
  } catch (err) {
    await db.insert(licenseWebhookLogs).values({
      ...entry,
      success: false,
      responseBody: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}
