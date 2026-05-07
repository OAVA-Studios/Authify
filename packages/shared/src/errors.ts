export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class BadRequestError extends ApiError {
  constructor(message = 'Bad Request', code = 'BAD_REQUEST', details?: Record<string, unknown>) {
    super(400, message, code, details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(401, message, code);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN') {
    super(403, message, code);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Not Found', code = 'NOT_FOUND') {
    super(404, message, code);
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'Conflict', code = 'CONFLICT') {
    super(409, message, code);
  }
}

export class RateLimitError extends ApiError {
  constructor(
    message = 'Too Many Requests',
    code = 'RATE_LIMITED',
    public readonly retryAfter?: number
  ) {
    super(429, message, code);
  }
}

export class InternalError extends ApiError {
  constructor(message = 'Internal Server Error', code = 'INTERNAL_ERROR') {
    super(500, message, code);
  }
}
