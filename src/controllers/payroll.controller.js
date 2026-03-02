/**
 * Payroll Controller
 */

const payrollService = require('../services/payroll.service');
const { calculateAllDeductions, getTaxSlabInfo } = require('../utils/taxCalculator');
const { success } = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');
const { BadRequestError, ForbiddenError } = require('../utils/errors');

/**
 * Get all payroll runs
 */
const getPayrollRuns = asyncHandler(async (req, res) => {
  const { page, limit, year, status } = req.query;

  const result = await payrollService.getPayrollRuns({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
    year: year ? parseInt(year) : undefined,
    status,
  });

  res.json(success(result.payrollRuns, null, result.pagination));
});

/**
 * Get payroll run by ID
 */
const getPayrollRun = asyncHandler(async (req, res) => {
  const payrollRun = await payrollService.getPayrollRunById(req.params.id);

  res.json(success(payrollRun));
});

/**
 * Create payroll run (draft)
 */
const createPayrollRun = asyncHandler(async (req, res) => {
  const { month, year } = req.body;

  const payrollRun = await payrollService.createPayrollRun({
    month,
    year,
    processedBy: req.user.id,
  });

  res.status(201).json(success(payrollRun, 'Payroll run created'));
});

/**
 * Process payroll
 */
const processPayroll = asyncHandler(async (req, res) => {
  const payrollRun = await payrollService.processPayroll(req.params.id, req.user.id);

  res.json(success(payrollRun, 'Payroll processed successfully'));
});

/**
 * Approve payroll
 */
const approvePayroll = asyncHandler(async (req, res) => {
  const payrollRun = await payrollService.approvePayroll(req.params.id, req.user.id);

  res.json(success(payrollRun, 'Payroll approved'));
});

/**
 * Get payslips
 */
const getPayslips = asyncHandler(async (req, res) => {
  const { payrollRunId, employeeId, page, limit } = req.query;
  let targetEmployeeId = employeeId;

  if (req.user.role === 'employee') {
    if (!req.user.employeeId) {
      throw new BadRequestError('Employee profile not linked to this account');
    }
    if (employeeId && employeeId !== req.user.employeeId) {
      throw new ForbiddenError('You can only view your own payslips');
    }
    targetEmployeeId = req.user.employeeId;
  }

  const result = await payrollService.getPayslips({
    payrollRunId,
    employeeId: targetEmployeeId,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
  });

  res.json(success(result.payslips, null, result.pagination));
});

/**
 * Get payslip by ID
 */
const getPayslip = asyncHandler(async (req, res) => {
  const payslip = await payrollService.getPayslipById(req.params.id);

  if (req.user.role === 'employee' && payslip.employeeId !== req.user.employeeId) {
    throw new ForbiddenError('You do not have permission to access this payslip');
  }

  res.json(success(payslip));
});

/**
 * Get salary history
 */
const getSalaryHistory = asyncHandler(async (req, res) => {
  const { employeeId, months } = req.query;
  let targetEmployeeId = employeeId;

  if (req.user.role === 'employee') {
    if (!req.user.employeeId) {
      throw new BadRequestError('Employee profile not linked to this account');
    }
    if (employeeId && employeeId !== req.user.employeeId) {
      throw new ForbiddenError('You can only view your own salary history');
    }
    targetEmployeeId = req.user.employeeId;
  }

  if (!targetEmployeeId) {
    throw new BadRequestError('Employee ID is required');
  }

  const history = await payrollService.getSalaryHistory(
    targetEmployeeId,
    parseInt(months, 10) || 12
  );

  res.json(success(history));
});

/**
 * Calculate tax preview
 */
const calculateTax = asyncHandler(async (req, res) => {
  const { grossSalary, isFiler } = req.body;

  const taxDetails = calculateAllDeductions(grossSalary, isFiler === true);

  res.json(success(taxDetails));
});

/**
 * Get tax slabs
 */
const getTaxSlabs = asyncHandler(async (req, res) => {
  const { type } = req.query;
  const isFiler = type !== 'non_filer';

  const slabs = getTaxSlabInfo(isFiler);

  res.json(success({
    type: isFiler ? 'filer' : 'non_filer',
    slabs,
  }));
});

module.exports = {
  getPayrollRuns,
  getPayrollRun,
  createPayrollRun,
  processPayroll,
  approvePayroll,
  getPayslips,
  getPayslip,
  getSalaryHistory,
  calculateTax,
  getTaxSlabs,
};
