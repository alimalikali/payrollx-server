const db = require('../config/database');
const { formatLocalDate } = require('../utils/dateTime');

const getHrDashboard = async () => {
  const today = formatLocalDate(new Date());
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [
    employeeStats,
    attendanceStats,
    leaveStats,
    payrollStats,
    aiStats,
    forecastResult,
    monthlyAttendanceTrendResult,
    departmentAttendanceResult,
    payrollSummaryResult,
    currentMonthPayrollResult,
    pendingLeaveRequestsResult,
    leaveDistributionResult,
    workforceAlertsResult,
    contractExpiryAlertsResult,
  ] = await Promise.all([
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
        COUNT(DISTINCT a.employee_id) FILTER (WHERE a.status = 'late') as late,
        COUNT(DISTINCT e.id) as total_employees
      FROM employees e
      LEFT JOIN attendance a ON e.id = a.employee_id AND a.date = $1
      WHERE e.status = 'active'
    `, [today]),
    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (
          WHERE status = 'approved'
            AND approved_at IS NOT NULL
            AND EXTRACT(MONTH FROM approved_at) = $1
            AND EXTRACT(YEAR FROM approved_at) = $2
        ) as approved_this_month
      FROM leave_requests
    `, [month, year]),
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
    db.query(`
      SELECT
        COALESCE(SUM(net_salary), 0) as net_salary
      FROM payslips
      WHERE month = $1 AND year = $2
    `, [month, year]),
    db.query(`
      SELECT
        date,
        COUNT(DISTINCT employee_id) FILTER (WHERE status IN ('present', 'late')) as present,
        COUNT(DISTINCT employee_id) FILTER (WHERE status = 'absent') as absent,
        COUNT(DISTINCT employee_id) FILTER (WHERE status = 'late') as late
      FROM attendance
      WHERE EXTRACT(MONTH FROM date) = $1
        AND EXTRACT(YEAR FROM date) = $2
      GROUP BY date
      ORDER BY date
    `, [month, year]),
    db.query(`
      SELECT
        COALESCE(d.id::text, 'unassigned') as department_id,
        COALESCE(d.name, 'Unassigned') as department_name,
        COUNT(DISTINCT e.id) FILTER (WHERE a.status IN ('present', 'late')) as present,
        COUNT(DISTINCT e.id) FILTER (WHERE a.status = 'absent') as absent,
        COUNT(DISTINCT e.id) FILTER (WHERE a.status = 'late') as late
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN attendance a ON a.employee_id = e.id AND a.date = $1
      WHERE e.status = 'active'
      GROUP BY d.id, d.name
      ORDER BY department_name
    `, [today]),
    db.query(`
      SELECT
        COALESCE(SUM(gross_salary), 0) as total_salary_current_month,
        COALESCE(SUM(total_deductions), 0) as total_deductions,
        COALESCE(SUM(bonus), 0) as total_bonuses,
        COALESCE(SUM(income_tax), 0) as total_tax,
        COUNT(DISTINCT employee_id) FILTER (WHERE status = 'paid') as paid_employee_count
      FROM payslips
      WHERE month = $1 AND year = $2
    `, [month, year]),
    db.query(`
      SELECT id, month, year, status
      FROM payroll_runs
      WHERE month = $1 AND year = $2
      ORDER BY created_at DESC
      LIMIT 1
    `, [month, year]),
    db.query(`
      SELECT
        lr.id,
        lr.employee_id,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        lt.name as leave_type_name,
        lr.start_date,
        lr.end_date,
        lr.total_days,
        lr.reason,
        lr.status
      FROM leave_requests lr
      JOIN employees e ON e.id = lr.employee_id
      JOIN leave_types lt ON lt.id = lr.leave_type_id
      WHERE lr.status = 'pending'
      ORDER BY lr.created_at DESC
      LIMIT 5
    `),
    db.query(`
      SELECT
        lt.id as leave_type_id,
        lt.name as leave_type_name,
        COUNT(*) as request_count
      FROM leave_requests lr
      JOIN leave_types lt ON lt.id = lr.leave_type_id
      WHERE lr.status = 'approved'
        AND lr.approved_at IS NOT NULL
        AND EXTRACT(MONTH FROM lr.approved_at) = $1
        AND EXTRACT(YEAR FROM lr.approved_at) = $2
      GROUP BY lt.id, lt.name
      ORDER BY lt.name
    `, [month, year]),
    db.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE joining_date IS NOT NULL
            AND EXTRACT(MONTH FROM joining_date) = $1
            AND EXTRACT(YEAR FROM joining_date) = $2
        ) as new_employees_this_month,
        COUNT(*) FILTER (
          WHERE status = 'active'
            AND joining_date IS NOT NULL
            AND probation_period_months IS NOT NULL
            AND probation_period_months > 0
            AND (joining_date + (probation_period_months || ' month')::interval) >= CURRENT_DATE
        ) as employees_on_probation,
        COUNT(*) FILTER (
          WHERE status = 'terminated'
            AND end_date IS NOT NULL
            AND EXTRACT(MONTH FROM end_date) = $1
            AND EXTRACT(YEAR FROM end_date) = $2
        ) as recently_resigned_employees
      FROM employees
    `, [month, year]),
    db.query(`
      SELECT
        id as employee_id,
        CONCAT(first_name, ' ', last_name) as employee_name,
        end_date
      FROM employees
      WHERE status = 'active'
        AND employment_type = 'contract'
        AND end_date IS NOT NULL
        AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      ORDER BY end_date ASC
      LIMIT 5
    `),
  ]);

  return {
    ...buildHrDashboardData({
      employeeStats: employeeStats.rows[0],
      attendanceStats: attendanceStats.rows[0],
      leaveStats: leaveStats.rows[0],
      latestPayroll: payrollStats.rows[0] || null,
      aiStats: aiStats.rows[0],
      forecastRow: forecastResult.rows[0],
      monthlyAttendanceTrend: monthlyAttendanceTrendResult.rows,
      departmentAttendance: departmentAttendanceResult.rows,
      payrollSummary: payrollSummaryResult.rows[0],
      currentMonthPayroll: currentMonthPayrollResult.rows[0] || null,
      pendingLeaveRequests: pendingLeaveRequestsResult.rows,
      leaveDistribution: leaveDistributionResult.rows,
      workforceAlerts: workforceAlertsResult.rows[0],
      contractExpiryAlerts: contractExpiryAlertsResult.rows,
    }),
  };
};

const buildHrDashboardData = ({
  employeeStats,
  attendanceStats,
  leaveStats,
  latestPayroll,
  aiStats,
  forecastRow,
  monthlyAttendanceTrend,
  departmentAttendance,
  payrollSummary,
  currentMonthPayroll,
  pendingLeaveRequests,
  leaveDistribution,
  workforceAlerts,
  contractExpiryAlerts,
}) => {
  const totalEmployees = parseInt(employeeStats.total) || 0;
  const activeEmployees = parseInt(employeeStats.active) || 0;
  const present = parseInt(attendanceStats.present) || 0;
  const absent = parseInt(attendanceStats.absent) || 0;
  const late = parseInt(attendanceStats.late) || 0;
  const attendanceBase = parseInt(attendanceStats.total_employees) || 0;
  const attendanceRate = attendanceBase > 0 ? Math.round((present / attendanceBase) * 100) : 0;
  const pendingLeaves = parseInt(leaveStats.pending) || 0;
  const approvedLeavesThisMonth = parseInt(leaveStats.approved_this_month) || 0;
  const totalSalaryCurrentMonth = parseFloat(payrollSummary.total_salary_current_month) || 0;
  const totalDeductions = parseFloat(payrollSummary.total_deductions) || 0;
  const totalBonuses = parseFloat(payrollSummary.total_bonuses) || 0;
  const totalTax = parseFloat(payrollSummary.total_tax) || 0;
  const paidEmployeeCount = parseInt(payrollSummary.paid_employee_count) || 0;
  const pendingSalaryProcessing = Math.max(activeEmployees - paidEmployeeCount, 0);

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
      newAlerts: parseInt(aiStats.new_alerts) || 0,
      highRiskAlerts: parseInt(aiStats.high_risk_alerts) || 0,
      salaryAnomalies: parseInt(aiStats.salary_anomalies) || 0,
      currentMonthNetSalaryProjection: parseFloat(forecastRow.net_salary) || 0,
    },
    attendanceSummary: {
      today: {
        present,
        absent,
        late,
      },
      lateArrivalsCount: monthlyAttendanceTrend.reduce(
        (count, row) => count + (parseInt(row.late) || 0),
        0
      ),
      monthlyTrend: monthlyAttendanceTrend.map((row) => ({
        label: formatLocalDate(row.date),
        present: parseInt(row.present) || 0,
        absent: parseInt(row.absent) || 0,
        late: parseInt(row.late) || 0,
      })),
      departmentWise: departmentAttendance.map((row) => ({
        departmentId: row.department_id,
        departmentName: row.department_name,
        present: parseInt(row.present) || 0,
        absent: parseInt(row.absent) || 0,
        late: parseInt(row.late) || 0,
      })),
    },
    payrollSummary: {
      currentMonthTotalPayrollCost: totalSalaryCurrentMonth,
      pendingSalaryProcessing,
      totalSalaryCurrentMonth,
      totalDeductions,
      totalBonuses,
      taxSummary: totalTax,
      currentMonthPayroll: currentMonthPayroll ? {
        id: currentMonthPayroll.id,
        month: currentMonthPayroll.month,
        year: currentMonthPayroll.year,
        status: currentMonthPayroll.status,
      } : null,
    },
    leaveSummary: {
      pendingRequests: pendingLeaves,
      approvedThisMonth: approvedLeavesThisMonth,
      distribution: leaveDistribution.map((row) => ({
        leaveTypeId: row.leave_type_id,
        leaveTypeName: row.leave_type_name,
        count: parseInt(row.request_count) || 0,
      })),
    },
    pendingLeaveRequests: pendingLeaveRequests.map((row) => ({
      id: row.id,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      leaveTypeName: row.leave_type_name,
      startDate: formatLocalDate(row.start_date),
      endDate: formatLocalDate(row.end_date),
      totalDays: parseFloat(row.total_days) || 0,
      reason: row.reason,
      status: row.status,
    })),
    workforceAlerts: {
      newEmployeesThisMonth: parseInt(workforceAlerts.new_employees_this_month) || 0,
      employeesOnProbation: parseInt(workforceAlerts.employees_on_probation) || 0,
      recentlyResignedEmployees: parseInt(workforceAlerts.recently_resigned_employees) || 0,
      contractExpiryAlerts: contractExpiryAlerts.map((row) => ({
        employeeId: row.employee_id,
        employeeName: row.employee_name,
        endDate: formatLocalDate(row.end_date),
      })),
    },
  };
};

const getEmployeeDashboard = async ({ employeeId }) => {
  const today = formatLocalDate(new Date());
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
