const db = require('../config/database');

const getHrDashboard = async () => {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [employeeStats, attendanceStats, leaveStats, payrollStats, aiStats] = await Promise.all([
    db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active
      FROM employees
    `),
    db.query(`
      SELECT
        COUNT(DISTINCT a.employee_id) FILTER (WHERE a.status IN ('present', 'late')) as present,
        COUNT(DISTINCT a.employee_id) FILTER (WHERE a.status = 'absent') as absent,
        COUNT(DISTINCT e.id) as total_employees
      FROM employees e
      LEFT JOIN attendance a ON e.id = a.employee_id AND a.date = $1
      WHERE e.status = 'active'
    `, [today]),
    db.query(`
      SELECT COUNT(*) FILTER (WHERE status = 'pending') as pending
      FROM leave_requests
    `),
    db.query(`
      SELECT id, month, year, status, total_employees, total_gross_salary, total_net_salary, created_at
      FROM payroll_runs
      ORDER BY year DESC, month DESC, created_at DESC
      LIMIT 1
    `),
    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'new') as new_alerts,
        COUNT(*) FILTER (WHERE severity IN ('high', 'critical') AND status IN ('new', 'investigating')) as high_risk_alerts,
        COUNT(*) FILTER (WHERE alert_type = 'salary_anomaly' AND status = 'new') as salary_anomalies
      FROM ai_alerts
    `),
  ]);

  const totalEmployees = parseInt(employeeStats.rows[0].total) || 0;
  const activeEmployees = parseInt(employeeStats.rows[0].active) || 0;
  const present = parseInt(attendanceStats.rows[0].present) || 0;
  const absent = parseInt(attendanceStats.rows[0].absent) || 0;
  const attendanceBase = parseInt(attendanceStats.rows[0].total_employees) || 0;
  const attendanceRate = attendanceBase > 0 ? Math.round((present / attendanceBase) * 100) : 0;
  const pendingLeaves = parseInt(leaveStats.rows[0].pending) || 0;
  const latestPayroll = payrollStats.rows[0] || null;

  const forecastResult = await db.query(`
    SELECT
      COALESCE(SUM(net_salary), 0) as net_salary
    FROM payslips
    WHERE month = $1 AND year = $2
  `, [month, year]);

  return {
    kpis: {
      totalEmployees,
      activeEmployees,
      presentToday: present,
      absentToday: absent,
      attendanceRate,
      pendingLeaves,
    },
    payroll: latestPayroll ? {
      id: latestPayroll.id,
      month: latestPayroll.month,
      year: latestPayroll.year,
      status: latestPayroll.status,
      totalEmployees: latestPayroll.total_employees,
      totalGrossSalary: parseFloat(latestPayroll.total_gross_salary) || 0,
      totalNetSalary: parseFloat(latestPayroll.total_net_salary) || 0,
    } : null,
    ai: {
      newAlerts: parseInt(aiStats.rows[0].new_alerts) || 0,
      highRiskAlerts: parseInt(aiStats.rows[0].high_risk_alerts) || 0,
      salaryAnomalies: parseInt(aiStats.rows[0].salary_anomalies) || 0,
      currentMonthNetSalaryProjection: parseFloat(forecastResult.rows[0].net_salary) || 0,
    },
  };
};

