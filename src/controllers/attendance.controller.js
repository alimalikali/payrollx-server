/**
 * Attendance Controller
 * Handles HTTP requests for attendance endpoints
 */

const attendanceService = require('../services/attendance.service');
const { success } = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Get all attendance records
 * GET /api/v1/attendance
 */
const getAttendance = asyncHandler(async (req, res) => {
  const { page, limit, employeeId, startDate, endDate, status, date } = req.query;

  const result = await attendanceService.getAttendance({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
    employeeId,
    startDate,
    endDate,
    status,
    date,
  });

  res.json(success(result.attendance, null, result.pagination));
});

/**
 * Get attendance by ID
 * GET /api/v1/attendance/:id
 */
const getAttendanceById = asyncHandler(async (req, res) => {
  const attendance = await attendanceService.getAttendanceById(req.params.id);

  res.json(success(attendance));
});

/**
 * Check in
 * POST /api/v1/attendance/check-in
 */
const checkIn = asyncHandler(async (req, res) => {
  const { employeeId, checkInLocation } = req.body;

  // Use requesting user's employee ID if not provided (self check-in)
  const targetEmployeeId = employeeId || req.user.employeeId;

  const attendance = await attendanceService.checkIn({
    employeeId: targetEmployeeId,
    checkInLocation,
    markedBy: req.user.id,
  });

  res.status(201).json(success(attendance, 'Checked in successfully'));
});

/**
 * Check out
 * POST /api/v1/attendance/check-out
 */
const checkOut = asyncHandler(async (req, res) => {
  const { employeeId, checkOutLocation } = req.body;

  const targetEmployeeId = employeeId || req.user.employeeId;

  const attendance = await attendanceService.checkOut({
    employeeId: targetEmployeeId,
    checkOutLocation,
  });

  res.json(success(attendance, 'Checked out successfully'));
});

/**
 * Mark attendance manually
 * POST /api/v1/attendance/mark
 */
const markAttendance = asyncHandler(async (req, res) => {
  const { employeeId, date, checkIn, checkOut, status, notes } = req.body;

  const attendance = await attendanceService.markAttendance({
    employeeId,
    date,
    checkIn,
    checkOut,
    status,
    notes,
    markedBy: req.user.id,
  });

  res.status(201).json(success(attendance, 'Attendance marked successfully'));
});

/**
 * Get employee attendance summary
 * GET /api/v1/attendance/summary/:employeeId
 */
const getEmployeeSummary = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const { month, year } = req.query;

  const currentDate = new Date();
  const targetMonth = parseInt(month) || currentDate.getMonth() + 1;
  const targetYear = parseInt(year) || currentDate.getFullYear();

  const summary = await attendanceService.getEmployeeSummary(
    employeeId,
    targetMonth,
    targetYear
  );

  res.json(success(summary));
});

/**
 * Get daily attendance stats
 * GET /api/v1/attendance/daily-stats
 */
const getDailyStats = asyncHandler(async (req, res) => {
  const { date } = req.query;

  const stats = await attendanceService.getDailyStats(date);

  res.json(success(stats));
});

/**
 * Bulk mark attendance
 * POST /api/v1/attendance/bulk
 */
const bulkMark = asyncHandler(async (req, res) => {
  const { records } = req.body;

  const results = await attendanceService.bulkMarkAttendance(records, req.user.id);

  res.status(201).json(success(results, `${results.length} attendance records marked`));
});

module.exports = {
  getAttendance,
  getAttendanceById,
  checkIn,
  checkOut,
  markAttendance,
  getEmployeeSummary,
  getDailyStats,
  bulkMark,
};
