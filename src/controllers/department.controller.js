/**
 * Department Controller
 */

const departmentService = require('../services/department.service');
const { success } = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');

const getDepartments = asyncHandler(async (req, res) => {
  const { includeInactive } = req.query;
  const departments = await departmentService.getDepartments({
    includeInactive: includeInactive === 'true',
  });

  res.json(success(departments));
});

const getDepartment = asyncHandler(async (req, res) => {
  const department = await departmentService.getDepartmentById(req.params.id);

  res.json(success(department));
});

const createDepartment = asyncHandler(async (req, res) => {
  const department = await departmentService.createDepartment(req.body);

  res.status(201).json(success(department, 'Department created successfully'));
});

const updateDepartment = asyncHandler(async (req, res) => {
  const department = await departmentService.updateDepartment(req.params.id, req.body);

  res.json(success(department, 'Department updated successfully'));
});

const deleteDepartment = asyncHandler(async (req, res) => {
  await departmentService.deleteDepartment(req.params.id);

  res.json(success(null, 'Department deleted successfully'));
});

module.exports = {
  getDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
};
