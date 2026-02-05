/**
 * JWT Utility Functions
 * Handles token generation, verification, and refresh token rotation
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');

/**
 * Generate access token (short-lived: 15 minutes)
 */
const generateAccessToken = (payload) => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiresIn,
    issuer: 'payrollx',
    audience: 'payrollx-client',
  });
};

/**
 * Generate refresh token (long-lived: 7 days)
 */
const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

/**
 * Hash refresh token for storage
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Verify access token
 */
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret, {
      issuer: 'payrollx',
      audience: 'payrollx-client',
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      error.code = 'TOKEN_EXPIRED';
    } else if (error.name === 'JsonWebTokenError') {
      error.code = 'TOKEN_INVALID';
    }
    throw error;
  }
};

/**
 * Decode token without verification (for debugging)
 */
const decodeToken = (token) => {
  return jwt.decode(token);
};

/**
 * Generate token pair (access + refresh)
 */
const generateTokenPair = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken();

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresIn: config.jwt.accessExpiresIn,
    refreshTokenExpiresIn: config.jwt.refreshExpiresIn,
  };
};

/**
 * Calculate refresh token expiry date
 */
const getRefreshTokenExpiry = () => {
  const days = parseInt(config.jwt.refreshExpiresIn) || 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  verifyAccessToken,
  decodeToken,
  generateTokenPair,
  getRefreshTokenExpiry,
};
