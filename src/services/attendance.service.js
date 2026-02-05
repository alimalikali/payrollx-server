/**
 * Attendance Service
 * Handles attendance tracking operations
 */

const db = require('../config/database');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const { transformAttendance, transformAttendanceList } = require('../utils/transformers');

/**
 * Get attendance records with filters
 */
const getAttendance = async ({ page = 1, limit = 10, employeeId, startDate, endDate, status, date }) => {
  const offset = (page - 1) * limit;
  const params = [];
  let paramIndex = 1;
  const conditions = [];

  if (employeeId) {
    conditions.push(`a.employee_id = $${paramIndex}`);
    params.push(employeeId);
    paramIndex++;
  }

  if (date) {
    conditions.push(`a.date = $${paramIndex}`);
    params.push(date);
    paramIndex++;
  } else {
    if (startDate) {
      conditions.push(`a.date >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      conditions.push(`a.date <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }
  }

  if (status) {
    conditions.push(`a.status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await db.query(
    `SELECT COUNT(*) FROM attendance a ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  // Get records
  const query = `
    SELECT
      a.*,
      e.first_name,
      e.last_name,
      e.employee_id as emp_code,
      d.name as department_name
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    LEFT JOIN departments d ON e.department_id = d.id
    ${whereClause}
    ORDER BY a.date DESC, a.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  params.push(limit, offset);
  const result = await db.query(query, params);

  return {
    attendance: transformAttendanceList(result.rows),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get attendance by ID
 */
const getAttendanceById = async (id) => {
  const query = `
    SELECT
      a.*,
      e.first_name,
      e.last_name,
      e.employee_id as emp_code,
      d.name as department_name
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    LEFT JOIN departments d ON e.department_id = d.id
    WHERE a.id = $1
  `;

  const result = await db.query(query, [id]);

  if (result.rows.length === 0) {
    throw new NotFoundError('Attendance record not found');
  }

  return transformAttendance(result.rows[0]);
};

/**
 * Mark attendance (check-in)
 */
const checkIn = async ({ employeeId, checkInLocation, markedBy }) => {
  const today = new Date().toISOString().split('T')[0];

  // Check if already checked in today
  const existing = await db.query(
    'SELECT id, check_in FROM attendance WHERE employee_id = $1 AND date = $2',
    [employeeId, today]
  );

  if (existing.rows.length > 0 && existing.rows[0].check_in) {
    throw new BadRequestError('Already checked in for today');
  }

  const now = new Date().toTimeString().split(' ')[0];
  const workStartTime = '09:00:00';
  const status = now > workStartTime ? 'late' : 'present';

  if (existing.rows.length > 0) {
    // Update existing record
    const result = await db.query(
      `UPDATE attendance
       SET check_in = $1, status = $2, check_in_location = $3
       WHERE id = $4
       RETURNING *`,
      [now, status, checkInLocation, existing.rows[0].id]
    );
    return getAttendanceById(result.rows[0].id);
  }

  // Create new record
  const result = await db.query(
    `INSERT INTO attendance (employee_id, date, check_in, status, check_in_location, marked_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [employeeId, today, now, status, checkInLocation, markedBy]
  );

  return getAttendanceById(result.rows[0].id);
};

/**
 * Mark attendance (check-out)
 */
const checkOut = async ({ employeeId, checkOutLocation }) => {
  const today = new Date().toISOString().split('T')[0];

  // Get today's attendance
  const existing = await db.query(
    'SELECT id, check_in, check_out FROM attendance WHERE employee_id = $1 AND date = $2',
    [employeeId, today]
  );

  if (existing.rows.length === 0 || !existing.rows[0].check_in) {
    throw new BadRequestError('Must check in before checking out');
  }

  if (existing.rows[0].check_out) {
    throw new BadRequestError('Already checked out for today');
  }

  const now = new Date().toTimeString().split(' ')[0];

  const result = await db.query(
    `UPDATE attendance
     SET check_out = $1, check_out_location = $2
     WHERE id = $3
     RETURNING *`,
    [now, checkOutLocation, existing.rows[0].id]
  );

  return getAttendanceById(result.rows[0].id);
};

/**
 * Mark attendance manually (for HR/Admin)
 */
const markAttendance = async ({ employeeId, date, checkIn, checkOut, status, notes, markedBy }) => {
  // Check if record exists
  const existing = await db.query(
    'SELECT id FROM attendance WHERE employee_id = $1 AND date = $2',
    [employeeId, date]
  );

  if (existing.rows.length > 0) {
    // Update existing record
    const result = await db.query(
      `UPDATE attendance
       SET check_in = $1, check_out = $2, status = $3, notes = $4, marked_by = $5
       WHERE id = $6
       RETURNING *`,
      [checkIn, checkOut, status, notes, markedBy, existing.rows[0].id]
    );
    return getAttendanceById(result.rows[0].id);
  }

  // Create new record
  const result = await db.query(
    `INSERT INTO attendance (employee_id, date, check_in, check_out, status, notes, marked_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [employeeId, date, checkIn, checkOut, status, notes, markedBy]
  );

  return getAttendanceById(result.rows[0].id);
};

/**
 * Get attendance summary for employee
 */
const getEmployeeSummary = async (employeeId, month, year) => {
  const query = `
    SELECT
      COUNT(*) FILTER (WHERE status = 'present') as present_days,
      COUNT(*) FILTER (WHERE status = 'absent') as absent_days,
      COUNT(*) FILTER (WHERE status = 'late') as late_days,
      COUNT(*) FILTER (WHERE status = 'half_day') as half_days,
      COUNT(*) FILTER (WHERE status = 'on_leave') as leave_days,
      SUM(COALESCE(working_hours, 0)) as total_hours,
      SUM(COALESCE(overtime_hours, 0)) as overtime_hours
    FROM attendance
    WHERE employee_id = $1
      AND EXTRACT(MONTH FROM date) = $2
      AND EXTRACT(YEAR FROM date) = $3
  `;

  const result = await db.query(query, [employeeId, month, year]);
  const summary = result.rows[0];

  return {
    presentDays: parseInt(summary.present_days) || 0,
    absentDays: parseInt(summary.absent_days) || 0,
    lateDays: parseInt(summary.late_days) || 0,
    halfDays: parseInt(summary.half_days) || 0,
    leaveDays: parseInt(summary.leave_days) || 0,
    totalHours: parseFloat(summary.total_hours) || 0,
    overtimeHours: parseFloat(summary.overtime_hours) || 0,
  };
};

/**
 * Get daily attendance stats
 */
const getDailyStats = async (date) => {
  const targetDate = date || new Date().toISOString().split('T')[0];

  const query = `
    SELECT
      COUNT(DISTINCT e.id) as total_employees,
      COUNT(DISTINCT a.employee_id) FILTER (WHERE a.status = 'present' OR a.status = 'late') as present,
      COUNT(DISTINCT a.employee_id) FILTER (WHERE a.status = 'absent') as absent,
      COUNT(DISTINCT a.employee_id) FILTER (WHERE a.status = 'late') as late,
      COUNT(DISTINCT a.employee_id) FILTER (WHERE a.status = 'on_leave') as on_leave
    FROM employees e
    LEFT JOIN attendance a ON e.id = a.employee_id AND a.date = $1
    WHERE e.status = 'active'
  `;

  const result = await db.query(query, [targetDate]);
  const stats = result.rows[0];

  return {
    date: targetDate,
    totalEmployees: parseInt(stats.total_employees),
    present: parseInt(stats.present),
    absent: parseInt(stats.absent),
    late: parseInt(stats.late),
    onLeave: parseInt(stats.on_leave),
    attendanceRate: stats.total_employees > 0
      ? Math.round((parseInt(stats.present) / parseInt(stats.total_employees)) * 100)
      : 0,
  };
};

/**
 * Bulk mark attendance
 */
const bulkMarkAttendance = async (records, markedBy) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const results = [];
    for (const record of records) {
      const result = await markAttendance({
        ...record,
        markedBy,
      });
      results.push(result);
    }

    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  getAttendance,
  getAttendanceById,
  checkIn,
  checkOut,
  markAttendance,
  getEmployeeSummary,
  getDailyStats,
  bulkMarkAttendance,
};
