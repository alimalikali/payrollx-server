const { AppError } = require('../utils/errors');
const { error, validationError, ErrorCodes } = require('../utils/apiResponse');
const config = require('../config');

/**
 * Global Error Handler Middleware
 * Catches all errors and returns standardized responses
 */
const errorHandler = (err, req, res, next) => {
  // Log error details (stack trace only in development)
  console.error('Error:', {
    message: err.message,
    code: err.code,
    statusCode: err.statusCode,
    path: req.path,
    method: req.method,
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  });

  // Handle known application errors
  if (err instanceof AppError) {
    // Validation errors with details
    if (err.details) {
      return res.status(err.statusCode).json(
        validationError(err.details)
      );
    }

    return res.status(err.statusCode).json(
      error(err.code, err.message)
    );
  }

  // Handle express-validator errors
  if (err.array && typeof err.array === 'function') {
    const errors = err.array();
    return res.status(422).json(
      validationError(errors.map(e => ({
        field: e.path || e.param,
        message: e.msg,
        value: e.value,
      })))
    );
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json(
      error(ErrorCodes.INVALID_TOKEN, 'Invalid token')
    );
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json(
      error(ErrorCodes.TOKEN_EXPIRED, 'Token has expired')
    );
  }

  // Handle PostgreSQL unique constraint violations
  if (err.code === '23505') {
    const match = err.detail?.match(/Key \((.+)\)=/);
    const field = match ? match[1] : 'field';
    return res.status(409).json(
      error(ErrorCodes.DUPLICATE_ENTRY, `A record with this ${field} already exists`)
    );
  }

  // Handle PostgreSQL foreign key violations
  if (err.code === '23503') {
    return res.status(400).json(
      error(ErrorCodes.INVALID_INPUT, 'Referenced resource does not exist')
    );
  }

  // Handle PostgreSQL not null violations
  if (err.code === '23502') {
    const field = err.column || 'field';
    return res.status(400).json(
      error(ErrorCodes.VALIDATION_ERROR, `${field} is required`)
    );
  }

  // Handle syntax/parsing errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json(
      error(ErrorCodes.INVALID_INPUT, 'Invalid JSON in request body')
    );
  }

  // Default to 500 Internal Server Error
  const statusCode = err.statusCode || 500;
  const message = config.nodeEnv === 'production'
    ? 'An unexpected error occurred'
    : err.message;

  return res.status(statusCode).json(
    error(ErrorCodes.INTERNAL_ERROR, message)
  );
};

/**
 * 404 Not Found Handler
 * Handles requests to undefined routes
 */
const notFoundHandler = (req, res) => {
  return res.status(404).json(
    error(ErrorCodes.NOT_FOUND, `Route ${req.method} ${req.path} not found`)
  );
};

/**
 * Async Handler Wrapper
 * Wraps async route handlers to catch errors
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
};
