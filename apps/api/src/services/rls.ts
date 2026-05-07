export interface RlsContext {
  userId?: string;
  role?: string;
  projectId: string;
}

export type RlsCondition =
  | { eq: [string, unknown] }
  | { ne: [string, unknown] }
  | { gt: [string, number] }
  | { gte: [string, number] }
  | { lt: [string, number] }
  | { lte: [string, number] }
  | { in: [string, unknown[]] }
  | { contains: [string, string] }
  | { and: RlsCondition[] }
  | { or: RlsCondition[] }
  | { not: RlsCondition };

function resolveValue(value: unknown, ctx: RlsContext): unknown {
  if (typeof value !== 'string') return value;
  if (value === '{{userId}}') return ctx.userId;
  if (value === '{{role}}') return ctx.role;
  if (value === '{{projectId}}') return ctx.projectId;
  return value;
}

function getField(doc: Record<string, unknown>, field: string): unknown {
  // Supports nested fields like "data.ownerId" or just "ownerId"
  const parts = field.split('.');
  let current: unknown = doc;
  for (const part of parts) {
    if (current && typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

export function evaluateCondition(
  condition: RlsCondition,
  doc: Record<string, unknown>,
  ctx: RlsContext
): boolean {
  if ('and' in condition) {
    return condition.and.every((c) => evaluateCondition(c, doc, ctx));
  }
  if ('or' in condition) {
    return condition.or.some((c) => evaluateCondition(c, doc, ctx));
  }
  if ('not' in condition) {
    return !evaluateCondition(condition.not, doc, ctx);
  }
  if ('eq' in condition) {
    const [field, val] = condition.eq;
    return getField(doc, field) === resolveValue(val, ctx);
  }
  if ('ne' in condition) {
    const [field, val] = condition.ne;
    return getField(doc, field) !== resolveValue(val, ctx);
  }
  if ('gt' in condition) {
    const [field, val] = condition.gt;
    const fv = getField(doc, field);
    return typeof fv === 'number' && fv > (resolveValue(val, ctx) as number);
  }
  if ('gte' in condition) {
    const [field, val] = condition.gte;
    const fv = getField(doc, field);
    return typeof fv === 'number' && fv >= (resolveValue(val, ctx) as number);
  }
  if ('lt' in condition) {
    const [field, val] = condition.lt;
    const fv = getField(doc, field);
    return typeof fv === 'number' && fv < (resolveValue(val, ctx) as number);
  }
  if ('lte' in condition) {
    const [field, val] = condition.lte;
    const fv = getField(doc, field);
    return typeof fv === 'number' && fv <= (resolveValue(val, ctx) as number);
  }
  if ('in' in condition) {
    const [field, val] = condition.in;
    const arr = resolveValue(val, ctx) as unknown[];
    const fv = getField(doc, field);
    return Array.isArray(arr) && arr.includes(fv);
  }
  if ('contains' in condition) {
    const [field, val] = condition.contains;
    const fv = getField(doc, field);
    const resolved = resolveValue(val, ctx) as string;
    return typeof fv === 'string' && fv.includes(resolved);
  }
  return true;
}
