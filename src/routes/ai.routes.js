/**
 * AI Routes
 */

const express = require('express');
const aiController = require('../controllers/ai.controller');
const { protect, hrOnly } = require('../middleware/auth');
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
router.get('/employee/me', aiController.getEmployeeInsights);

// Chatbot (all authenticated users)
router.post('/chatbot', chatValidation, aiController.sendChatMessage);
router.get('/chatbot/history/:sessionId', commonValidation.uuid('sessionId')[0], aiController.getChatHistory);

// Alerts (HR only)
router.get('/alerts', hrOnly, aiController.getAlerts);
router.patch('/alerts/:id', hrOnly, commonValidation.uuid('id')[0], alertStatusValidation, aiController.updateAlertStatus);

// Fraud Detection (HR only)
router.post('/fraud-detection/run', hrOnly, aiController.runFraudDetection);
router.get('/fraud-detection/stats', hrOnly, aiController.getFraudStats);
router.get('/fraud-detection/employee-risk', hrOnly, aiController.getEmployeeRiskScores);

// Salary Anomaly (HR only)
router.post('/salary-anomaly/detect', hrOnly, aiController.detectSalaryAnomalies);
router.get('/salary-anomaly/distribution', hrOnly, aiController.getSalaryDistribution);

// Payroll Forecast (HR only)
router.get('/forecast', hrOnly, aiController.generateForecast);
router.get('/forecast/budget-comparison', hrOnly, aiController.getBudgetComparison);

// Salary Recommendations (HR only)
router.get('/salary-recommendations', hrOnly, aiController.getBulkRecommendations);
router.get('/salary-recommendations/:employeeId', hrOnly, commonValidation.uuid('employeeId')[0], aiController.getSalaryRecommendation);

module.exports = router;
