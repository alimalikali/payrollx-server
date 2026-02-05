/**
 * Authentication Controller
 * Handles HTTP requests for authentication endpoints
 */

const authService = require('../services/auth.service');
const { extractClientInfo } = require('../middleware/auth');
const { success } = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Register new user
 * POST /api/v1/auth/register
 */
const register = asyncHandler(async (req, res) => {
  const { email, password, role } = req.body;

  const user = await authService.register({ email, password, role });

  res.status(201).json(
    success({ id: user.id, email: user.email, role: user.role }, 'Registration successful')
  );
});

/**
 * Login user
 * POST /api/v1/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { ipAddress, userAgent } = extractClientInfo(req);

  const result = await authService.login({
    email,
    password,
    ipAddress,
    userAgent,
  });

  // Set refresh token in HTTP-only cookie
  res.cookie('refreshToken', result.tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.json(
    success({
      user: result.user,
      accessToken: result.tokens.accessToken,
      expiresIn: result.tokens.accessTokenExpiresIn,
    }, 'Login successful')
  );
});

/**
 * Refresh access token
 * POST /api/v1/auth/refresh
 */
const refreshToken = asyncHandler(async (req, res) => {
  // Get refresh token from cookie or body
  const token = req.cookies.refreshToken || req.body.refreshToken;
  const { ipAddress, userAgent } = extractClientInfo(req);

  const result = await authService.refreshAccessToken({
    refreshToken: token,
    ipAddress,
    userAgent,
  });

  // Update refresh token cookie
  res.cookie('refreshToken', result.tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json(
    success({
      user: result.user,
      accessToken: result.tokens.accessToken,
      expiresIn: result.tokens.accessTokenExpiresIn,
    }, 'Token refreshed successfully')
  );
});

/**
 * Logout user
 * POST /api/v1/auth/logout
 */
const logout = asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken || req.body.refreshToken;
  const { ipAddress, userAgent } = extractClientInfo(req);

  await authService.logout({ refreshToken: token, ipAddress, userAgent });

  // Clear refresh token cookie
  res.clearCookie('refreshToken');

  res.json(success(null, 'Logged out successfully'));
});

/**
 * Logout from all devices
 * POST /api/v1/auth/logout-all
 */
const logoutAll = asyncHandler(async (req, res) => {
  const { ipAddress, userAgent } = extractClientInfo(req);

  await authService.logoutAll(req.user.id, ipAddress, userAgent);

  res.clearCookie('refreshToken');

  res.json(success(null, 'Logged out from all devices'));
});

/**
 * Get current user profile
 * GET /api/v1/auth/me
 */
const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getUserById(req.user.id);

  res.json(success(user));
});

/**
 * Change password
 * POST /api/v1/auth/change-password
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const { ipAddress, userAgent } = extractClientInfo(req);

  await authService.changePassword({
    userId: req.user.id,
    currentPassword,
    newPassword,
    ipAddress,
    userAgent,
  });

  res.clearCookie('refreshToken');

  res.json(success(null, 'Password changed successfully. Please login again.'));
});

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  logoutAll,
  getMe,
  changePassword,
};
