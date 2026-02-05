/**
 * Payroll Service
 * Handles payroll processing and payslip generation
 */

const db = require('../config/database');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const { calculateAllDeductions } = require('../utils/taxCalculator');

/**
 * Get payroll runs with filters
 */
const getPayrollRuns = async ({ page = 1, limit = 10, year, status }) => {
  const offset = (page - 1) * limit;
  const params = [];
  let paramIndex = 1;
  const conditions = [];

  if (year) {
    conditions.push(`year = $${paramIndex}`);
    params.push(year);
    paramIndex++;
  }

  if (status) {
    conditions.push(`status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await db.query(
    `SELECT COUNT(*) FROM payroll_runs ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  const query = `
    SELECT pr.*,
           u1.email as processed_by_email,
           u2.email as approved_by_email
    FROM payroll_runs pr
    LEFT JOIN users u1 ON pr.processed_by = u1.id
    LEFT JOIN users u2 ON pr.approved_by = u2.id
    ${whereClause}
    ORDER BY pr.year DESC, pr.month DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  params.push(limit, offset);
  const result = await db.query(query, params);

  return {
    payrollRuns: result.rows.map(transformPayrollRun),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

/**
 * Get payroll run by ID
 */
const getPayrollRunById = async (id) => {
  const result = await db.query(
    `SELECT pr.*,
            u1.email as processed_by_email,
            u2.email as approved_by_email
     FROM payroll_runs pr
     LEFT JOIN users u1 ON pr.processed_by = u1.id
     LEFT JOIN users u2 ON pr.approved_by = u2.id
     WHERE pr.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Payroll run not found');
  }

  return transformPayrollRun(result.rows[0]);
};

/**
 * Create or get draft payroll run for month/year
 */
const createPayrollRun = async ({ month, year, processedBy }) => {
  // Check if payroll run exists
  const existing = await db.query(
    'SELECT * FROM payroll_runs WHERE month = $1 AND year = $2',
    [month, year]
  );

  if (existing.rows.length > 0) {
    if (existing.rows[0].status !== 'draft') {
      throw new BadRequestError(`Payroll for ${month}/${year} is already ${existing.rows[0].status}`);
    }
    return getPayrollRunById(existing.rows[0].id);
  }

  // Get period dates
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0);

  const result = await db.query(
    `INSERT INTO payroll_runs (month, year, period_start, period_end, processed_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [month, year, periodStart.toISOString().split('T')[0], periodEnd.toISOString().split('T')[0], processedBy]
  );

  return getPayrollRunById(result.rows[0].id);
};

/**
 * Process payroll - generate payslips for all active employees
 */
const processPayroll = async (payrollRunId, processedBy) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // Get payroll run
    const runResult = await client.query(
      'SELECT * FROM payroll_runs WHERE id = $1',
      [payrollRunId]
    );

    if (runResult.rows.length === 0) {
      throw new NotFoundError('Payroll run not found');
    }

    const payrollRun = runResult.rows[0];

    if (payrollRun.status !== 'draft') {
      throw new BadRequestError('Only draft payroll runs can be processed');
    }

    // Update status to processing
    await client.query(
      'UPDATE payroll_runs SET status = $1 WHERE id = $2',
      ['processing', payrollRunId]
    );

    // Get all active employees with salary structures
    const employeesResult = await client.query(`
      SELECT
        e.id as employee_id,
        e.employee_id as emp_code,
        e.tax_filing_status,
        ss.basic_salary,
        ss.housing_allowance,
        ss.transport_allowance,
        ss.medical_allowance,
        ss.utility_allowance,
        ss.other_allowances,
        ss.gross_salary,
        ss.loan_deduction,
        ss.other_deductions
      FROM employees e
      JOIN salary_structures ss ON ss.employee_id = e.id AND ss.is_current = true
      WHERE e.status = 'active'
    `);

    const employees = employeesResult.rows;

    // Get working days in month (excluding weekends and holidays)
    const { month, year } = payrollRun;
    const workingDays = await calculateWorkingDays(client, month, year);

    let totalGross = 0;
    let totalDeductions = 0;
    let totalTax = 0;
    let totalNet = 0;

    // Delete existing payslips for this run (in case of reprocessing)
    await client.query('DELETE FROM payslips WHERE payroll_run_id = $1', [payrollRunId]);

    // Generate payslip for each employee
    for (const emp of employees) {
      const isFiler = emp.tax_filing_status === 'filer';
      const grossSalary = parseFloat(emp.gross_salary);

      // Get attendance summary
      const attendanceSummary = await getEmployeeAttendance(client, emp.employee_id, month, year);

      // Calculate deductions
      const deductions = calculateAllDeductions(grossSalary, isFiler, {
        loanDeduction: parseFloat(emp.loan_deduction) || 0,
        otherDeductions: parseFloat(emp.other_deductions) || 0,
      });

      // Calculate overtime pay (1.5x hourly rate)
      const hourlyRate = grossSalary / (workingDays * 8);
      const overtimePay = Math.round(attendanceSummary.overtimeHours * hourlyRate * 1.5);

      const finalGross = grossSalary + overtimePay;
      const netSalary = finalGross - deductions.totalDeductions;

      // Insert payslip
      await client.query(`
        INSERT INTO payslips (
          payroll_run_id, employee_id, month, year,
          working_days, present_days, absent_days, leave_days, overtime_hours,
          basic_salary, housing_allowance, transport_allowance, medical_allowance,
          utility_allowance, other_allowances, overtime_pay, gross_salary,
          income_tax, eobi_contribution, sessi_contribution, loan_deduction,
          other_deductions, total_deductions, net_salary,
          taxable_income, tax_slab, is_filer
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
          $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
        )`,
        [
          payrollRunId, emp.employee_id, month, year,
          workingDays, attendanceSummary.presentDays, attendanceSummary.absentDays,
          attendanceSummary.leaveDays, attendanceSummary.overtimeHours,
          emp.basic_salary, emp.housing_allowance, emp.transport_allowance,
          emp.medical_allowance, emp.utility_allowance, emp.other_allowances,
          overtimePay, finalGross,
          deductions.incomeTax, deductions.eobi, deductions.sessi,
          deductions.loanDeduction, deductions.otherDeductions,
          deductions.totalDeductions, netSalary,
          grossSalary * 12, deductions.taxSlab, isFiler
        ]
      );

      totalGross += finalGross;
      totalDeductions += deductions.totalDeductions;
      totalTax += deductions.incomeTax;
      totalNet += netSalary;
    }

    // Update payroll run with totals
    await client.query(`
      UPDATE payroll_runs SET
        status = 'completed',
        total_employees = $1,
        total_gross_salary = $2,
        total_deductions = $3,
        total_tax = $4,
        total_net_salary = $5,
        processed_at = CURRENT_TIMESTAMP,
        processed_by = $6
      WHERE id = $7`,
      [employees.length, totalGross, totalDeductions, totalTax, totalNet, processedBy, payrollRunId]
    );

    await client.query('COMMIT');

    return getPayrollRunById(payrollRunId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Approve payroll run
 */
const approvePayroll = async (payrollRunId, approvedBy) => {
  const result = await db.query(
    'SELECT status FROM payroll_runs WHERE id = $1',
    [payrollRunId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Payroll run not found');
  }

  if (result.rows[0].status !== 'completed') {
    throw new BadRequestError('Only completed payroll runs can be approved');
  }

  await db.query(
    `UPDATE payroll_runs SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [approvedBy, payrollRunId]
  );

  // Also approve all payslips
  await db.query(
    'UPDATE payslips SET status = $1 WHERE payroll_run_id = $2',
    ['approved', payrollRunId]
  );

  return getPayrollRunById(payrollRunId);
};

