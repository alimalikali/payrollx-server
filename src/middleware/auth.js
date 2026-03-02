/**
 * Authentication Middleware
 * Protects routes and handles role-based access control
 */

const { verifyAccessToken } = require('../utils/jwt');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');
const db = require('../config/database');
<<<<<<< HEAD
=======

const PASSWORD_CHANGE_ALLOWED_ROUTES = new Set([
  'GET /api/v1/auth/me',
  'POST /api/v1/auth/change-password',
  'POST /api/v1/auth/logout-all',
]);

const canAccessDuringPasswordReset = (req) => {
  const pathname = req.originalUrl.split('?')[0];
  const key = `${req.method.toUpperCase()} ${pathname}`;
  return PASSWORD_CHANGE_ALLOWED_ROUTES.has(key);
};
>>>>>>> bdd7077 (Updated project files)

/**
 * Protect routes - requires valid JWT token
 */
const protect = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Access token required');
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new UnauthorizedError('Access token required');
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    const accountResult = await db.query(
      `SELECT
         u.id,
         u.email,
         u.role,
         u.is_active,
         u.must_change_password,
         e.id AS employee_row_id,
         e.employee_id AS employee_code
       FROM users u
       LEFT JOIN employees e ON e.user_id = u.id
       WHERE u.id = $1
       LIMIT 1`,
      [decoded.userId]
    );
    const account = accountResult?.rows?.[0];

    if (!account) {
      throw new UnauthorizedError('User account not found');
    }

    if (!account.is_active) {
      throw new UnauthorizedError('Account is deactivated');
    }

    // Attach user info to request
<<<<<<< HEAD
    const user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    if (user.role === 'employee') {
      try {
        const employeeResult = await db.query(
          'SELECT id FROM employees WHERE user_id = $1 LIMIT 1',
          [user.id]
        );
        user.employeeId = employeeResult?.rows?.[0]?.id || null;
      } catch (_) {
        user.employeeId = null;
      }
    }

    req.user = user;

=======
    req.user = {
      id: account.id,
      email: account.email,
      role: account.role,
      employeeId: account.employee_row_id || null,
      employeeCode: account.employee_code || null,
      mustChangePassword: account.must_change_password,
    };

    if (req.user.mustChangePassword && !canAccessDuringPasswordReset(req)) {
      throw new ForbiddenError('You must change your password before continuing');
    }

>>>>>>> bdd7077 (Updated project files)
    next();
  } catch (error) {
    if (error.code === 'TOKEN_EXPIRED') {
      return next(new UnauthorizedError('Access token has expired'));
    }
    if (error.code === 'TOKEN_INVALID') {
      return next(new UnauthorizedError('Invalid access token'));
    }
    next(error);
  }
};

/**
 * Optional auth - attaches user if token present, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        const decoded = verifyAccessToken(token);
        const accountResult = await db.query(
          `SELECT
             u.id,
             u.email,
             u.role,
             u.is_active,
             u.must_change_password,
             e.id AS employee_row_id,
             e.employee_id AS employee_code
           FROM users u
           LEFT JOIN employees e ON e.user_id = u.id
           WHERE u.id = $1
           LIMIT 1`,
          [decoded.userId]
        );
        const account = accountResult?.rows?.[0];

        if (account && account.is_active) {
          req.user = {
            id: account.id,
            email: account.email,
            role: account.role,
            employeeId: account.employee_row_id || null,
            employeeCode: account.employee_code || null,
            mustChangePassword: account.must_change_password,
          };
        }
      }
    }
    next();
  } catch (error) {
    // Ignore token errors for optional auth
    next();
  }
};

/**
 * Restrict to specific roles
 * Usage: restrictTo('hr')
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('You do not have permission to perform this action'));
    }

    next();
  };
};

/**
 * Restrict to HR only
 */
const hrOnly = restrictTo('hr');

/**
 * Check if user owns resource (employee ID) or is HR
 * Usage: ownerOrHR('employeeId')
 */
const ownerOrHR = (paramName = 'id') => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const resourceId = req.params[paramName];
    const isOwner = req.user.employeeId === resourceId || req.user.id === resourceId;
    const isPrivileged = req.user.role === 'hr';

    if (!isOwner && !isPrivileged) {
      return next(new ForbiddenError('You do not have permission to access this resource'));
    }

    next();
  };
};

/**
 * Extract client info from request
 */
const extractClientInfo = (req) => {
  return {
    ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
    userAgent: req.headers['user-agent'] || 'unknown',
  };
};

module.exports = {
  protect,
  optionalAuth,
  restrictTo,
  hrOnly,
  ownerOrHR,
  extractClientInfo,
};
