import { createContext, runInContext, type Context } from 'vm';
import { logger } from '../lib/logger.js';

export interface FunctionInput {
  body: unknown;
  query: Record<string, string>;
  headers: Record<string, string>;
  params: Record<string, string>;
  projectId: string;
  userId?: string;
  env: Record<string, string>;
}

export interface FunctionOutput {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  logs: string[];
  error?: string;
  durationMs: number;
  memoryUsedMb: number;
}

function createSandbox(input: FunctionInput): Record<string, unknown> {
  const logs: string[] = [];

  return {
    console: {
      log: (...args: unknown[]) => {
        logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
      },
      error: (...args: unknown[]) => {
        logs.push(
          '[ERROR] ' + args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
        );
      },
      warn: (...args: unknown[]) => {
        logs.push(
          '[WARN] ' + args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
        );
      },
    },
    fetch: async (...args: Parameters<typeof fetch>) => {
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
      return fetch(...args);
    },
    setTimeout: (_fn: () => void, _ms: number) => {
      throw new Error('setTimeout is not allowed in serverless functions');
    },
    setInterval: (_fn: () => void, _ms: number) => {
      throw new Error('setInterval is not allowed in serverless functions');
    },
    process: undefined,
    require: undefined,
    module: undefined,
    exports: undefined,
    global: undefined,
    __dirname: undefined,
    __filename: undefined,
    Buffer: undefined,
    TextEncoder,
    TextDecoder,
    URL,
    URLSearchParams,
    JSON,
    Math,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    Promise,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Symbol,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    btoa,
    atob,
    input,
    logs,
  };
}

export async function runFunction(
  sourceCode: string,
  input: FunctionInput,
  timeoutMs: number,
  _memoryMb: number
): Promise<FunctionOutput> {
  const startTime = Date.now();
  const logs: string[] = [];
  let context: Context | null = null;

  try {
    const sandbox = createSandbox(input);
    context = createContext(sandbox);

    const wrapped = `
      let __handler = null;
      const module = { exports: {} };
      ${sourceCode}
      __handler = module.exports.default || module.exports.handler || module.exports;
      __handler;
    `;

    const handler = runInContext(wrapped, context, { timeout: timeoutMs, displayErrors: true });

    if (typeof handler !== 'function') {
      throw new Error('No handler function exported. Use module.exports = (input) => {...}');
    }

    const result = await runInContext(
      `(__handler)(input)`,
      context,
      { timeout: timeoutMs, displayErrors: true }
    );

    const durationMs = Date.now() - startTime;

    const sandboxLogs = (runInContext('logs', context) as string[]) ?? [];
    logs.push(...sandboxLogs);

    if (result && typeof result === 'object') {
      return {
        statusCode: (result as Record<string, unknown>).statusCode as number ?? 200,
        body: (result as Record<string, unknown>).body ?? result,
        headers: (result as Record<string, unknown>).headers as Record<string, string> ?? {},
        logs,
        durationMs,
        memoryUsedMb: 0,
      };
    }

    return {
      statusCode: 200,
      body: result,
      headers: {},
      logs,
      durationMs,
      memoryUsedMb: 0,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.warn({ error: errorMessage, durationMs }, 'Function execution failed');

    try {
      if (context) {
        const sandboxLogs = (runInContext('logs', context) as string[]) ?? [];
        logs.push(...sandboxLogs);
      }
    } catch {
      // ignore
    }

    return {
      statusCode: 500,
      body: { error: errorMessage },
      headers: {},
      logs,
      error: errorMessage,
      durationMs,
      memoryUsedMb: 0,
    };
  }
}
