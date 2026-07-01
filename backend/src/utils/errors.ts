import httpStatus from 'http-status';

export class BaseError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational = true,
    details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends BaseError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, httpStatus.BAD_REQUEST, 'VALIDATION_ERROR', true, details);
  }
}

export class AuthenticationError extends BaseError {
  constructor(message = 'Authentication required') {
    super(message, httpStatus.UNAUTHORIZED, 'AUTHENTICATION_ERROR', true);
  }
}

export class AuthorizationError extends BaseError {
  constructor(message = 'Insufficient permissions') {
    super(message, httpStatus.FORBIDDEN, 'AUTHORIZATION_ERROR', true);
  }
}

export class NotFoundError extends BaseError {
  constructor(message = 'Resource not found') {
    super(message, httpStatus.NOT_FOUND, 'NOT_FOUND', true);
  }
}

export class ConflictError extends BaseError {
  constructor(message = 'Resource already exists') {
    super(message, httpStatus.CONFLICT, 'CONFLICT', true);
  }
}

export class BusinessError extends BaseError {
  constructor(message: string, code = 'BUSINESS_ERROR') {
    super(message, httpStatus.UNPROCESSABLE_ENTITY, code, true);
  }
}

export class DatabaseError extends BaseError {
  constructor(message = 'Database operation failed', details?: unknown) {
    super(message, httpStatus.INTERNAL_SERVER_ERROR, 'DATABASE_ERROR', false, details);
  }
}

export class ProviderError extends BaseError {
  constructor(message: string, provider: string, statusCode = httpStatus.BAD_GATEWAY) {
    super(message, statusCode, `${provider.toUpperCase()}_ERROR`, false);
  }
}

export class AIError extends BaseError {
  constructor(message = 'AI provider error', details?: unknown) {
    super(message, httpStatus.BAD_GATEWAY, 'AI_ERROR', false, details);
  }
}

export class StorageError extends BaseError {
  constructor(message = 'Storage operation failed', details?: unknown) {
    super(message, httpStatus.INTERNAL_SERVER_ERROR, 'STORAGE_ERROR', false, details);
  }
}

export class RateLimitError extends BaseError {
  constructor(message = 'Too many requests') {
    super(message, httpStatus.TOO_MANY_REQUESTS, 'RATE_LIMIT_ERROR', true);
  }
}
