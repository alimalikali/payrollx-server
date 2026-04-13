/**
 * Leave Service
 * Handles leave requests and allocations
 */

const db = require('../config/database');
const { NotFoundError, BadRequestError, ForbiddenError } = require('../utils/errors');
const { transformLeaveRequest, transformLeaveRequestList } = require('../utils/transformers');
const notificationService = require('./notification.service');
const { PRIVILEGED_ROLES } = require('../domain/permissions');

const getPrivilegedUserIds = async () => {
  const result = await db.query(
    `SELECT id
     FROM users
     WHERE role = ANY($1::text[]) AND is_active = true`,
    [PRIVILEGED_ROLES]
  );

  return result.rows.map((row) => row.id);
};

const notifyPrivilegedUsers = async ({ type, title, message, entityId }) => {
  const privilegedUserIds = await getPrivilegedUserIds();
  if (privilegedUserIds.length === 0) {
    return;
  }

  await notificationService.createBulkNotifications(
    privilegedUserIds.map((userId) => ({
      userId,
      type,
      title,
      message,
      entityType: 'leave_request',
      entityId,
    }))
  );
};

/**
 * Get leave requests with filters
 */
const getLeaveRequests = async ({ page = 1, limit = 10, employeeId, status, leaveTypeId, startDate, endDate }) => {
  const offset = (page - 1) * limit;
  const params = [];
  let paramIndex = 1;
  const conditions = [];

  if (employeeId) {
    conditions.push(`lr.employee_id = $${paramIndex}`);
    params.push(employeeId);
    paramIndex++;
  }

  if (status) {
    conditions.push(`lr.status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  if (leaveTypeId) {
    conditions.push(`lr.leave_type_id = $${paramIndex}`);
    params.push(leaveTypeId);
    paramIndex++;
  }

  if (startDate) {
    conditions.push(`lr.start_date >= $${paramIndex}`);
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    conditions.push(`lr.end_date <= $${paramIndex}`);
    params.push(endDate);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await db.query(
    `SELECT COUNT(*) FROM leave_requests lr ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  // Get requests
  const query = `
    SELECT
      lr.*,
      lt.name as leave_type_name,
      lt.code as leave_type_code,
      lt.is_paid,
      e.first_name,
      e.last_name,
      e.employee_id as emp_code,
      d.name as department_name,
      u.email as approved_by_email
    FROM leave_requests lr
    JOIN leave_types lt ON lr.leave_type_id = lt.id
    JOIN employees e ON lr.employee_id = e.id
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN users u ON lr.approved_by = u.id
    ${whereClause}
    ORDER BY lr.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  params.push(limit, offset);
  const result = await db.query(query, params);

  return {
    leaves: transformLeaveRequestList(result.rows),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get leave request by ID
 */
const getLeaveRequestById = async (id) => {
  const query = `
    SELECT
      lr.*,
      lt.name as leave_type_name,
      lt.code as leave_type_code,
      lt.is_paid,
      e.first_name,
      e.last_name,
      e.employee_id as emp_code,
      d.name as department_name,
      u.email as approved_by_email
    FROM leave_requests lr
    JOIN leave_types lt ON lr.leave_type_id = lt.id
    JOIN employees e ON lr.employee_id = e.id
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN users u ON lr.approved_by = u.id
    WHERE lr.id = $1
  `;

  const result = await db.query(query, [id]);

  if (result.rows.length === 0) {
    throw new NotFoundError('Leave request not found');
  }

  return transformLeaveRequest(result.rows[0]);
};

/**
 * Create leave request
 */
const createLeaveRequest = async ({
  employeeId,
  leaveTypeId,
  startDate,
  endDate,
  reason,
  isHalfDay,
  halfDayType,
  attachmentUrl,
  requestedByRole,
}) => {
  // Validate dates
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start) {
    throw new BadRequestError('End date must be after start date');
  }

  // Calculate total days
  let totalDays = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) { // Skip weekends
      totalDays++;
    }
    current.setDate(current.getDate() + 1);
  }

  if (isHalfDay) {
    totalDays = 0.5;
  }

  // Check leave balance
  const year = start.getFullYear();
  const balanceResult = await db.query(
    `SELECT remaining_days FROM leave_allocations
     WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3`,
    [employeeId, leaveTypeId, year]
  );

  if (balanceResult.rows.length === 0) {
    throw new BadRequestError('No leave allocation found for this leave type');
  }

  const remainingDays = parseFloat(balanceResult.rows[0].remaining_days);
  if (remainingDays < totalDays) {
    throw new BadRequestError(`Insufficient leave balance. Available: ${remainingDays} days`);
  }

  // Check for overlapping leave requests
  const overlapResult = await db.query(
    `SELECT id FROM leave_requests
     WHERE employee_id = $1
       AND status IN ('pending', 'approved')
       AND ((start_date <= $2 AND end_date >= $2)
         OR (start_date <= $3 AND end_date >= $3)
         OR (start_date >= $2 AND end_date <= $3))`,
    [employeeId, startDate, endDate]
  );

  if (overlapResult.rows.length > 0) {
    throw new BadRequestError('You already have a leave request for this period');
  }

  // Create request
  const result = await db.query(
    `INSERT INTO leave_requests (
      employee_id, leave_type_id, start_date, end_date,
      total_days, is_half_day, half_day_type, reason, attachment_url
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [employeeId, leaveTypeId, startDate, endDate, totalDays, isHalfDay || false, halfDayType, reason, attachmentUrl]
  );

  if (requestedByRole === 'employee') {
    const requestInfoResult = await db.query(
      `SELECT e.first_name, e.last_name, lt.name AS leave_type_name
       FROM employees e
       JOIN leave_types lt ON lt.id = $1
       WHERE e.id = $2`,
      [leaveTypeId, employeeId]
    );

    const info = requestInfoResult.rows[0];
    const employeeName = info
      ? `${info.first_name || ''} ${info.last_name || ''}`.trim()
      : 'An employee';
    const leaveTypeName = info?.leave_type_name || 'Leave';

    await notifyPrivilegedUsers({
      type: 'leave_request_submitted',
      title: 'New leave request',
      message: `${employeeName} applied for ${leaveTypeName} (${totalDays} day${totalDays > 1 ? 's' : ''}).`,
      entityId: result.rows[0].id,
    });
  }

  return getLeaveRequestById(result.rows[0].id);
};

/**
 * Approve leave request
 */
const approveLeaveRequest = async (id, approvedBy) => {
  const request = await db.query(
    `SELECT lr.*, e.user_id, e.first_name, e.last_name, lt.name AS leave_type_name,
            u2.email AS employee_email
     FROM leave_requests lr
     JOIN employees e ON e.id = lr.employee_id
     JOIN leave_types lt ON lt.id = lr.leave_type_id
     LEFT JOIN users u2 ON u2.id = e.user_id
     WHERE lr.id = $1`,
    [id]
  );

  if (request.rows.length === 0) {
    throw new NotFoundError('Leave request not found');
  }

  if (request.rows[0].status !== 'pending') {
    throw new BadRequestError('Only pending requests can be approved');
  }

  await db.query(
    `UPDATE leave_requests
     SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [approvedBy, id]
  );

  if (request.rows[0].user_id) {
    const employeeName = `${request.rows[0].first_name || ''} ${request.rows[0].last_name || ''}`.trim();
    await notificationService.createNotification({
      userId: request.rows[0].user_id,
      type: 'leave_request_approved',
      title: 'Leave request approved',
      message: `Your ${request.rows[0].leave_type_name} request has been approved.`,
      entityType: 'leave_request',
      entityId: id,
      email: request.rows[0].employee_email,
      emailTemplate: 'leaveApproved',
      emailData: {
        employeeName: employeeName || 'Employee',
        leaveType: request.rows[0].leave_type_name,
        startDate: request.rows[0].start_date,
        endDate: request.rows[0].end_date,
      },
    });
  }

  const employeeName = `${request.rows[0].first_name || ''} ${request.rows[0].last_name || ''}`.trim() || 'An employee';
  await notifyPrivilegedUsers({
    type: 'leave_request_approved',
    title: 'Leave request approved',
    message: `${employeeName}'s ${request.rows[0].leave_type_name} request was approved.`,
    entityId: id,
  });

  return getLeaveRequestById(id);
};

/**
 * Reject leave request
 */
const rejectLeaveRequest = async (id, approvedBy, rejectionReason) => {
  const request = await db.query(
    `SELECT lr.*, e.user_id, e.first_name, e.last_name, lt.name AS leave_type_name,
            u2.email AS employee_email
     FROM leave_requests lr
     JOIN employees e ON e.id = lr.employee_id
     JOIN leave_types lt ON lt.id = lr.leave_type_id
     LEFT JOIN users u2 ON u2.id = e.user_id
     WHERE lr.id = $1`,
    [id]
  );

  if (request.rows.length === 0) {
    throw new NotFoundError('Leave request not found');
  }

  if (request.rows[0].status !== 'pending') {
    throw new BadRequestError('Only pending requests can be rejected');
  }

  await db.query(
    `UPDATE leave_requests
     SET status = 'rejected', approved_by = $1, approved_at = CURRENT_TIMESTAMP, rejection_reason = $2
     WHERE id = $3`,
    [approvedBy, rejectionReason, id]
  );

  if (request.rows[0].user_id) {
    const employeeName = `${request.rows[0].first_name || ''} ${request.rows[0].last_name || ''}`.trim();
    await notificationService.createNotification({
      userId: request.rows[0].user_id,
      type: 'leave_request_rejected',
      title: 'Leave request rejected',
      message: `Your ${request.rows[0].leave_type_name} request was rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
      entityType: 'leave_request',
      entityId: id,
      email: request.rows[0].employee_email,
      emailTemplate: 'leaveRejected',
      emailData: {
        employeeName: employeeName || 'Employee',
        leaveType: request.rows[0].leave_type_name,
        reason: rejectionReason,
      },
    });
  }

  const employeeName = `${request.rows[0].first_name || ''} ${request.rows[0].last_name || ''}`.trim() || 'An employee';
  await notifyPrivilegedUsers({
    type: 'leave_request_rejected',
    title: 'Leave request rejected',
    message: `${employeeName}'s ${request.rows[0].leave_type_name} request was rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
    entityId: id,
  });

  return getLeaveRequestById(id);
};

/**
 * Cancel leave request
 */
const cancelLeaveRequest = async (id, userId, options = {}) => {
  const { isEmployee = false, employeeId = null } = options;
  const request = await db.query(
    `SELECT lr.*, e.user_id, e.first_name, e.last_name, lt.name AS leave_type_name
     FROM leave_requests lr
     JOIN employees e ON e.id = lr.employee_id
     JOIN leave_types lt ON lt.id = lr.leave_type_id
     WHERE lr.id = $1`,
    [id]
  );

  if (request.rows.length === 0) {
    throw new NotFoundError('Leave request not found');
  }

  if (!['pending', 'approved'].includes(request.rows[0].status)) {
    throw new BadRequestError('Only pending or approved requests can be cancelled');
  }

  if (isEmployee && request.rows[0].employee_id !== employeeId) {
    throw new ForbiddenError('You can only cancel your own leave requests');
  }

  await db.query(
    `UPDATE leave_requests SET status = 'cancelled' WHERE id = $1`,
    [id]
  );

  const employeeName = `${request.rows[0].first_name || ''} ${request.rows[0].last_name || ''}`.trim() || 'An employee';
  const privilegedMessage = `${employeeName}'s ${request.rows[0].leave_type_name} request was cancelled.`;

  if (!isEmployee && request.rows[0].user_id) {
    await notificationService.createNotification({
      userId: request.rows[0].user_id,
      type: 'leave_request_cancelled',
      title: 'Leave request cancelled',
      message: `Your ${request.rows[0].leave_type_name} request was cancelled.`,
      entityType: 'leave_request',
      entityId: id,
    });
  }

  await notifyPrivilegedUsers({
    type: 'leave_request_cancelled',
    title: 'Leave request cancelled',
    message: privilegedMessage,
    entityId: id,
  });

  return getLeaveRequestById(id);
};

/**
 * Get leave types
 */
const getLeaveTypes = async () => {
  const result = await db.query(
    `SELECT * FROM leave_types WHERE is_active = true ORDER BY name`
  );

  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    daysPerYear: row.days_per_year,
    isPaid: row.is_paid,
    isCarryForward: row.is_carry_forward,
    maxCarryForwardDays: row.max_carry_forward_days,
  }));
};

