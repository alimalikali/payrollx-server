const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const { protect, hrOrAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/hr', hrOrAdmin, dashboardController.getHrDashboard);
router.get('/employee', dashboardController.getEmployeeDashboard);

module.exports = router;
