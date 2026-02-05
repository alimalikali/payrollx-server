/**
 * Authentication Service
 * Handles user authentication, registration, and token management
 */

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { hashToken, generateTokenPair, getRefreshTokenExpiry } = require('../utils/jwt');
const { UnauthorizedError, BadRequestError, NotFoundError } = require('../utils/errors');

const SALT_ROUNDS = 12;

/**
 * Register a new user
 */
const register = async ({ email, password, role = 'employee' }) => {
  // Check if user exists
  const existingUser = await db.query(
    'SELECT id FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  if (existingUser.rows.length > 0) {
    throw new BadRequestError('Email already registered');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Create user
  const result = await db.query(
    `INSERT INTO users (email, password_hash, role)
     VALUES ($1, $2, $3)
     RETURNING id, email, role, is_active, created_at`,
    [email.toLowerCase(), passwordHash, role]
  );

  return result.rows[0];
};

/**
 * Login user and generate tokens
 */
const login = async ({ email, password, ipAddress, userAgent }) => {
  // Find user
  const result = await db.query(
    'SELECT id, email, password_hash, role, is_active FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  const user = result.rows[0];

  if (!user) {
    await logSecurityEvent(null, 'login_failed', ipAddress, userAgent, { reason: 'user_not_found', email });
    throw new UnauthorizedError('Invalid email or password');
  }

  if (!user.is_active) {
    await logSecurityEvent(user.id, 'login_failed', ipAddress, userAgent, { reason: 'account_inactive' });
    throw new UnauthorizedError('Account is deactivated');
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash);

  if (!isValidPassword) {
    await logSecurityEvent(user.id, 'login_failed', ipAddress, userAgent, { reason: 'invalid_password' });
    throw new UnauthorizedError('Invalid email or password');
  }

  // Generate tokens
  const tokens = generateTokenPair(user);
  const familyId = uuidv4();

  // Store refresh token
  await storeRefreshToken({
    userId: user.id,
    token: tokens.refreshToken,
    familyId,
    ipAddress,
    userAgent,
  });

  // Update last login
  await db.query(
    'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
    [user.id]
  );

  // Log successful login
  await logSecurityEvent(user.id, 'login_success', ipAddress, userAgent);

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    tokens,
  };
};

/**
 * Refresh access token using refresh token
 * Implements token rotation for security
 */
const refreshAccessToken = async ({ refreshToken, ipAddress, userAgent }) => {
  const tokenHash = hashToken(refreshToken);

  // Find the refresh token
  const result = await db.query(
    `SELECT rt.*, u.id as user_id, u.email, u.role, u.is_active
     FROM refresh_tokens rt
     JOIN users u ON rt.user_id = u.id
     WHERE rt.token_hash = $1`,
    [tokenHash]
  );

  const storedToken = result.rows[0];

  if (!storedToken) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  // Check if token is revoked
  if (storedToken.revoked_at) {
    // Token reuse detected - revoke entire family
    await revokeTokenFamily(storedToken.family_id, 'token_reuse_detected');
    await logSecurityEvent(storedToken.user_id, 'token_revoked', ipAddress, userAgent, {
      reason: 'token_reuse_detected',
      family_id: storedToken.family_id,
    });
    throw new UnauthorizedError('Token has been revoked. Please login again.');
  }

  // Check if token is expired
  if (new Date(storedToken.expires_at) < new Date()) {
    throw new UnauthorizedError('Refresh token has expired');
  }

  // Check if user is still active
  if (!storedToken.is_active) {
    throw new UnauthorizedError('Account is deactivated');
  }

  // Revoke current token (rotation)
  await db.query(
    `UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP, revoked_reason = 'rotated'
     WHERE id = $1`,
    [storedToken.id]
  );

  // Generate new token pair
  const user = {
    id: storedToken.user_id,
    email: storedToken.email,
    role: storedToken.role,
  };

  const tokens = generateTokenPair(user);

  // Store new refresh token in same family
  await storeRefreshToken({
    userId: user.id,
    token: tokens.refreshToken,
    familyId: storedToken.family_id,
    generation: storedToken.generation + 1,
    ipAddress,
    userAgent,
  });

  // Log token refresh
  await logSecurityEvent(user.id, 'token_refresh', ipAddress, userAgent);

  return {
    user,
    tokens,
  };
};

/**
 * Logout user - revoke refresh token
 */
const logout = async ({ refreshToken, ipAddress, userAgent }) => {
  if (!refreshToken) return;

  const tokenHash = hashToken(refreshToken);

  const result = await db.query(
    'SELECT user_id, family_id FROM refresh_tokens WHERE token_hash = $1',
    [tokenHash]
  );

  if (result.rows.length > 0) {
    const { user_id, family_id } = result.rows[0];

    // Revoke entire token family on logout
    await revokeTokenFamily(family_id, 'logout');
    await logSecurityEvent(user_id, 'logout', ipAddress, userAgent);
  }
};

/**
 * Logout from all devices
 */
const logoutAll = async (userId, ipAddress, userAgent) => {
  await db.query(
    `UPDATE refresh_tokens
     SET revoked_at = CURRENT_TIMESTAMP, revoked_reason = 'logout_all'
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );

  await logSecurityEvent(userId, 'logout', ipAddress, userAgent, { scope: 'all_devices' });
};

/**
 * Change password
 */
const changePassword = async ({ userId, currentPassword, newPassword, ipAddress, userAgent }) => {
  // Get current password hash
  const result = await db.query(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('User not found');
  }

  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);

  if (!isValid) {
    throw new BadRequestError('Current password is incorrect');
  }

  // Hash new password
  const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  // Update password
  await db.query(
    'UPDATE users SET password_hash = $1 WHERE id = $2',
    [newPasswordHash, userId]
  );

  // Revoke all refresh tokens
  await db.query(
    `UPDATE refresh_tokens
     SET revoked_at = CURRENT_TIMESTAMP, revoked_reason = 'password_changed'
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );

  await logSecurityEvent(userId, 'password_change', ipAddress, userAgent);
};

/**
 * Get user by ID
 */
const getUserById = async (userId) => {
  const result = await db.query(
    `SELECT u.id, u.email, u.role, u.is_active, u.last_login, u.created_at,
            e.id as employee_id, e.first_name, e.last_name, e.profile_image
     FROM users u
     LEFT JOIN employees e ON e.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('User not found');
  }

  const user = result.rows[0];

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isActive: user.is_active,
    lastLogin: user.last_login,
    createdAt: user.created_at,
    employee: user.employee_id ? {
      id: user.employee_id,
      firstName: user.first_name,
      lastName: user.last_name,
      profileImage: user.profile_image,
    } : null,
  };
};

// Helper functions

const storeRefreshToken = async ({ userId, token, familyId, generation = 1, ipAddress, userAgent }) => {
  const tokenHash = hashToken(token);
  const expiresAt = getRefreshTokenExpiry();

  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, family_id, generation, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, tokenHash, familyId, generation, expiresAt, ipAddress, userAgent]
  );
};

const revokeTokenFamily = async (familyId, reason) => {
  await db.query(
    `UPDATE refresh_tokens
     SET revoked_at = CURRENT_TIMESTAMP, revoked_reason = $2
     WHERE family_id = $1 AND revoked_at IS NULL`,
    [familyId, reason]
  );
};

const logSecurityEvent = async (userId, eventType, ipAddress, userAgent, details = null) => {
  await db.query(
    `INSERT INTO security_audit_log (user_id, event_type, ip_address, user_agent, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, eventType, ipAddress, userAgent, details ? JSON.stringify(details) : null]
  );
};

module.exports = {
  register,
  login,
  refreshAccessToken,
  logout,
  logoutAll,
  changePassword,
  getUserById,
};
