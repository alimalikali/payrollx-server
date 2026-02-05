/**
 * Standardized API Response Builders
 * All API responses follow the format: { success, data, meta, error }
 */

/**
 * Success response builder
 * @param {any} data - The response data
 * @param {object} meta - Optional metadata (pagination, etc.)
 * @returns {object} Formatted success response
 */
const success = (data, meta = null) => {
  const response = {
    success: true,
    data,
  };

  if (meta) {
    response.meta = meta;
  }

  return response;
};

/**
 * Paginated success response builder
 * @param {array} data - The data array
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @param {number} total - Total items count
 * @returns {object} Formatted paginated response
 */
const paginated = (data, page, limit, total) => {
  return {
    success: true,
    data,
    meta: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total: parseInt(total, 10),
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Error response builder
 * @param {string} code - Machine-readable error code
 * @param {string} message - Human-readable error message
 * @param {any} details - Optional error details
 * @returns {object} Formatted error response
 */
const error = (code, message, details = null) => {
  const response = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (details) {
    response.error.details = details;
  }

  return response;
};

/**
 * Validation error response builder
 * @param {array} errors - Array of validation errors
 * @returns {object} Formatted validation error response
 */
const validationError = (errors) => {
  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: errors,
    },
  };
};

/**
 * Standard error codes
 */
const ErrorCodes = {
  // Authentication
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  NO_TOKEN: 'NO_TOKEN',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // Resources
  NOT_FOUND: 'NOT_FOUND',
  EMPLOYEE_NOT_FOUND: 'EMPLOYEE_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  DEPARTMENT_NOT_FOUND: 'DEPARTMENT_NOT_FOUND',
  PAYROLL_NOT_FOUND: 'PAYROLL_NOT_FOUND',
  PAYSLIP_NOT_FOUND: 'PAYSLIP_NOT_FOUND',
  LEAVE_NOT_FOUND: 'LEAVE_NOT_FOUND',
  ATTENDANCE_NOT_FOUND: 'ATTENDANCE_NOT_FOUND',

  // Duplicates
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',
  DUPLICATE_EMPLOYEE_CODE: 'DUPLICATE_EMPLOYEE_CODE',
  DUPLICATE_PAYSLIP: 'DUPLICATE_PAYSLIP',

  // Business Logic
  PAYROLL_ALREADY_PROCESSED: 'PAYROLL_ALREADY_PROCESSED',
  INSUFFICIENT_LEAVE_BALANCE: 'INSUFFICIENT_LEAVE_BALANCE',
  INVALID_DATE_RANGE: 'INVALID_DATE_RANGE',
  INVALID_LEAVE_REQUEST: 'INVALID_LEAVE_REQUEST',
  ALREADY_CHECKED_IN: 'ALREADY_CHECKED_IN',
  NOT_CHECKED_IN: 'NOT_CHECKED_IN',

  // AI Module
  AI_MODEL_ERROR: 'AI_MODEL_ERROR',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Server
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
};

module.exports = {
  success,
  paginated,
  error,
  validationError,
  ErrorCodes,
};
