import { Queue } from 'bullmq';
import { redis } from '../lib/redis.js';

export const functionQueue = new Queue('authify-functions', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  },
});

export interface FunctionJobData {
  functionId: string;
  projectId: string;
  triggerType: string;
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
  sourceCode: string;
  timeout: number;
  memory: number;
  envVars: Record<string, string>;
}

export async function enqueueFunctionExecution(data: FunctionJobData): Promise<string> {
  const job = await functionQueue.add(
    `function:${data.functionId}`,
    data,
    {
      jobId: `${data.functionId}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    }
  );
  return job.id ?? '';
}
