/**
 * Fraud Detection Service
 * Detects potential payroll fraud using rule-based analysis
 * Can be enhanced with ML models later
 */

const db = require('../../config/database');

/**
 * Fraud detection rules and thresholds
 */
const FRAUD_RULES = {
  DUPLICATE_BANK_ACCOUNT: {
    severity: 'critical',
    message: 'Multiple employees share the same bank account',
  },
  SALARY_SPIKE: {
    threshold: 0.5, // 50% increase
    severity: 'high',
    message: 'Unusual salary increase detected',
  },
  GHOST_EMPLOYEE: {
    inactivityDays: 60,
    severity: 'critical',
    message: 'Potential ghost employee - no attendance for extended period',
  },
  OVERTIME_ANOMALY: {
    maxHours: 80, // per month
    severity: 'medium',
    message: 'Excessive overtime hours reported',
  },
  DUPLICATE_PAYMENT: {
    severity: 'critical',
    message: 'Duplicate payment detected for same period',
  },
  ROUND_TRIP_SALARY: {
    spikeThreshold: 1.15, // 15% increase followed by revert
    revertTolerance: 0.05, // reverted within 5% of original
    severity: 'high',
    message: 'Salary raised then reverted — possible temporary inflation before payday',
  },
  PAYROLL_ON_LEAVE: {
    severity: 'high',
    message: 'Employee received salary for a month fully covered by approved leave',
  },
  SUSPICIOUS_HIRE: {
    dayThreshold: 14, // hired within 14 days
    severity: 'critical',
    message: 'Newly hired employee processed in payroll with no attendance records',
  },
  SICK_LEAVE_ABUSE: {
    zScoreThreshold: 3.0,
    severity: 'medium',
    message: 'Sick leave usage is statistically abnormal compared to department peers',
  },
  OT_ABSENT_CONTRADICTION: {
    minHoursThreshold: 2, // minimum total contradictory OT hours to avoid noise
    highHoursThreshold: 20,
    severity: 'medium',
    message: 'Overtime hours logged on days marked absent or half-day',
  },
};

/**
 * Run all fraud detection checks
 */
const runFraudDetection = async () => {
  const alerts = [];

  const [
    duplicateBankAlerts,
    salarySpikeAlerts,
    ghostEmployeeAlerts,
    overtimeAlerts,
    duplicatePaymentAlerts,
    roundTripAlerts,
    payrollOnLeaveAlerts,
    suspiciousHireAlerts,
    sickLeaveAbuseAlerts,
    otAbsentAlerts,
  ] = await Promise.all([
    checkDuplicateBankAccounts(),
    checkSalarySpikes(),
    checkGhostEmployees(),
    checkOvertimeAnomalies(),
    checkDuplicatePayments(),
    checkRoundTripSalary(),
    checkPayrollOnLeave(),
    checkSuspiciousHire(),
    checkSickLeaveAbuse(),
    checkOvertimeAbsentContradiction(),
  ]);

  alerts.push(
    ...duplicateBankAlerts,
    ...salarySpikeAlerts,
    ...ghostEmployeeAlerts,
    ...overtimeAlerts,
    ...duplicatePaymentAlerts,
    ...roundTripAlerts,
    ...payrollOnLeaveAlerts,
    ...suspiciousHireAlerts,
    ...sickLeaveAbuseAlerts,
    ...otAbsentAlerts,
  );

  // Store alerts in database (with idempotency guard)
  for (const alert of alerts) {
    await saveAlert(alert);
  }

  return {
    totalAlerts: alerts.length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    high: alerts.filter(a => a.severity === 'high').length,
    medium: alerts.filter(a => a.severity === 'medium').length,
    alerts,
  };
};

/**
 * Check for employees sharing bank accounts
 */
const checkDuplicateBankAccounts = async () => {
  const result = await db.query(`
    SELECT bank_account_number, bank_name,
           array_agg(id) as employee_ids,
           array_agg(first_name || ' ' || last_name) as employee_names
    FROM employees
    WHERE bank_account_number IS NOT NULL
      AND status = 'active'
    GROUP BY bank_account_number, bank_name
    HAVING COUNT(*) > 1
  `);

  return result.rows.map(row => ({
    alertType: 'fraud_detection',
    severity: FRAUD_RULES.DUPLICATE_BANK_ACCOUNT.severity,
    title: 'Duplicate Bank Account Detected',
    description: FRAUD_RULES.DUPLICATE_BANK_ACCOUNT.message,
    details: {
      bankAccount: row.bank_account_number,
      bankName: row.bank_name,
      employees: row.employee_names,
      employeeIds: row.employee_ids,
    },
    confidenceScore: 95,
  }));
};