/**
 * Get leave balance for employee
 */
const getLeaveBalance = async (employeeId, year) => {
  const targetYear = year || new Date().getFullYear();

  const query = `
    SELECT
      lt.id as leave_type_id,
      lt.name as leave_type_name,
      lt.code as leave_type_code,
      COALESCE(la.allocated_days, 0) as allocated_days,
      COALESCE(la.used_days, 0) as used_days,
      COALESCE(la.carried_forward_days, 0) as carried_forward_days,
      COALESCE(la.remaining_days, 0) as remaining_days
    FROM leave_types lt
    LEFT JOIN leave_allocations la ON lt.id = la.leave_type_id
      AND la.employee_id = $1
      AND la.year = $2
    WHERE lt.is_active = true
    ORDER BY lt.name
  `;

  const result = await db.query(query, [employeeId, targetYear]);

  return result.rows.map(row => ({
    leaveTypeId: row.leave_type_id,
    leaveTypeName: row.leave_type_name,
    leaveTypeCode: row.leave_type_code,
    allocatedDays: parseFloat(row.allocated_days),
    usedDays: parseFloat(row.used_days),
    carriedForwardDays: parseFloat(row.carried_forward_days),
    remainingDays: parseFloat(row.remaining_days),
  }));
};

/**
 * Allocate leave for employee
 */
