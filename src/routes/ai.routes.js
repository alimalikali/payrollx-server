/**
 * AI Routes
 */

const express = require('express');
const aiController = require('../controllers/ai.controller');
const { protect, hrOrAdmin, adminOnly } = require('../middleware/auth');
const { commonValidation, body, handleValidation } = require('../middleware/validate');

const router = express.Router();

router.use(protect);

// Chatbot validation
const chatValidation = [
  body('message').trim().notEmpty().withMessage('Message is required'),
  body('sessionId').optional().isUUID(),
  handleValidation,
];

// Alert status validation
const alertStatusValidation = [
  body('status').isIn(['new', 'acknowledged', 'investigating', 'resolved', 'dismissed'])
    .withMessage('Invalid status'),
  body('resolutionNotes').optional().trim(),
  handleValidation,
];

// Dashboard stats (all authenticated users)
router.get('/dashboard', aiController.getDashboardStats);

// Chatbot (all authenticated users)
router.post('/chatbot', chatValidation, aiController.sendChatMessage);
router.get('/chatbot/history/:sessionId', commonValidation.uuid('sessionId')[0], aiController.getChatHistory);

// Alerts (HR/Admin)
router.get('/alerts', hrOrAdmin, aiController.getAlerts);
router.patch('/alerts/:id', hrOrAdmin, commonValidation.uuid('id')[0], alertStatusValidation, aiController.updateAlertStatus);

// Fraud Detection (Admin only)
router.post('/fraud-detection/run', adminOnly, aiController.runFraudDetection);
router.get('/fraud-detection/stats', hrOrAdmin, aiController.getFraudStats);

// Salary Anomaly (HR/Admin)
router.post('/salary-anomaly/detect', hrOrAdmin, aiController.detectSalaryAnomalies);
router.get('/salary-anomaly/distribution', hrOrAdmin, aiController.getSalaryDistribution);

// Payroll Forecast (HR/Admin)
router.get('/forecast', hrOrAdmin, aiController.generateForecast);
router.get('/forecast/budget-comparison', hrOrAdmin, aiController.getBudgetComparison);

// Salary Recommendations (HR/Admin)
router.get('/salary-recommendations', hrOrAdmin, aiController.getBulkRecommendations);
router.get('/salary-recommendations/:employeeId', hrOrAdmin, commonValidation.uuid('employeeId')[0], aiController.getSalaryRecommendation);

module.exports = router;