/**
 * Check for unusual salary increases
 */
const checkSalarySpikes = async () => {
  const result = await db.query(`
    WITH salary_changes AS (
      SELECT
        ss.employee_id,
        e.first_name || ' ' || e.last_name as employee_name,
        ss.gross_salary as current_salary,
        LAG(ss.gross_salary) OVER (
          PARTITION BY ss.employee_id
          ORDER BY ss.effective_from
        ) as previous_salary
      FROM salary_structures ss
      JOIN employees e ON ss.employee_id = e.id
      WHERE e.status = 'active'
    )
    SELECT *,
           ((current_salary - previous_salary) / previous_salary) as change_ratio
    FROM salary_changes
    WHERE previous_salary IS NOT NULL
      AND previous_salary > 0
      AND ((current_salary - previous_salary) / previous_salary) > $1
  `, [FRAUD_RULES.SALARY_SPIKE.threshold]);

  return result.rows.map(row => ({
    alertType: 'fraud_detection',
    employeeId: row.employee_id,
    severity: FRAUD_RULES.SALARY_SPIKE.severity,
    title: 'Unusual Salary Increase',
    description: FRAUD_RULES.SALARY_SPIKE.message,
    details: {
      employeeName: row.employee_name,
      previousSalary: parseFloat(row.previous_salary),
      currentSalary: parseFloat(row.current_salary),
      increasePercentage: Math.round(row.change_ratio * 100),
    },
    confidenceScore: 75,
  }));
};

/**
 * Check for potential ghost employees
 */
const checkGhostEmployees = async () => {
  const result = await db.query(`
    SELECT
      e.id,
      e.first_name || ' ' || e.last_name as employee_name,
      e.employee_id as emp_code,
      MAX(a.date) as last_attendance,
      CURRENT_DATE - MAX(a.date) as days_since_attendance
    FROM employees e
    LEFT JOIN attendance a ON e.id = a.employee_id
    WHERE e.status = 'active'
    GROUP BY e.id, e.first_name, e.last_name, e.employee_id
    HAVING MAX(a.date) IS NULL
       OR (CURRENT_DATE - MAX(a.date)) > $1
  `, [FRAUD_RULES.GHOST_EMPLOYEE.inactivityDays]);

  return result.rows.map(row => ({
    alertType: 'fraud_detection',
    employeeId: row.id,
    severity: FRAUD_RULES.GHOST_EMPLOYEE.severity,
    title: 'Potential Ghost Employee',
    description: FRAUD_RULES.GHOST_EMPLOYEE.message,
    details: {
      employeeName: row.employee_name,
      employeeCode: row.emp_code,
      lastAttendance: row.last_attendance,
      daysSinceAttendance: row.days_since_attendance || 'Never recorded',
    },
    confidenceScore: row.last_attendance ? 70 : 90,
  }));
};

/**
 * Check for overtime anomalies
 */
const checkOvertimeAnomalies = async () => {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const result = await db.query(`
    SELECT
      e.id,
      e.first_name || ' ' || e.last_name as employee_name,
      SUM(a.overtime_hours) as total_overtime
    FROM employees e
    JOIN attendance a ON e.id = a.employee_id
    WHERE e.status = 'active'
      AND EXTRACT(MONTH FROM a.date) = $1
      AND EXTRACT(YEAR FROM a.date) = $2
    GROUP BY e.id, e.first_name, e.last_name
    HAVING SUM(a.overtime_hours) > $3
  `, [currentMonth, currentYear, FRAUD_RULES.OVERTIME_ANOMALY.maxHours]);

  return result.rows.map(row => ({
    alertType: 'fraud_detection',
    employeeId: row.id,
    severity: FRAUD_RULES.OVERTIME_ANOMALY.severity,
    title: 'Excessive Overtime',
    description: FRAUD_RULES.OVERTIME_ANOMALY.message,
    details: {
      employeeName: row.employee_name,
      overtimeHours: parseFloat(row.total_overtime),
      threshold: FRAUD_RULES.OVERTIME_ANOMALY.maxHours,
    },
    confidenceScore: 65,
  }));
};

