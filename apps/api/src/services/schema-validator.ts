import { z } from 'zod';
import { BadRequestError } from '@authify/shared';

export interface FieldSchema {
  type: 'string' | 'text' | 'integer' | 'float' | 'boolean' | 'timestamp' | 'uuid' | 'json' | 'array';
  required?: boolean;
  default?: unknown;
  min?: number;
  max?: number;
  regex?: string;
  items?: FieldSchema;
}

export interface CollectionSchema {
  fields: Record<string, FieldSchema>;
}

function buildZodSchema(field: FieldSchema): z.ZodType<unknown> {
  let schema: z.ZodType<unknown>;

  switch (field.type) {
    case 'string':
      schema = z.string();
      break;
    case 'text':
      schema = z.string();
      break;
    case 'integer':
      schema = z.number().int();
      break;
    case 'float':
      schema = z.number();
      break;
    case 'boolean':
      schema = z.boolean();
      break;
    case 'timestamp':
      schema = z.string().datetime();
      break;
    case 'uuid':
      schema = z.string().uuid();
      break;
    case 'json':
      schema = z.record(z.unknown());
      break;
    case 'array':
      schema = field.items ? z.array(buildZodSchema(field.items)) : z.array(z.unknown());
      break;
    default:
      schema = z.unknown();
  }

  if (field.min !== undefined) {
    if (field.type === 'string' || field.type === 'text') {
      schema = (schema as z.ZodString).min(field.min);
    } else if (field.type === 'integer' || field.type === 'float') {
      schema = (schema as z.ZodNumber).min(field.min);
    }
  }

  if (field.max !== undefined) {
    if (field.type === 'string' || field.type === 'text') {
      schema = (schema as z.ZodString).max(field.max);
    } else if (field.type === 'integer' || field.type === 'float') {
      schema = (schema as z.ZodNumber).max(field.max);
    }
  }

  if (field.regex && (field.type === 'string' || field.type === 'text')) {
    schema = (schema as z.ZodString).regex(new RegExp(field.regex));
  }

  if (!field.required) {
    schema = schema.optional();
  }

  return schema;
}

export function validateDocument(
  data: Record<string, unknown>,
  schema: CollectionSchema
): Record<string, unknown> {
  const shape: Record<string, z.ZodType<unknown>> = {};
  for (const [key, field] of Object.entries(schema.fields)) {
    shape[key] = buildZodSchema(field);
  }

  const validator = z.object(shape).strict();
  const result = validator.safeParse(data);

  if (!result.success) {
    throw new BadRequestError(
      'Document validation failed',
      'VALIDATION_ERROR',
      { issues: result.error.issues }
    );
  }

  return result.data as Record<string, unknown>;
}
