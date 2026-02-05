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
};

/**
 * Run all fraud detection checks
 */
const runFraudDetection = async () => {
  const alerts = [];

  // Check for duplicate bank accounts
  const duplicateBankAlerts = await checkDuplicateBankAccounts();
  alerts.push(...duplicateBankAlerts);

  // Check for salary spikes
  const salarySpikeAlerts = await checkSalarySpikes();
  alerts.push(...salarySpikeAlerts);

  // Check for ghost employees
  const ghostEmployeeAlerts = await checkGhostEmployees();
  alerts.push(...ghostEmployeeAlerts);

  // Check for overtime anomalies
  const overtimeAlerts = await checkOvertimeAnomalies();
  alerts.push(...overtimeAlerts);

  // Store alerts in database
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
 * Save alert to database
 */
const saveAlert = async (alert) => {
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
    'rule-based-v1',
  ]);
};

/**
 * Get fraud detection stats
 */
const getFraudStats = async () => {
  const result = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'new') as new_alerts,
      COUNT(*) FILTER (WHERE status = 'investigating') as investigating,
      COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
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
  getFraudStats,
};