/**
 * Check for duplicate payments — same employee paid twice in the same month/year
 */
const checkDuplicatePayments = async () => {
  const result = await db.query(`
    SELECT
      p.employee_id,
      e.first_name || ' ' || e.last_name AS employee_name,
      e.employee_id AS employee_code,
      p.month,
      p.year,
      COUNT(*) AS payment_count,
      SUM(p.net_salary) AS total_paid,
      array_agg(p.id::text) AS payslip_ids
    FROM payslips p
    JOIN employees e ON p.employee_id = e.id
    GROUP BY p.employee_id, e.first_name, e.last_name, e.employee_id, p.month, p.year
    HAVING COUNT(*) > 1
    ORDER BY p.year DESC, p.month DESC
  `);

  return result.rows.map(row => ({
    alertType: 'fraud_detection',
    employeeId: row.employee_id,
    severity: FRAUD_RULES.DUPLICATE_PAYMENT.severity,
    title: 'Duplicate Payment Detected',
    description: FRAUD_RULES.DUPLICATE_PAYMENT.message,
    details: {
      employeeName: row.employee_name,
      employeeCode: row.employee_code,
      month: row.month,
      year: row.year,
      paymentCount: parseInt(row.payment_count),
      totalPaid: parseFloat(row.total_paid),
      payslipIds: row.payslip_ids,
    },
    confidenceScore: 98,
  }));
};

/**
 * Check for round-trip salary manipulation — salary raised >15% then reverted
 */
const checkRoundTripSalary = async () => {
  const result = await db.query(`
    WITH ordered_salaries AS (
      SELECT
        ss.employee_id,
        e.first_name || ' ' || e.last_name AS employee_name,
        ss.gross_salary,
        ss.effective_from,
        LEAD(ss.gross_salary) OVER (PARTITION BY ss.employee_id ORDER BY ss.effective_from) AS next_salary,
        LAG(ss.gross_salary)  OVER (PARTITION BY ss.employee_id ORDER BY ss.effective_from) AS prev_salary
      FROM salary_structures ss
      JOIN employees e ON ss.employee_id = e.id
      WHERE e.status = 'active'
    )
    SELECT
      employee_id,
      employee_name,
      prev_salary,
      gross_salary AS spike_salary,
      next_salary  AS reverted_salary,
      effective_from,
      ROUND(((gross_salary - prev_salary) / NULLIF(prev_salary, 0)) * 100, 1) AS spike_pct
    FROM ordered_salaries
    WHERE prev_salary IS NOT NULL
      AND next_salary  IS NOT NULL
      AND prev_salary  > 0
      AND gross_salary > prev_salary * $1
      AND next_salary  < gross_salary
      AND ABS(next_salary - prev_salary) / NULLIF(prev_salary, 0) < $2
  `, [FRAUD_RULES.ROUND_TRIP_SALARY.spikeThreshold, FRAUD_RULES.ROUND_TRIP_SALARY.revertTolerance]);

  return result.rows.map(row => ({
    alertType: 'fraud_detection',
    employeeId: row.employee_id,
    severity: FRAUD_RULES.ROUND_TRIP_SALARY.severity,
    title: 'Round-Trip Salary Manipulation',
    description: FRAUD_RULES.ROUND_TRIP_SALARY.message,
    details: {
      employeeName: row.employee_name,
      previousSalary: parseFloat(row.prev_salary),
      spikeSalary: parseFloat(row.spike_salary),
      revertedSalary: parseFloat(row.reverted_salary),
      spikePercent: parseFloat(row.spike_pct),
      spikeDate: row.effective_from,
    },
    confidenceScore: 82,
  }));
};

/**
 * Check for employees paid full salary in a month where approved leave covers all working days
 */
