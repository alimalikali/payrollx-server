/**
 * Payroll Routes
 */

const express = require('express');
const payrollController = require('../controllers/payroll.controller');
const { protect, hrOnly } = require('../middleware/auth');
const { commonValidation, body, handleValidation } = require('../middleware/validate');

const router = express.Router();

router.use(protect);

const payrollValidation = {
  create: [
    body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
    body('year').isInt({ min: 2020, max: 2100 }).withMessage('Invalid year'),
    handleValidation,
  ],
  calculateTax: [
    body('grossSalary').isFloat({ min: 0 }).withMessage('Gross salary must be a positive number'),
    body('isFiler').optional().isBoolean(),
    handleValidation,
  ],
};

// Tax info (public for authenticated users)
router.get('/tax-slabs', payrollController.getTaxSlabs);
router.post('/calculate-tax', payrollValidation.calculateTax, payrollController.calculateTax);

// Payslips
router.get('/payslips', payrollController.getPayslips);
router.get('/payslips/:id', commonValidation.uuid('id')[0], payrollController.getPayslip);

// Payroll runs (HR only)
router.get('/runs', hrOnly, payrollController.getPayrollRuns);
router.post('/runs', hrOnly, payrollValidation.create, payrollController.createPayrollRun);
router.get('/runs/:id', hrOnly, commonValidation.uuid('id')[0], payrollController.getPayrollRun);
router.post('/runs/:id/process', hrOnly, commonValidation.uuid('id')[0], payrollController.processPayroll);
router.post('/runs/:id/approve', hrOnly, commonValidation.uuid('id')[0], payrollController.approvePayroll);

// Salary history
router.get('/salary-history', payrollController.getSalaryHistory);

module.exports = router;
