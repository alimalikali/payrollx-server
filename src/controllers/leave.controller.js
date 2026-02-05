/**
 * Leave Controller
 * Handles HTTP requests for leave endpoints
 */

const leaveService = require('../services/leave.service');
const { success } = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Get all leave requests
 * GET /api/v1/leaves
 */
const getLeaveRequests = asyncHandler(async (req, res) => {
  const { page, limit, employeeId, status, leaveTypeId, startDate, endDate } = req.query;

  const result = await leaveService.getLeaveRequests({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
    employeeId,
    status,
    leaveTypeId,
    startDate,
    endDate,
  });

  res.json(success(result.leaves, null, result.pagination));
});

/**
 * Get leave request by ID
 * GET /api/v1/leaves/:id
 */
const getLeaveRequest = asyncHandler(async (req, res) => {
  const leave = await leaveService.getLeaveRequestById(req.params.id);

  res.json(success(leave));
});

/**
 * Create leave request
 * POST /api/v1/leaves
 */
const createLeaveRequest = asyncHandler(async (req, res) => {
  const { employeeId, leaveTypeId, startDate, endDate, reason, isHalfDay, halfDayType, attachmentUrl } = req.body;

  // Use requesting user's employee ID if not provided
  const targetEmployeeId = employeeId || req.user.employeeId;

  const leave = await leaveService.createLeaveRequest({
    employeeId: targetEmployeeId,
    leaveTypeId,
    startDate,
    endDate,
    reason,
    isHalfDay,
    halfDayType,
    attachmentUrl,
  });

  res.status(201).json(success(leave, 'Leave request created successfully'));
});

/**
 * Approve leave request
 * POST /api/v1/leaves/:id/approve
 */
const approveLeaveRequest = asyncHandler(async (req, res) => {
  const leave = await leaveService.approveLeaveRequest(req.params.id, req.user.id);

  res.json(success(leave, 'Leave request approved'));
});

/**
 * Reject leave request
 * POST /api/v1/leaves/:id/reject
 */
const rejectLeaveRequest = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const leave = await leaveService.rejectLeaveRequest(req.params.id, req.user.id, reason);

  res.json(success(leave, 'Leave request rejected'));
});

/**
 * Cancel leave request
 * POST /api/v1/leaves/:id/cancel
 */
const cancelLeaveRequest = asyncHandler(async (req, res) => {
  const leave = await leaveService.cancelLeaveRequest(req.params.id, req.user.id);

  res.json(success(leave, 'Leave request cancelled'));
});

/**
 * Get leave types
 * GET /api/v1/leaves/types
 */
const getLeaveTypes = asyncHandler(async (req, res) => {
  const types = await leaveService.getLeaveTypes();

  res.json(success(types));
});

/**
 * Get leave balance for employee
 * GET /api/v1/leaves/balance/:employeeId
 */
const getLeaveBalance = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const { year } = req.query;

  const balance = await leaveService.getLeaveBalance(employeeId, parseInt(year));

  res.json(success(balance));
});

/**
 * Allocate leave for employee
 * POST /api/v1/leaves/allocate
 */
const allocateLeave = asyncHandler(async (req, res) => {
  const { employeeId, leaveTypeId, year, allocatedDays, carriedForwardDays } = req.body;

  const balance = await leaveService.allocateLeave({
    employeeId,
    leaveTypeId,
    year: year || new Date().getFullYear(),
    allocatedDays,
    carriedForwardDays,
  });

  res.json(success(balance, 'Leave allocated successfully'));
});

/**
 * Get pending leave count
 * GET /api/v1/leaves/pending-count
 */
const getPendingCount = asyncHandler(async (req, res) => {
  const count = await leaveService.getPendingCount();

  res.json(success({ count }));
});

module.exports = {
  getLeaveRequests,
  getLeaveRequest,
  createLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
  getLeaveTypes,
  getLeaveBalance,
  allocateLeave,
  getPendingCount,
};