const checkPayrollOnLeave = async () => {
  const result = await db.query(`
    WITH working_days AS (
      SELECT
        EXTRACT(YEAR  FROM d)::int AS year,
        EXTRACT(MONTH FROM d)::int AS month,
        COUNT(*) AS total_working_days
      FROM generate_series(
        date_trunc('month', CURRENT_DATE - INTERVAL '3 months'),
        CURRENT_DATE,
        INTERVAL '1 day'
      ) d
      WHERE EXTRACT(DOW FROM d) NOT IN (0, 6)
        AND d::date NOT IN (SELECT date FROM public_holidays)
      GROUP BY year, month
    ),
    leave_coverage AS (
      SELECT
        lr.employee_id,
        EXTRACT(YEAR  FROM gs.d)::int  AS year,
        EXTRACT(MONTH FROM gs.d)::int  AS month,
        COUNT(DISTINCT gs.d::date)     AS leave_days_in_month
      FROM leave_requests lr
      CROSS JOIN LATERAL generate_series(lr.start_date, lr.end_date, INTERVAL '1 day') AS gs(d)
      WHERE lr.status = 'approved'
        AND EXTRACT(DOW FROM gs.d) NOT IN (0, 6)
        AND gs.d::date NOT IN (SELECT date FROM public_holidays)
      GROUP BY lr.employee_id, year, month
    )
    SELECT
      p.employee_id,
      e.first_name || ' ' || e.last_name AS employee_name,
      p.month,
      p.year,
      p.net_salary,
      wd.total_working_days,
      lc.leave_days_in_month
    FROM payslips p
    JOIN employees e   ON p.employee_id = e.id
    JOIN working_days wd ON wd.year = p.year AND wd.month = p.month
    JOIN leave_coverage lc
      ON lc.employee_id = p.employee_id
      AND lc.year = p.year
      AND lc.month = p.month
    WHERE e.status = 'active'
      AND p.net_salary > 0
      AND lc.leave_days_in_month >= wd.total_working_days
  `);

  return result.rows.map(row => ({
    alertType: 'fraud_detection',
    employeeId: row.employee_id,
    severity: FRAUD_RULES.PAYROLL_ON_LEAVE.severity,
    title: 'Salary Paid on Full-Leave Month',
    description: FRAUD_RULES.PAYROLL_ON_LEAVE.message,
    details: {
      employeeName: row.employee_name,
      month: row.month,
      year: row.year,
      netSalary: parseFloat(row.net_salary),
      totalWorkingDays: parseInt(row.total_working_days),
      leaveDaysInMonth: parseInt(row.leave_days_in_month),
    },
    confidenceScore: 78,
  }));
};

/**
 * Check for employees hired within 14 days who already appear in processed payroll
 */
const checkSuspiciousHire = async () => {
  const result = await db.query(`
    SELECT
      e.id AS employee_id,
      e.first_name || ' ' || e.last_name AS employee_name,
      e.employee_id AS employee_code,
      e.joining_date,
      CURRENT_DATE - e.joining_date AS days_since_hire,
      p.net_salary,
      p.month,
      p.year,
      (SELECT COUNT(*) FROM attendance a WHERE a.employee_id = e.id) AS attendance_record_count
    FROM employees e
    JOIN payslips p ON p.employee_id = e.id
    JOIN payroll_runs pr ON p.payroll_run_id = pr.id
    WHERE e.status = 'active'
      AND e.joining_date >= CURRENT_DATE - INTERVAL '14 days'
      AND pr.status IN ('completed', 'approved', 'paid')
    ORDER BY e.joining_date DESC
  `);

  return result.rows.map(row => {
    const noAttendance = parseInt(row.attendance_record_count) === 0;
    return {
      alertType: 'fraud_detection',
      employeeId: row.employee_id,
      severity: noAttendance ? 'critical' : 'high',
      title: 'Suspicious Hire — Immediate Payroll',
      description: FRAUD_RULES.SUSPICIOUS_HIRE.message,
      details: {
        employeeName: row.employee_name,
        employeeCode: row.employee_code,
        hireDate: row.joining_date,
        daysSinceHire: parseInt(row.days_since_hire),
        netSalary: parseFloat(row.net_salary),
        month: row.month,
        year: row.year,
        attendanceRecords: parseInt(row.attendance_record_count),
      },
      confidenceScore: noAttendance ? 92 : 70,
    };
  });
};

/**
 * Check for sick leave abuse — Z-score > 3.0 vs department average
 */
