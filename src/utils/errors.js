/**
 * Custom Error Classes for PayrollX
 * These errors are caught by the global error handler and formatted appropriately
 */

const { ErrorCodes } = require('./apiResponse');

/**
 * Base Application Error
 */
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request
 */
class BadRequestError extends AppError {
  constructor(message = 'Bad request', detailsOrCode = ErrorCodes.INVALID_INPUT) {
    const isDetails =
      Array.isArray(detailsOrCode) ||
      (detailsOrCode && typeof detailsOrCode === 'object');
    const code = isDetails ? ErrorCodes.INVALID_INPUT : detailsOrCode;
    super(message, 400, code);
    if (isDetails) {
      this.details = detailsOrCode;
    }
  }
}

/**
 * 401 Unauthorized
 */
class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', code = ErrorCodes.UNAUTHORIZED) {
    super(message, 401, code);
  }
}

/**
 * 403 Forbidden
 */
class ForbiddenError extends AppError {
  constructor(message = 'Access denied', code = ErrorCodes.FORBIDDEN) {
    super(message, 403, code);
  }
}

/**
 * 404 Not Found
 */
class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = ErrorCodes.NOT_FOUND) {
    super(message, 404, code);
  }
}

/**
 * 409 Conflict
 */
class ConflictError extends AppError {
  constructor(message = 'Conflict', code = ErrorCodes.DUPLICATE_ENTRY) {
    super(message, 409, code);
  }
}

/**
 * 422 Unprocessable Entity
 */
class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = null) {
    super(message, 422, ErrorCodes.VALIDATION_ERROR);
    this.details = details;
    this.errors = details;
  }
}

/**
 * 429 Too Many Requests
 */
class RateLimitError extends AppError {
  constructor(message = 'Too many requests. Please wait.') {
    super(message, 429, ErrorCodes.RATE_LIMIT_EXCEEDED);
  }
}

/**
 * 500 Internal Server Error
 */
class InternalError extends AppError {
  constructor(message = 'Internal server error', code = ErrorCodes.INTERNAL_ERROR) {
    super(message, 500, code);
  }
}

/**
 * Database Error
 */
class DatabaseError extends AppError {
  constructor(message = 'Database error') {
    super(message, 500, ErrorCodes.DATABASE_ERROR);
  }
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitError,
  InternalError,
  DatabaseError,
};
