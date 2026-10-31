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
