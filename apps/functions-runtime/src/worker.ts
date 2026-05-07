import { Worker, type Job } from 'bullmq';
import ivm from 'isolated-vm';
import { eq } from 'drizzle-orm';
import { db } from '@authify/db';
import { functionExecutions } from '@authify/db/schema';
import { redis } from './redis.js';
import { logger } from './logger.js';
import type { FunctionJobData } from './types.js';

async function executeInIsolate(
  sourceCode: string,
  input: Record<string, unknown>,
  timeout: number,
  memoryMb: number
): Promise<{
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  logs: string[];
  error?: string;
  durationMs: number;
}> {
  const startTime = Date.now();
  const logs: string[] = [];

  const isolate = new ivm.Isolate({ memoryLimit: memoryMb });

  try {
    const context = await isolate.createContext();
    const jail = context.global;

    // Expose safe globals
    await jail.set('__input', new ivm.Reference(input));
    await jail.set('__log', new ivm.Reference((...args: unknown[]) => {
      logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    }));
    await jail.set('__fetch', new ivm.Reference(async (...args: Parameters<typeof fetch>) => {
      const url = String(args[0]);
      const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
      try {
        const parsed = new URL(url);
        if (blockedHosts.includes(parsed.hostname)) {
          throw new Error('Access to internal hosts is blocked');
        }
      } catch {
        // Invalid URL, let fetch handle it
      }
      const res = await fetch(...args);
      return {
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        body: await res.text(),
      };
    }));

    // Create a wrapped handler
    const script = await isolate.compileScript(
      `
      let __handler = null;
      const module = { exports: {} };
      const console = {
        log: (...args) => __log.applySync(undefined, args, { arguments: { copy: true } }),
        error: (...args) => __log.applySync(undefined, ['[ERROR]', ...args], { arguments: { copy: true } }),
        warn: (...args) => __log.applySync(undefined, ['[WARN]', ...args], { arguments: { copy: true } }),
      };
      const fetch = (...args) => __fetch.apply(undefined, args, { arguments: { copy: true }, result: { promise: true, copy: true } });
      ${sourceCode}
      __handler = module.exports.default || module.exports.handler || module.exports;
      if (typeof __handler !== 'function') throw new Error('No handler function exported');
      __handler(__input);
    `,
      { timeout }
    );

    const result = await script.run(context, { timeout });
    const durationMs = Date.now() - startTime;

    if (result && typeof result === 'object') {
      return {
        statusCode: (result as Record<string, unknown>).statusCode as number ?? 200,
        body: (result as Record<string, unknown>).body ?? result,
        headers: (result as Record<string, unknown>).headers as Record<string, string> ?? {},
        logs,
        durationMs,
      };
    }

    return {
      statusCode: 200,
      body: result,
      headers: {},
      logs,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      statusCode: 500,
      body: { error: errorMessage },
      headers: {},
      logs,
      error: errorMessage,
      durationMs,
    };
  } finally {
    isolate.dispose();
  }
}

export function startWorker(): Worker {
  const worker = new Worker(
    'authify:functions',
    async (job: Job<FunctionJobData>) => {
      const data = job.data;
      logger.info({ jobId: job.id, functionId: data.functionId }, 'Processing function job');

      const execution = await db
        .insert(functionExecutions)
        .values({
          functionId: data.functionId,
          projectId: data.projectId,
          status: 'running',
          request: data.payload,
        })
        .returning()
        .then((r) => r[0]);

      const input = {
        body: data.payload,
        query: {},
        headers: data.headers ?? {},
        params: {},
        projectId: data.projectId,
        env: data.envVars,
      };

      const output = await executeInIsolate(
        data.sourceCode,
        input,
        data.timeout,
        data.memory
      );

      await db
        .update(functionExecutions)
        .set({
          status: output.error ? 'failed' : 'completed',
          response: output.body as Record<string, unknown>,
          logs: output.logs.join('\n'),
          durationMs: output.durationMs,
          errorMessage: output.error,
          completedAt: new Date(),
        })
        .where(eq(functionExecutions.id, execution.id));

      if (output.error) {
        throw new Error(output.error);
      }

      return output;
    },
    {
      connection: redis,
      concurrency: 10,
    }
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Function job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Function job failed');
  });

  return worker;
}
