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
<<<<<<< HEAD
const dashboardRoutes = require('./dashboard.routes');
=======
const userRoutes = require('./users.routes');
const notificationsRoutes = require('./notifications.routes');
const uploadsRoutes = require('./uploads.routes');
>>>>>>> bdd7077 (Updated project files)

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
<<<<<<< HEAD
        dashboard: '/api/v1/dashboard',
=======
        users: '/api/v1/users',
        notifications: '/api/v1/notifications',
        uploads: '/api/v1/uploads',
>>>>>>> bdd7077 (Updated project files)
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
<<<<<<< HEAD
router.use('/dashboard', dashboardRoutes);
=======
router.use('/users', userRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/uploads', uploadsRoutes);
>>>>>>> bdd7077 (Updated project files)

module.exports = router;