const checkSickLeaveAbuse = async () => {
  const result = await db.query(`
    WITH dept_sick_stats AS (
      SELECT
        e.department_id,
        d.name AS department_name,
        AVG(sick_count) AS avg_sick_days,
        STDDEV(sick_count) AS stddev_sick_days
      FROM (
        SELECT
          lr.employee_id,
          SUM(lr.end_date - lr.start_date + 1) AS sick_count
        FROM leave_requests lr
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        WHERE lt.name ILIKE '%sick%'
          AND lr.status = 'approved'
          AND lr.start_date >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY lr.employee_id
      ) sub
      JOIN employees e ON e.id = sub.employee_id
      JOIN departments d ON d.id = e.department_id
      WHERE e.status = 'active'
      GROUP BY e.department_id, d.name
      HAVING COUNT(*) >= 3
    ),
    employee_sick AS (
      SELECT
        lr.employee_id,
        SUM(lr.end_date - lr.start_date + 1) AS total_sick_days
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lt.name ILIKE '%sick%'
        AND lr.status = 'approved'
        AND lr.start_date >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY lr.employee_id
    )
    SELECT
      e.id AS employee_id,
      e.first_name || ' ' || e.last_name AS employee_name,
      dss.department_name,
      es.total_sick_days,
      ROUND(dss.avg_sick_days::numeric, 1) AS avg_sick_days,
      ROUND(dss.stddev_sick_days::numeric, 1) AS stddev_sick_days,
      ROUND(((es.total_sick_days - dss.avg_sick_days) / NULLIF(dss.stddev_sick_days, 0))::numeric, 2) AS z_score
    FROM employee_sick es
    JOIN employees e ON e.id = es.employee_id
    JOIN dept_sick_stats dss ON dss.department_id = e.department_id
    WHERE e.status = 'active'
      AND dss.stddev_sick_days > 0
      AND (es.total_sick_days - dss.avg_sick_days) / dss.stddev_sick_days > $1
  `, [FRAUD_RULES.SICK_LEAVE_ABUSE.zScoreThreshold]);

  return result.rows.map(row => ({
    alertType: 'fraud_detection',
    employeeId: row.employee_id,
    severity: FRAUD_RULES.SICK_LEAVE_ABUSE.severity,
    title: 'Sick Leave Abuse Pattern',
    description: FRAUD_RULES.SICK_LEAVE_ABUSE.message,
    details: {
      employeeName: row.employee_name,
      department: row.department_name,
      totalSickDays: parseInt(row.total_sick_days),
      departmentAverage: parseFloat(row.avg_sick_days),
      zScore: parseFloat(row.z_score),
      windowMonths: 6,
    },
    confidenceScore: 72,
  }));
};

/**
 * Check for overtime hours logged on absent or half-day attendance records
 */
const checkOvertimeAbsentContradiction = async () => {
  const result = await db.query(`
    SELECT
      a.employee_id,
      e.first_name || ' ' || e.last_name AS employee_name,
      COUNT(*) AS contradicting_days,
      SUM(a.overtime_hours) AS total_false_overtime_hours,
      array_agg(a.date::text ORDER BY a.date) AS contradicting_dates
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    WHERE e.status = 'active'
      AND a.status IN ('absent', 'half_day')
      AND a.overtime_hours > 0
      AND a.date >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY a.employee_id, e.first_name, e.last_name
    HAVING SUM(a.overtime_hours) > $1
  `, [FRAUD_RULES.OT_ABSENT_CONTRADICTION.minHoursThreshold]);

  return result.rows.map(row => {
    const totalHours = parseFloat(row.total_false_overtime_hours);
    return {
      alertType: 'fraud_detection',
      employeeId: row.employee_id,
      severity: totalHours > FRAUD_RULES.OT_ABSENT_CONTRADICTION.highHoursThreshold ? 'high' : 'medium',
      title: 'Overtime on Absent Days',
      description: FRAUD_RULES.OT_ABSENT_CONTRADICTION.message,
      details: {
        employeeName: row.employee_name,
        contradictingDays: parseInt(row.contradicting_days),
        totalFalseOvertimeHours: totalHours,
        contradictingDates: row.contradicting_dates,
        windowDays: 90,
      },
      confidenceScore: 88,
    };
  });
};

/**
 * Calculate per-employee fraud risk scores from all active alerts
 */