const getEmployeeDashboard = async ({ employeeId }) => {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [
    profileResult,
    todayAttendanceResult,
    monthlyAttendanceResult,
    leaveBalanceResult,
    latestPayslipResult,
    pendingLeavesResult,
  ] = await Promise.all([
    db.query(`
      SELECT
        e.id,
        e.employee_id,
        e.first_name,
        e.last_name,
        e.designation,
        d.name as department_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.id = $1
    `, [employeeId]),
    db.query(`
      SELECT check_in, check_out, status, working_hours
      FROM attendance
      WHERE employee_id = $1 AND date = $2
      LIMIT 1
    `, [employeeId, today]),
    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('present', 'late')) as present_days,
        COUNT(*) FILTER (WHERE status = 'absent') as absent_days,
        COUNT(*) FILTER (WHERE status = 'late') as late_days,
        COALESCE(SUM(working_hours), 0) as total_hours
      FROM attendance
      WHERE employee_id = $1
        AND EXTRACT(MONTH FROM date) = $2
        AND EXTRACT(YEAR FROM date) = $3
    `, [employeeId, month, year]),
    db.query(`
      SELECT
        lt.id as leave_type_id,
        lt.name as leave_type_name,
        COALESCE(la.remaining_days, 0) as remaining_days
      FROM leave_types lt
      LEFT JOIN leave_allocations la ON la.leave_type_id = lt.id AND la.employee_id = $1 AND la.year = $2
      WHERE lt.is_active = true
      ORDER BY lt.name
    `, [employeeId, year]),
    db.query(`
      SELECT month, year, gross_salary, total_deductions, net_salary, status
      FROM payslips
      WHERE employee_id = $1
      ORDER BY year DESC, month DESC, created_at DESC
      LIMIT 1
    `, [employeeId]),
    db.query(`
      SELECT COUNT(*) as pending_count
      FROM leave_requests
      WHERE employee_id = $1 AND status = 'pending'
    `, [employeeId]),
  ]);

  const profile = profileResult.rows[0] || null;
  const todayAttendance = todayAttendanceResult.rows[0] || null;
  const attendance = monthlyAttendanceResult.rows[0];
  const pendingLeaves = parseInt(pendingLeavesResult.rows[0].pending_count) || 0;
  const latestPayslip = latestPayslipResult.rows[0] || null;

  const leaveBalances = leaveBalanceResult.rows.map((row) => ({
    leaveTypeId: row.leave_type_id,
    leaveTypeName: row.leave_type_name,
    remainingDays: parseFloat(row.remaining_days) || 0,
  }));

  const personalAi = buildEmployeeInsights({
    attendance,
    todayAttendance,
    leaveBalances,
    latestPayslip,
    pendingLeaves,
  });

  return {
    profile: profile ? {
      id: profile.id,
      employeeId: profile.employee_id,
      name: `${profile.first_name} ${profile.last_name}`,
      designation: profile.designation,
      departmentName: profile.department_name,
    } : null,
    today: {
      date: today,
      status: todayAttendance?.status || 'absent',
      checkIn: todayAttendance?.check_in || null,
      checkOut: todayAttendance?.check_out || null,
      workingHours: parseFloat(todayAttendance?.working_hours) || 0,
    },
    monthSummary: {
      presentDays: parseInt(attendance.present_days) || 0,
      absentDays: parseInt(attendance.absent_days) || 0,
      lateDays: parseInt(attendance.late_days) || 0,
      totalHours: parseFloat(attendance.total_hours) || 0,
    },
    leaveBalances,
    pendingLeaves,
    latestPayslip: latestPayslip ? {
      month: latestPayslip.month,
      year: latestPayslip.year,
      grossSalary: parseFloat(latestPayslip.gross_salary) || 0,
      totalDeductions: parseFloat(latestPayslip.total_deductions) || 0,
      netSalary: parseFloat(latestPayslip.net_salary) || 0,
      status: latestPayslip.status,
    } : null,
    aiInsights: personalAi,
  };
};

const buildEmployeeInsights = ({ attendance, todayAttendance, leaveBalances, latestPayslip, pendingLeaves }) => {
  const insights = [];
  const actions = [];

  const absentDays = parseInt(attendance.absent_days) || 0;
  const lateDays = parseInt(attendance.late_days) || 0;

  if (!todayAttendance?.check_in) {
    insights.push({
      type: 'attendance_reminder',
      severity: 'medium',
      title: 'Check-in Missing',
      description: 'You have not checked in today.',
    });
    actions.push({ type: 'check_in', label: 'Check In', path: '/employee/attendance' });
  }

  if (lateDays >= 3) {
    insights.push({
      type: 'attendance_pattern',
      severity: 'medium',
      title: 'Frequent Late Arrivals',
      description: `You were marked late ${lateDays} times this month.`,
    });
  }

  if (absentDays >= 2) {
    insights.push({
      type: 'attendance_risk',
      severity: 'low',
      title: 'Absence Trend',
      description: `You have ${absentDays} absences this month.`,
    });
  }

  const lowBalance = leaveBalances.find((item) => item.remainingDays > 0 && item.remainingDays <= 2);
  if (lowBalance) {
    insights.push({
      type: 'leave_balance',
      severity: 'medium',
      title: 'Low Leave Balance',
      description: `${lowBalance.leaveTypeName} has only ${lowBalance.remainingDays} days remaining.`,
    });
    actions.push({ type: 'apply_leave', label: 'Apply Leave', path: '/employee/leaves' });
  }

  if (pendingLeaves > 0) {
    insights.push({
      type: 'leave_pending',
      severity: 'low',
      title: 'Pending Leave Request',
      description: `You have ${pendingLeaves} pending leave request(s).`,
    });
  }

  if (latestPayslip) {
    insights.push({
      type: 'salary_snapshot',
      severity: 'info',
      title: 'Latest Salary Snapshot',
      description: `Net salary for ${latestPayslip.month}/${latestPayslip.year}: PKR ${latestPayslip.netSalary.toLocaleString()}.`,
    });
    actions.push({ type: 'view_payslip', label: 'View Payslips', path: '/employee/payslips' });
  }

  return { insights, actions };
};

module.exports = {
  getHrDashboard,
  getEmployeeDashboard,
};
