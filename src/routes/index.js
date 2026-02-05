const express = require('express');

const router = express.Router();

// Import route modules
const authRoutes = require('./auth.routes');
const employeeRoutes = require('./employees.routes');
const attendanceRoutes = require('./attendance.routes');
const leaveRoutes = require('./leaves.routes');
const departmentRoutes = require('./departments.routes');
const payrollRoutes = require('./payroll.routes');
const aiRoutes = require('./ai.routes');
const settingsRoutes = require('./settings.routes');

// API Information endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'PayrollX API',
      version: '1.0.0',
      description: 'Smart AI-Powered Payroll System',
      endpoints: {
        auth: '/api/v1/auth',
        employees: '/api/v1/employees',
        attendance: '/api/v1/attendance',
        leaves: '/api/v1/leaves',
        payroll: '/api/v1/payroll',
        payslips: '/api/v1/payslips',
        ai: '/api/v1/ai',
        chatbot: '/api/v1/chatbot',
        settings: '/api/v1/settings',
      },
    },
  });
});

// Register routes
router.use('/auth', authRoutes);
router.use('/employees', employeeRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/leaves', leaveRoutes);
router.use('/departments', departmentRoutes);
router.use('/payroll', payrollRoutes);
router.use('/ai', aiRoutes);
router.use('/settings', settingsRoutes);

module.exports = router;