const allocateLeave = async ({ employeeId, leaveTypeId, year, allocatedDays, carriedForwardDays = 0 }) => {
  const existing = await db.query(
    `SELECT id FROM leave_allocations
     WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3`,
    [employeeId, leaveTypeId, year]
  );

  if (existing.rows.length > 0) {
    await db.query(
      `UPDATE leave_allocations
       SET allocated_days = $1, carried_forward_days = $2
       WHERE id = $3`,
      [allocatedDays, carriedForwardDays, existing.rows[0].id]
    );
  } else {
    await db.query(
      `INSERT INTO leave_allocations (employee_id, leave_type_id, year, allocated_days, carried_forward_days)
       VALUES ($1, $2, $3, $4, $5)`,
      [employeeId, leaveTypeId, year, allocatedDays, carriedForwardDays]
    );
  }

  return getLeaveBalance(employeeId, year);
};

/**
 * Get pending leave requests count
 */
const getPendingCount = async () => {
  const result = await db.query(
    `SELECT COUNT(*) FROM leave_requests WHERE status = 'pending'`
  );

  return parseInt(result.rows[0].count);
};

module.exports = {
  getLeaveRequests,
  getLeaveRequestById,
  createLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
  getLeaveTypes,
  getLeaveBalance,
  allocateLeave,
  getPendingCount,
};
