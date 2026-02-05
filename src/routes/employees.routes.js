/**
 * Employee Routes
 */

const express = require('express');
const employeeController = require('../controllers/employee.controller');
const { protect, hrOrAdmin, ownerOrAdmin } = require('../middleware/auth');
const { commonValidation, body, handleValidation } = require('../middleware/validate');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Employee validation rules
const employeeValidation = {
  create: [
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('joiningDate').isISO8601().withMessage('Valid joining date is required'),
    body('phone').optional().trim(),
    body('cnic').optional().matches(/^\d{5}-\d{7}-\d$/).withMessage('Invalid CNIC format (XXXXX-XXXXXXX-X)'),
    body('gender').optional().isIn(['male', 'female', 'other']),
    body('employmentType').optional().isIn(['full_time', 'part_time', 'contract', 'intern']),
    body('status').optional().isIn(['active', 'inactive', 'terminated', 'on_leave']),
    body('taxFilingStatus').optional().isIn(['filer', 'non_filer']),
    body('basicSalary').optional().isFloat({ min: 0 }),
    handleValidation,
  ],
  update: [
    body('firstName').optional().trim().notEmpty(),
    body('lastName').optional().trim().notEmpty(),
    body('email').optional().trim().isEmail().normalizeEmail(),
    body('phone').optional().trim(),
    body('cnic').optional().matches(/^\d{5}-\d{7}-\d$/).withMessage('Invalid CNIC format'),
    body('gender').optional().isIn(['male', 'female', 'other']),
    body('employmentType').optional().isIn(['full_time', 'part_time', 'contract', 'intern']),
    body('status').optional().isIn(['active', 'inactive', 'terminated', 'on_leave']),
    body('taxFilingStatus').optional().isIn(['filer', 'non_filer']),
    handleValidation,
  ],
};

// Statistics routes (must be before :id routes)
router.get('/stats', hrOrAdmin, employeeController.getStats);
router.get('/by-department', hrOrAdmin, employeeController.getByDepartment);

// CRUD routes
router.get('/', hrOrAdmin, employeeController.getEmployees);
router.post('/', hrOrAdmin, employeeValidation.create, employeeController.createEmployee);
router.get('/:id', commonValidation.uuid('id')[0], employeeController.getEmployee);
router.put('/:id', hrOrAdmin, commonValidation.uuid('id')[0], employeeValidation.update, employeeController.updateEmployee);
router.delete('/:id', hrOrAdmin, commonValidation.uuid('id')[0], employeeController.deleteEmployee);

module.exports = router;
