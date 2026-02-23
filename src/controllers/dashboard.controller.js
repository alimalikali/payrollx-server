const dashboardService = require('../services/dashboard.service');
const { success } = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');
const { ForbiddenError } = require('../utils/errors');

const getHrDashboard = asyncHandler(async (req, res) => {
  const data = await dashboardService.getHrDashboard();
  res.json(success(data));
});

const getEmployeeDashboard = asyncHandler(async (req, res) => {
  if (!req.user.employeeId) {
    throw new ForbiddenError('Employee profile not found for this user');
  }

  const data = await dashboardService.getEmployeeDashboard({ employeeId: req.user.employeeId });
  res.json(success(data));
});

module.exports = {
  getHrDashboard,
  getEmployeeDashboard,
};
