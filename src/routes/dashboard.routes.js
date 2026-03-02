const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const { protect, hrOnly } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/hr', hrOnly, dashboardController.getHrDashboard);
router.get('/employee', dashboardController.getEmployeeDashboard);

module.exports = router;
