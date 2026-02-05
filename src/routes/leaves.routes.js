/**
 * Leave Routes
 */

const express = require('express');
const leaveController = require('../controllers/leave.controller');
const { protect, hrOrAdmin } = require('../middleware/auth');
const { commonValidation, body, handleValidation } = require('../middleware/validate');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Leave validation rules
const leaveValidation = {
  create: [
    body('employeeId').optional().isUUID().withMessage('Invalid employee ID'),
    body('leaveTypeId').isUUID().withMessage('Leave type ID is required'),
    body('startDate').isISO8601().withMessage('Valid start date is required'),
    body('endDate').isISO8601().withMessage('Valid end date is required'),
    body('reason').trim().notEmpty().withMessage('Reason is required'),
    body('isHalfDay').optional().isBoolean(),
    body('halfDayType').optional().isIn(['first_half', 'second_half']),
    body('attachmentUrl').optional().isURL().withMessage('Invalid attachment URL'),
    handleValidation,
  ],
  reject: [
    body('reason').trim().notEmpty().withMessage('Rejection reason is required'),
    handleValidation,
  ],
  allocate: [
    body('employeeId').isUUID().withMessage('Employee ID is required'),
    body('leaveTypeId').isUUID().withMessage('Leave type ID is required'),
    body('year').optional().isInt({ min: 2020, max: 2100 }),
    body('allocatedDays').isFloat({ min: 0 }).withMessage('Allocated days must be a positive number'),
    body('carriedForwardDays').optional().isFloat({ min: 0 }),
    handleValidation,
  ],
};

// Static routes (must be before :id routes)
router.get('/types', leaveController.getLeaveTypes);
router.get('/pending-count', hrOrAdmin, leaveController.getPendingCount);
router.get('/balance/:employeeId', commonValidation.uuid('employeeId')[0], leaveController.getLeaveBalance);

// Allocation (admin only)
router.post('/allocate', hrOrAdmin, leaveValidation.allocate, leaveController.allocateLeave);

// CRUD routes
router.get('/', leaveController.getLeaveRequests);
router.post('/', leaveValidation.create, leaveController.createLeaveRequest);
router.get('/:id', commonValidation.uuid('id')[0], leaveController.getLeaveRequest);

// Approval workflow
router.post('/:id/approve', hrOrAdmin, commonValidation.uuid('id')[0], leaveController.approveLeaveRequest);
router.post('/:id/reject', hrOrAdmin, commonValidation.uuid('id')[0], leaveValidation.reject, leaveController.rejectLeaveRequest);
router.post('/:id/cancel', commonValidation.uuid('id')[0], leaveController.cancelLeaveRequest);

module.exports = router;
