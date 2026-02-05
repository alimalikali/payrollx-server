/**
 * Attendance Routes
 */

const express = require('express');
const attendanceController = require('../controllers/attendance.controller');
const { protect, hrOrAdmin } = require('../middleware/auth');
const { commonValidation, body, handleValidation } = require('../middleware/validate');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Attendance validation rules
const attendanceValidation = {
  checkIn: [
    body('employeeId').optional().isUUID().withMessage('Invalid employee ID'),
    body('checkInLocation').optional().trim(),
    handleValidation,
  ],
  checkOut: [
    body('employeeId').optional().isUUID().withMessage('Invalid employee ID'),
    body('checkOutLocation').optional().trim(),
    handleValidation,
  ],
  mark: [
    body('employeeId').isUUID().withMessage('Employee ID is required'),
    body('date').isISO8601().withMessage('Valid date is required'),
    body('status').isIn(['present', 'absent', 'half_day', 'late', 'on_leave', 'holiday', 'weekend'])
      .withMessage('Invalid status'),
    body('checkIn').optional().matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('Invalid time format (HH:MM)'),
    body('checkOut').optional().matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('Invalid time format (HH:MM)'),
    body('notes').optional().trim(),
    handleValidation,
  ],
  bulk: [
    body('records').isArray({ min: 1 }).withMessage('Records array is required'),
    body('records.*.employeeId').isUUID().withMessage('Employee ID is required'),
    body('records.*.date').isISO8601().withMessage('Valid date is required'),
    body('records.*.status').isIn(['present', 'absent', 'half_day', 'late', 'on_leave', 'holiday', 'weekend']),
    handleValidation,
  ],
};

// Self check-in/out (all authenticated users)
router.post('/check-in', attendanceValidation.checkIn, attendanceController.checkIn);
router.post('/check-out', attendanceValidation.checkOut, attendanceController.checkOut);

// Stats endpoints
router.get('/daily-stats', hrOrAdmin, attendanceController.getDailyStats);
router.get('/summary/:employeeId', commonValidation.uuid('employeeId')[0], attendanceController.getEmployeeSummary);

// CRUD and admin operations
router.get('/', hrOrAdmin, attendanceController.getAttendance);
router.get('/:id', commonValidation.uuid('id')[0], attendanceController.getAttendanceById);
router.post('/mark', hrOrAdmin, attendanceValidation.mark, attendanceController.markAttendance);
router.post('/bulk', hrOrAdmin, attendanceValidation.bulk, attendanceController.bulkMark);

module.exports = router;
