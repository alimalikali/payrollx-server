/**
 * Salary Anomaly Detection Service
 * Detects unusual patterns in salary data using statistical analysis
 */

const db = require('../../config/database');

/**
 * Detect salary anomalies using Z-score method
 * Z-score > 2 or < -2 is considered anomalous
 */
const detectSalaryAnomalies = async () => {
  const alerts = [];

  // Detect within-department anomalies
  const deptAnomalies = await detectDepartmentAnomalies();
  alerts.push(...deptAnomalies);

  // Detect within-designation anomalies
  const designationAnomalies = await detectDesignationAnomalies();
  alerts.push(...designationAnomalies);

  // Detect deduction anomalies
  const deductionAnomalies = await detectDeductionAnomalies();
  alerts.push(...deductionAnomalies);

  // Save alerts
  for (const alert of alerts) {
    await saveAlert(alert);
  }

  return {
    totalAnomalies: alerts.length,
    byType: {
      department: deptAnomalies.length,
      designation: designationAnomalies.length,
      deduction: deductionAnomalies.length,
    },
    alerts,
  };
};

/**
 * Detect employees with salaries significantly different from department average
 */
const detectDepartmentAnomalies = async () => {
  const result = await db.query(`
    WITH dept_stats AS (
      SELECT
        e.department_id,
        d.name as department_name,
        AVG(ss.gross_salary) as avg_salary,
        STDDEV(ss.gross_salary) as stddev_salary
      FROM employees e
      JOIN salary_structures ss ON e.id = ss.employee_id AND ss.is_current = true
      JOIN departments d ON e.department_id = d.id
      WHERE e.status = 'active'
      GROUP BY e.department_id, d.name
      HAVING COUNT(*) >= 3
    )
    SELECT
      e.id as employee_id,
      e.first_name || ' ' || e.last_name as employee_name,
      ds.department_name,
      ss.gross_salary,
      ds.avg_salary,
      ds.stddev_salary,
      (ss.gross_salary - ds.avg_salary) / NULLIF(ds.stddev_salary, 0) as z_score
    FROM employees e
    JOIN salary_structures ss ON e.id = ss.employee_id AND ss.is_current = true
    JOIN dept_stats ds ON e.department_id = ds.department_id
    WHERE e.status = 'active'
      AND ds.stddev_salary > 0
      AND ABS((ss.gross_salary - ds.avg_salary) / ds.stddev_salary) > 2
  `);

  return result.rows.map(row => ({
    alertType: 'salary_anomaly',
    employeeId: row.employee_id,
    severity: Math.abs(row.z_score) > 3 ? 'high' : 'medium',
    title: 'Department Salary Anomaly',
    description: `Salary significantly ${row.z_score > 0 ? 'above' : 'below'} department average`,
    details: {
      employeeName: row.employee_name,
      department: row.department_name,
      salary: parseFloat(row.gross_salary),
      departmentAverage: Math.round(parseFloat(row.avg_salary)),
      zScore: parseFloat(row.z_score).toFixed(2),
      deviation: `${Math.abs(Math.round((row.gross_salary - row.avg_salary) / row.avg_salary * 100))}%`,
    },
    confidenceScore: Math.min(95, 60 + Math.abs(row.z_score) * 10),
  }));
};

/**
 * Detect employees with salaries different from same designation
 */
