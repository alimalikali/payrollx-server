/**
 * Employee Controller
 * Handles HTTP requests for employee endpoints
 */

const employeeService = require('../services/employee.service');
const { success } = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');
const { ForbiddenError } = require('../utils/errors');

/**
 * Get all employees
 * GET /api/v1/employees
 */
const getEmployees = asyncHandler(async (req, res) => {
  const { page, limit, search, department, status, sortBy, sortOrder } = req.query;

  const result = await employeeService.getEmployees({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
    search,
    department,
    status,
    sortBy,
    sortOrder,
  });

  res.json(success(result.employees, null, result.pagination));
});

/**
 * Get employee by ID
 * GET /api/v1/employees/:id
 */
const getEmployee = asyncHandler(async (req, res) => {
  if (req.user.role === 'employee') {
    const ownProfile = await employeeService.getEmployeeById(req.user.employeeId);
    const requestedIdentifier = String(req.params.id).toLowerCase();
    const ownUuid = String(ownProfile.id).toLowerCase();
    const ownCode = String(ownProfile.employeeId || '').toLowerCase();

    if (requestedIdentifier !== ownUuid && requestedIdentifier !== ownCode) {
      throw new ForbiddenError('You do not have permission to access this employee profile');
    }

    return res.json(success(ownProfile));
  }

  const employee = await employeeService.getEmployeeByIdentifier(req.params.id);

  res.json(success(employee));
});

/**
 * Create employee
 * POST /api/v1/employees
 */
const createEmployee = asyncHandler(async (req, res) => {
  const employee = await employeeService.createEmployee(req.body);

  res.status(201).json(success(employee, 'Employee created successfully'));
});

/**
 * Update employee
 * PUT /api/v1/employees/:id
 */
const updateEmployee = asyncHandler(async (req, res) => {
  const employee = await employeeService.updateEmployee(req.params.id, req.body);

  res.json(success(employee, 'Employee updated successfully'));
});

/**
 * Delete employee
 * DELETE /api/v1/employees/:id
 */
const deleteEmployee = asyncHandler(async (req, res) => {
  await employeeService.deleteEmployee(req.params.id);

  res.json(success(null, 'Employee deleted successfully'));
});

/**
 * Get employee statistics
 * GET /api/v1/employees/stats
 */
const getStats = asyncHandler(async (req, res) => {
  const stats = await employeeService.getEmployeeStats();

  res.json(success(stats));
});

/**
 * Get employees by department
 * GET /api/v1/employees/by-department
 */
const getByDepartment = asyncHandler(async (req, res) => {
  const data = await employeeService.getEmployeesByDepartment();

  res.json(success(data));
});

module.exports = {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getStats,
  getByDepartment,
};
