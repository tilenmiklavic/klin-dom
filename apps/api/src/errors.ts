import type { z } from 'zod';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export type ErrorStatus = 400 | 401 | 403 | 404 | 409;

export class HttpError extends Error {
  constructor(
    public readonly status: ErrorStatus,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function errorBody(code: string, message: string) {
  return { error: { code, message } };
}

export function errorHandler(err: Error, c: Context) {
  if (err instanceof HttpError) {
    return c.json(errorBody(err.code, err.message), err.status as ContentfulStatusCode);
  }
  console.error(err);
  return c.json(errorBody('internal', 'Something went wrong'), 500);
}

export async function parseBody<S extends z.ZodTypeAny>(c: Context, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    raw = {};
  }
  return parseWith(schema, raw);
}

export function parseWith<S extends z.ZodTypeAny>(schema: S, raw: unknown): z.infer<S> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
    throw new HttpError(400, 'invalid_input', message);
  }
  return result.data;
}
