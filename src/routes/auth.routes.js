/**
 * Authentication Routes
 */

const express = require('express');
const authController = require('../controllers/auth.controller');
const { protect, adminOnly } = require('../middleware/auth');
const { authValidation } = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Public routes (with rate limiting)
router.post('/register', authLimiter, authValidation.register, authController.register);
router.post('/login', authLimiter, authValidation.login, authController.login);
router.post('/refresh', authLimiter, authValidation.refreshToken, authController.refreshToken);
router.post('/logout', authController.logout);

// Protected routes
router.use(protect); // All routes below require authentication

router.get('/me', authController.getMe);
router.post('/change-password', authValidation.changePassword, authController.changePassword);
router.post('/logout-all', authController.logoutAll);

module.exports = router;