const getEmployeeRiskScores = async () => {
  const result = await db.query(`
    WITH alert_weights AS (
      SELECT
        a.employee_id,
        e.first_name || ' ' || e.last_name AS employee_name,
        e.employee_id AS employee_code,
        d.name AS department_name,
        e.designation,
        a.severity,
        a.confidence_score,
        a.alert_type,
        a.title,
        a.created_at,
        CASE a.severity
          WHEN 'critical' THEN 40
          WHEN 'high'     THEN 25
          WHEN 'medium'   THEN 12
          ELSE 5
        END AS base_weight,
        CASE
          WHEN a.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days' THEN 1.0
          WHEN a.created_at >= CURRENT_TIMESTAMP - INTERVAL '60 days' THEN 0.7
          ELSE 0.4
        END AS recency_factor
      FROM ai_alerts a
      JOIN employees e ON a.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE a.employee_id IS NOT NULL
        AND a.status IN ('new', 'acknowledged', 'investigating')
        AND a.alert_type = 'fraud_detection'
    )
    SELECT
      employee_id,
      employee_name,
      employee_code,
      department_name,
      designation,
      LEAST(100, ROUND(
        SUM(base_weight * (confidence_score::float / 100) * recency_factor)
      )) AS risk_score,
      COUNT(*) AS active_alert_count,
      COUNT(*) FILTER (WHERE severity = 'critical') AS critical_count,
      COUNT(*) FILTER (WHERE severity = 'high')     AS high_count,
      COUNT(*) FILTER (WHERE severity = 'medium')   AS medium_count,
      array_agg(DISTINCT title) AS alert_titles
    FROM alert_weights
    GROUP BY employee_id, employee_name, employee_code, department_name, designation
    ORDER BY risk_score DESC
  `);

  const scores = result.rows.map(row => {
    const score = parseInt(row.risk_score);
    return {
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      employeeCode: row.employee_code,
      departmentName: row.department_name || 'Unknown',
      designation: row.designation || 'Unknown',
      riskScore: score,
      riskTier: score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low',
      activeAlertCount: parseInt(row.active_alert_count),
      criticalCount: parseInt(row.critical_count),
      highCount: parseInt(row.high_count),
      mediumCount: parseInt(row.medium_count),
      alertTitles: row.alert_titles,
    };
  });

  const summary = {
    totalAtRisk: scores.filter(s => s.riskScore >= 25).length,
    criticalCount: scores.filter(s => s.riskTier === 'critical').length,
    highCount: scores.filter(s => s.riskTier === 'high').length,
    mediumCount: scores.filter(s => s.riskTier === 'medium').length,
    avgRiskScore: scores.length > 0
      ? Math.round(scores.reduce((sum, s) => sum + s.riskScore, 0) / scores.length)
      : 0,
  };

  return { scores, summary };
};

/**
 * Save alert to database (with idempotency guard — skips if same employee+title today)
 */
const saveAlert = async (alert) => {
  // Check idempotency: skip if same employee + same title already inserted today
  const exists = await db.query(`
    SELECT 1 FROM ai_alerts
    WHERE employee_id IS NOT DISTINCT FROM $1
      AND title = $2
      AND created_at >= CURRENT_DATE
    LIMIT 1
  `, [alert.employeeId || null, alert.title]);

  if (exists.rows.length > 0) return;

  await db.query(`
    INSERT INTO ai_alerts (
      alert_type, severity, employee_id, title, description, details, confidence_score, model_version
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [
    alert.alertType,
    alert.severity,
    alert.employeeId || null,
    alert.title,
    alert.description,
    JSON.stringify(alert.details),
    alert.confidenceScore,
    'rule-based-v2',
  ]);
};

/**
 * Get fraud detection stats
 */
const getFraudStats = async () => {
  const result = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'new') as new_alerts,
      COUNT(*) FILTER (WHERE status = 'acknowledged') as acknowledged,
      COUNT(*) FILTER (WHERE status = 'investigating') as investigating,
      COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
      COUNT(*) FILTER (WHERE status = 'dismissed') as dismissed,
      COUNT(*) FILTER (WHERE severity = 'critical') as critical,
      COUNT(*) FILTER (WHERE severity = 'high') as high,
      COUNT(*) FILTER (WHERE severity = 'medium') as medium
    FROM ai_alerts
    WHERE alert_type = 'fraud_detection'
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
  `);

  return result.rows[0];
};

module.exports = {
  runFraudDetection,
  checkDuplicateBankAccounts,
  checkSalarySpikes,
  checkGhostEmployees,
  checkOvertimeAnomalies,
  checkDuplicatePayments,
  checkRoundTripSalary,
  checkPayrollOnLeave,
  checkSuspiciousHire,
  checkSickLeaveAbuse,
  checkOvertimeAbsentContradiction,
  getEmployeeRiskScores,
  getFraudStats,
  saveAlert,
};
