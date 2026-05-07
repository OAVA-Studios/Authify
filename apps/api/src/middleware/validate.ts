import { zValidator } from '@hono/zod-validator';
import type { ZodSchema } from 'zod';

export const validateJson = <T extends ZodSchema>(schema: T) => zValidator('json', schema);
export const validateQuery = <T extends ZodSchema>(schema: T) => zValidator('query', schema);
export const validateParam = <T extends ZodSchema>(schema: T) => zValidator('param', schema);
