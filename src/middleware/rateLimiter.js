const rateLimit = require('express-rate-limit');
const config = require('../config');
const { error, ErrorCodes } = require('../utils/apiResponse');

/**
 * Global Rate Limiter
 * 100 requests per minute per IP
 */
const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs, // 1 minute
  max: config.rateLimit.maxRequests, // 100 requests
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json(
      error(ErrorCodes.RATE_LIMIT_EXCEEDED, 'Too many requests. Please wait and try again.')
    );
  },
  keyGenerator: (req) => {
    // Use X-Forwarded-For header if behind a proxy, otherwise use IP
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
  },
});

/**
 * Auth Rate Limiter
 * Stricter rate limiting for authentication routes
 * 10 requests per minute per IP
 */
const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs, // 1 minute
  max: config.rateLimit.authMaxRequests, // 10 requests
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json(
      error(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        'Too many authentication attempts. Please wait before trying again.'
      )
    );
  },
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
  },
  // Skip successful requests from counting
  skipSuccessfulRequests: false,
});

/**
 * Sensitive Operations Rate Limiter
 * For payroll runs, password changes, etc.
 * 5 requests per 5 minutes per IP
 */
const sensitiveLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json(
      error(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        'Too many sensitive operations. Please wait before trying again.'
      )
    );
  },
  keyGenerator: (req) => {
    // Combine IP and user ID if authenticated
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    return req.user ? `${ip}-${req.user.id}` : ip;
  },
});

module.exports = {
  globalLimiter,
  authLimiter,
  sensitiveLimiter,
};