const detectDesignationAnomalies = async () => {
  const result = await db.query(`
    WITH designation_stats AS (
      SELECT
        e.designation,
        AVG(ss.gross_salary) as avg_salary,
        STDDEV(ss.gross_salary) as stddev_salary,
        MIN(ss.gross_salary) as min_salary,
        MAX(ss.gross_salary) as max_salary
      FROM employees e
      JOIN salary_structures ss ON e.id = ss.employee_id AND ss.is_current = true
      WHERE e.status = 'active'
        AND e.designation IS NOT NULL
      GROUP BY e.designation
      HAVING COUNT(*) >= 3
    )
    SELECT
      e.id as employee_id,
      e.first_name || ' ' || e.last_name as employee_name,
      e.designation,
      ss.gross_salary,
      ds.avg_salary,
      ds.min_salary,
      ds.max_salary,
      (ss.gross_salary - ds.avg_salary) / NULLIF(ds.stddev_salary, 0) as z_score
    FROM employees e
    JOIN salary_structures ss ON e.id = ss.employee_id AND ss.is_current = true
    JOIN designation_stats ds ON e.designation = ds.designation
    WHERE e.status = 'active'
      AND ds.stddev_salary > 0
      AND ABS((ss.gross_salary - ds.avg_salary) / ds.stddev_salary) > 2
  `);

  return result.rows.map(row => ({
    alertType: 'salary_anomaly',
    employeeId: row.employee_id,
    severity: 'medium',
    title: 'Designation Salary Anomaly',
    description: `Salary outside normal range for ${row.designation}`,
    details: {
      employeeName: row.employee_name,
      designation: row.designation,
      salary: parseFloat(row.gross_salary),
      designationRange: {
        min: parseFloat(row.min_salary),
        avg: Math.round(parseFloat(row.avg_salary)),
        max: parseFloat(row.max_salary),
      },
      zScore: parseFloat(row.z_score).toFixed(2),
    },
    confidenceScore: 70,
  }));
};

/**
 * Detect unusual deduction patterns
 */
const detectDeductionAnomalies = async () => {
  const result = await db.query(`
    SELECT
      p.employee_id,
      e.first_name || ' ' || e.last_name as employee_name,
      p.gross_salary,
      p.total_deductions,
      (p.total_deductions::float / p.gross_salary * 100) as deduction_rate,
      p.month,
      p.year
    FROM payslips p
    JOIN employees e ON p.employee_id = e.id
    WHERE (p.total_deductions::float / p.gross_salary * 100) > 50
       OR p.total_deductions < 0
    ORDER BY p.created_at DESC
    LIMIT 50
  `);

  return result.rows.map(row => ({
    alertType: 'salary_anomaly',
    employeeId: row.employee_id,
    severity: row.total_deductions < 0 ? 'critical' : 'high',
    title: 'Unusual Deduction Pattern',
    description: row.total_deductions < 0
      ? 'Negative deductions detected'
      : 'Deductions exceed 50% of gross salary',
    details: {
      employeeName: row.employee_name,
      grossSalary: parseFloat(row.gross_salary),
      totalDeductions: parseFloat(row.total_deductions),
      deductionRate: `${parseFloat(row.deduction_rate).toFixed(1)}%`,
      period: `${row.month}/${row.year}`,
    },
    confidenceScore: 85,
  }));
};

/**
 * Get salary distribution stats
 */
const getSalaryDistribution = async () => {
  const result = await db.query(`
    SELECT
      d.name as department,
      COUNT(e.id) as employee_count,
      MIN(ss.gross_salary) as min_salary,
      AVG(ss.gross_salary) as avg_salary,
      MAX(ss.gross_salary) as max_salary,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ss.gross_salary) as median_salary
    FROM employees e
    JOIN salary_structures ss ON e.id = ss.employee_id AND ss.is_current = true
    JOIN departments d ON e.department_id = d.id
    WHERE e.status = 'active'
    GROUP BY d.name
    ORDER BY avg_salary DESC
  `);

  return result.rows.map(row => ({
    department: row.department,
    employeeCount: parseInt(row.employee_count),
    minSalary: parseFloat(row.min_salary),
    avgSalary: Math.round(parseFloat(row.avg_salary)),
    maxSalary: parseFloat(row.max_salary),
    medianSalary: Math.round(parseFloat(row.median_salary)),
  }));
};

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
    'statistical-v1',
  ]);
};

module.exports = {
  detectSalaryAnomalies,
  detectDepartmentAnomalies,
  detectDesignationAnomalies,
  detectDeductionAnomalies,
  getSalaryDistribution,
};