/**
 * Get payslips for a payroll run
 */
const getPayslips = async ({ payrollRunId, employeeId, page = 1, limit = 10 }) => {
  const offset = (page - 1) * limit;
  const params = [];
  let paramIndex = 1;
  const conditions = [];

  if (payrollRunId) {
    conditions.push(`p.payroll_run_id = $${paramIndex}`);
    params.push(payrollRunId);
    paramIndex++;
  }

  if (employeeId) {
    conditions.push(`p.employee_id = $${paramIndex}`);
    params.push(employeeId);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await db.query(
    `SELECT COUNT(*) FROM payslips p ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  const query = `
    SELECT p.*,
           e.first_name, e.last_name, e.employee_id as emp_code,
           d.name as department_name
    FROM payslips p
    JOIN employees e ON p.employee_id = e.id
    LEFT JOIN departments d ON e.department_id = d.id
    ${whereClause}
    ORDER BY p.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  params.push(limit, offset);
  const result = await db.query(query, params);

  return {
    payslips: result.rows.map(transformPayslip),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

/**
 * Get payslip by ID
 */
const getPayslipById = async (id) => {
  const result = await db.query(`
    SELECT p.*,
           e.first_name, e.last_name, e.employee_id as emp_code,
           e.designation, e.bank_name, e.bank_account_number,
           d.name as department_name
    FROM payslips p
    JOIN employees e ON p.employee_id = e.id
    LEFT JOIN departments d ON e.department_id = d.id
    WHERE p.id = $1
  `, [id]);

  if (result.rows.length === 0) {
    throw new NotFoundError('Payslip not found');
  }

  return transformPayslip(result.rows[0]);
};

// Helper functions

const calculateWorkingDays = async (client, month, year) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  // Get holidays
  const holidaysResult = await client.query(
    'SELECT date FROM public_holidays WHERE date >= $1 AND date <= $2',
    [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
  );
  const holidays = new Set(holidaysResult.rows.map(r => r.date.toISOString().split('T')[0]));

  let workingDays = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    const day = current.getDay();
    const dateStr = current.toISOString().split('T')[0];

    if (day !== 0 && day !== 6 && !holidays.has(dateStr)) {
      workingDays++;
    }
    current.setDate(current.getDate() + 1);
  }

  return workingDays;
};

const getEmployeeAttendance = async (client, employeeId, month, year) => {
  const result = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('present', 'late')) as present_days,
      COUNT(*) FILTER (WHERE status = 'absent') as absent_days,
      COUNT(*) FILTER (WHERE status = 'on_leave') as leave_days,
      SUM(COALESCE(overtime_hours, 0)) as overtime_hours
    FROM attendance
    WHERE employee_id = $1
      AND EXTRACT(MONTH FROM date) = $2
      AND EXTRACT(YEAR FROM date) = $3
  `, [employeeId, month, year]);

  const row = result.rows[0];
  return {
    presentDays: parseInt(row.present_days) || 0,
    absentDays: parseInt(row.absent_days) || 0,
    leaveDays: parseInt(row.leave_days) || 0,
    overtimeHours: parseFloat(row.overtime_hours) || 0,
  };
};

const transformPayrollRun = (row) => ({
  id: row.id,
  month: row.month,
  year: row.year,
  periodStart: row.period_start,
  periodEnd: row.period_end,
  status: row.status,
  totalEmployees: row.total_employees,
  totalGrossSalary: parseFloat(row.total_gross_salary) || 0,
  totalDeductions: parseFloat(row.total_deductions) || 0,
  totalTax: parseFloat(row.total_tax) || 0,
  totalNetSalary: parseFloat(row.total_net_salary) || 0,
  processedBy: row.processed_by_email,
  processedAt: row.processed_at,
  approvedBy: row.approved_by_email,
  approvedAt: row.approved_at,
  notes: row.notes,
  createdAt: row.created_at,
});

const transformPayslip = (row) => ({
  id: row.id,
  payrollRunId: row.payroll_run_id,
  employeeId: row.employee_id,
  employeeCode: row.emp_code,
  employeeName: row.first_name ? `${row.first_name} ${row.last_name}` : null,
  department: row.department_name,
  designation: row.designation,
  month: row.month,
  year: row.year,
  workingDays: row.working_days,
  presentDays: row.present_days,
  absentDays: row.absent_days,
  leaveDays: parseFloat(row.leave_days) || 0,
  overtimeHours: parseFloat(row.overtime_hours) || 0,
  earnings: {
    basicSalary: parseFloat(row.basic_salary),
    housingAllowance: parseFloat(row.housing_allowance),
    transportAllowance: parseFloat(row.transport_allowance),
    medicalAllowance: parseFloat(row.medical_allowance),
    utilityAllowance: parseFloat(row.utility_allowance),
    otherAllowances: parseFloat(row.other_allowances),
    overtimePay: parseFloat(row.overtime_pay) || 0,
    bonus: parseFloat(row.bonus) || 0,
  },
  grossSalary: parseFloat(row.gross_salary),
  deductions: {
    incomeTax: parseFloat(row.income_tax),
    eobiContribution: parseFloat(row.eobi_contribution),
    sessiContribution: parseFloat(row.sessi_contribution),
    loanDeduction: parseFloat(row.loan_deduction),
    otherDeductions: parseFloat(row.other_deductions),
  },
  totalDeductions: parseFloat(row.total_deductions),
  netSalary: parseFloat(row.net_salary),
  taxableIncome: parseFloat(row.taxable_income),
  taxSlab: row.tax_slab,
  isFiler: row.is_filer,
  status: row.status,
  bankName: row.bank_name,
  bankAccountNumber: row.bank_account_number,
  paidAt: row.paid_at,
  createdAt: row.created_at,
});

module.exports = {
  getPayrollRuns,
  getPayrollRunById,
  createPayrollRun,
  processPayroll,
  approvePayroll,
  getPayslips,
  getPayslipById,
};
