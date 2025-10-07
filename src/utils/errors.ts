export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return json({ error: err.code, message: err.message, details: err.details }, err.status);
  }
  console.error('Unhandled error', err);
  return json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, 500);
}

export function notFound(message = 'Not found'): never {
  throw new AppError(404, 'NOT_FOUND', message);
}

export function unauthorized(message = 'Unauthorized'): never {
  throw new AppError(401, 'UNAUTHORIZED', message);
}

export function forbidden(message = 'Forbidden'): never {
  throw new AppError(403, 'FORBIDDEN', message);
}

export function badRequest(message = 'Bad request', details?: unknown): never {
  throw new AppError(400, 'BAD_REQUEST', message, details);
}

export function json(body: unknown, status = 200, headers: Record<string,string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers }});
}
