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
//# sourceMappingURL=types.d.ts.map