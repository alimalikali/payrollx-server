/**
 * Employee Controller
 * Handles HTTP requests for employee endpoints
 */

const employeeService = require('../services/employee.service');
const { success } = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');
const { ForbiddenError, NotFoundError } = require('../utils/errors');

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

  if (req.user.role === 'employee') {
    if (!req.user.employeeId) {
      throw new NotFoundError('Employee profile not found');
    }
    if (employee.id !== req.user.employeeId) {
      throw new ForbiddenError('You can only view your own profile');
    }
  }

  res.json(success(employee));
});

/**
 * Get current user's employee profile
 * GET /api/v1/employees/me
 */
const getMyEmployee = asyncHandler(async (req, res) => {
  if (!req.user.employeeId) {
    throw new NotFoundError('Employee profile not found');
  }

  const employee = await employeeService.getEmployeeById(req.user.employeeId);

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

/**
 * Get attendance and leave summary for employee
 * GET /api/v1/employees/:id/attendance-leave-summary
 */
const getAttendanceLeaveSummary = asyncHandler(async (req, res) => {
  const employee = await employeeService.getEmployeeByIdentifier(req.params.id);

  if (req.user.role === 'employee') {
    if (!req.user.employeeId) {
      throw new NotFoundError('Employee profile not found');
    }
    if (employee.id !== req.user.employeeId) {
      throw new ForbiddenError('You can only view your own profile summary');
    }
  }

  const summary = await employeeService.getAttendanceLeaveSummary(employee.id, {
    month: req.query.month ? parseInt(req.query.month, 10) : undefined,
    year: req.query.year ? parseInt(req.query.year, 10) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
  });

  res.json(success(summary));
});

/**
 * Update current employee profile image
 * PATCH /api/v1/employees/me/profile-image
 */
const updateMyProfileImage = asyncHandler(async (req, res) => {
  if (!req.user.employeeId) {
    throw new NotFoundError('Employee profile not found');
  }

  const employee = await employeeService.updateEmployee(req.user.employeeId, {
    profileImage: req.body.profileImage,
  });

  res.json(success(employee, 'Profile image updated successfully'));
});

module.exports = {
  getEmployees,
  getEmployee,
  getMyEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getStats,
  getByDepartment,
  getAttendanceLeaveSummary,
  updateMyProfileImage,
};
