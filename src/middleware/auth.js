/**
 * Authentication Middleware
 * Protects routes and handles role-based access control
 */

const { verifyAccessToken } = require('../utils/jwt');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

/**
 * Protect routes - requires valid JWT token
 */
const protect = (req, res, next) => {
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

    // Attach user info to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

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
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        const decoded = verifyAccessToken(token);
        req.user = {
          id: decoded.userId,
          email: decoded.email,
          role: decoded.role,
        };
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
 * Usage: restrictTo('admin', 'hr')
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
 * Restrict to admin only
 */
const adminOnly = restrictTo('admin');

/**
 * Restrict to HR and admin
 */
const hrOrAdmin = restrictTo('admin', 'hr');

/**
 * Check if user owns resource or is admin/hr
 * Usage: ownerOrAdmin('employeeId')
 */
const ownerOrAdmin = (paramName = 'id') => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const resourceId = req.params[paramName];
    const isOwner = req.user.id === resourceId || req.user.employeeId === resourceId;
    const isPrivileged = ['admin', 'hr'].includes(req.user.role);

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
  adminOnly,
  hrOrAdmin,
  ownerOrAdmin,
  extractClientInfo,
};
