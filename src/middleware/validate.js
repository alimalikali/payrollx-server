/**
 * Validation Middleware
 * Uses express-validator for request validation
 */

const { validationResult, body, param, query } = require('express-validator');
const { BadRequestError } = require('../utils/errors');

/**
 * Process validation results
 */
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const messages = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));

    throw new BadRequestError('Validation failed', messages);
  }

  next();
};

/**
 * Auth validation rules
 */
const authValidation = {
  register: [
    body('email')
      .trim()
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/[a-z]/)
      .withMessage('Password must contain at least one lowercase letter')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number'),
    body('role')
      .optional()
      .isIn(['admin', 'hr', 'employee'])
      .withMessage('Role must be admin, hr, or employee'),
    handleValidation,
  ],

  login: [
    body('email')
      .trim()
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
    handleValidation,
  ],

  changePassword: [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/[a-z]/)
      .withMessage('Password must contain at least one lowercase letter')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number'),
    handleValidation,
  ],

  refreshToken: [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required'),
    handleValidation,
  ],
};

/**
 * Common validation helpers
 */
const commonValidation = {
  uuid: (fieldName, location = 'param') => {
    const validator = location === 'param' ? param : location === 'query' ? query : body;
    return [
      validator(fieldName)
        .isUUID()
        .withMessage(`${fieldName} must be a valid UUID`),
      handleValidation,
    ];
  },

  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer')
      .toInt(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
      .toInt(),
    handleValidation,
  ],

  dateRange: [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid date'),
    handleValidation,
  ],
};

module.exports = {
  handleValidation,
  authValidation,
  commonValidation,
  body,
  param,
  query,
};
