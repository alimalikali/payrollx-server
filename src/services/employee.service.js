/**
 * Employee Service
 * Handles employee CRUD operations and business logic
 */

const db = require('../config/database');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const { transformEmployee, transformEmployeeList } = require('../utils/transformers');

/**
 * Get all employees with pagination and filters
 */
const getEmployees = async ({ page = 1, limit = 10, search, department, status, sortBy = 'created_at', sortOrder = 'desc' }) => {
  const offset = (page - 1) * limit;
  const params = [];
  let paramIndex = 1;

  // Build WHERE clause
  const conditions = [];

  if (search) {
    conditions.push(`(
      e.first_name ILIKE $${paramIndex} OR
      e.last_name ILIKE $${paramIndex} OR
      e.email ILIKE $${paramIndex} OR
      e.employee_id ILIKE $${paramIndex}
    )`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (department) {
    conditions.push(`e.department_id = $${paramIndex}`);
    params.push(department);
    paramIndex++;
  }

  if (status) {
    conditions.push(`e.status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Validate sort column
  const validSortColumns = ['created_at', 'first_name', 'last_name', 'employee_id', 'joining_date'];
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
  const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  // Get total count
  const countQuery = `SELECT COUNT(*) FROM employees e ${whereClause}`;
  const countResult = await db.query(countQuery, params);
  const total = parseInt(countResult.rows[0].count);

  // Get employees
  const query = `
    SELECT
      e.*,
      d.name as department_name,
      d.code as department_code,
      ss.basic_salary,
      ss.gross_salary
    FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN salary_structures ss ON ss.employee_id = e.id AND ss.is_current = true
    ${whereClause}
    ORDER BY e.${sortColumn} ${order}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  params.push(limit, offset);
  const result = await db.query(query, params);

  return {
    employees: transformEmployeeList(result.rows),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get employee by ID
 */
const getEmployeeById = async (id) => {
  const query = `
    SELECT
      e.*,
      d.name as department_name,
      d.code as department_code,
      ss.id as salary_id,
      ss.basic_salary,
      ss.housing_allowance,
      ss.transport_allowance,
      ss.medical_allowance,
      ss.utility_allowance,
      ss.other_allowances,
      ss.gross_salary,
      ss.eobi_contribution,
      ss.sessi_contribution,
      ss.effective_from as salary_effective_from,
      mgr.id as manager_id,
      mgr.first_name as manager_first_name,
      mgr.last_name as manager_last_name
    FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN salary_structures ss ON ss.employee_id = e.id AND ss.is_current = true
    LEFT JOIN employees mgr ON e.reporting_to = mgr.id
    WHERE e.id = $1
  `;

  const result = await db.query(query, [id]);

  if (result.rows.length === 0) {
    throw new NotFoundError('Employee not found');
  }

  return transformEmployee(result.rows[0]);
};

/**
 * Create new employee
 */
const createEmployee = async (data) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // Generate employee ID
    const countResult = await client.query('SELECT COUNT(*) FROM employees');
    const count = parseInt(countResult.rows[0].count) + 1;
    const employeeId = `EMP${String(count).padStart(4, '0')}`;

    // Insert employee
    const employeeQuery = `
      INSERT INTO employees (
        employee_id, first_name, last_name, email, phone, cnic,
        date_of_birth, gender, marital_status, address, city,
        department_id, designation, employment_type, joining_date,
        reporting_to, bank_name, bank_account_number, bank_branch,
        ntn_number, tax_filing_status, status, profile_image
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
      ) RETURNING *
    `;

    const employeeParams = [
      employeeId,
      data.firstName,
      data.lastName,
      data.email,
      data.phone || null,
      data.cnic || null,
      data.dateOfBirth || null,
      data.gender || null,
      data.maritalStatus || null,
      data.address || null,
      data.city || null,
      data.departmentId || null,
      data.designation || null,
      data.employmentType || 'full_time',
      data.joiningDate,
      data.reportingTo || null,
      data.bankName || null,
      data.bankAccountNumber || null,
      data.bankBranch || null,
      data.ntnNumber || null,
      data.taxFilingStatus || 'non_filer',
      data.status || 'active',
      data.profileImage || null,
    ];

    const employeeResult = await client.query(employeeQuery, employeeParams);
    const employee = employeeResult.rows[0];

    // Create salary structure if salary data provided
    if (data.basicSalary) {
      const salaryQuery = `
        INSERT INTO salary_structures (
          employee_id, basic_salary, housing_allowance, transport_allowance,
          medical_allowance, utility_allowance, other_allowances,
          eobi_contribution, sessi_contribution, effective_from
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `;

      const grossSalary = (data.basicSalary || 0) +
        (data.housingAllowance || 0) +
        (data.transportAllowance || 0) +
        (data.medicalAllowance || 0) +
        (data.utilityAllowance || 0) +
        (data.otherAllowances || 0);

      // EOBI and SESSI are 0.75% of gross (employer contribution)
      const eobiContribution = grossSalary * 0.0075;
      const sessiContribution = grossSalary * 0.0075;

      await client.query(salaryQuery, [
        employee.id,
        data.basicSalary,
        data.housingAllowance || 0,
        data.transportAllowance || 0,
        data.medicalAllowance || 0,
        data.utilityAllowance || 0,
        data.otherAllowances || 0,
        eobiContribution,
        sessiContribution,
        data.joiningDate,
      ]);
    }

    await client.query('COMMIT');

    // Fetch complete employee data
    return getEmployeeById(employee.id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Update employee
 */
const updateEmployee = async (id, data) => {
  // Check if employee exists
  const existing = await db.query('SELECT id FROM employees WHERE id = $1', [id]);
  if (existing.rows.length === 0) {
    throw new NotFoundError('Employee not found');
  }

  // Build update query dynamically
  const updates = [];
  const params = [];
  let paramIndex = 1;

  const fieldMap = {
    firstName: 'first_name',
    lastName: 'last_name',
    email: 'email',
    phone: 'phone',
    cnic: 'cnic',
    dateOfBirth: 'date_of_birth',
    gender: 'gender',
    maritalStatus: 'marital_status',
    address: 'address',
    city: 'city',
    departmentId: 'department_id',
    designation: 'designation',
    employmentType: 'employment_type',
    joiningDate: 'joining_date',
    endDate: 'end_date',
    reportingTo: 'reporting_to',
    bankName: 'bank_name',
    bankAccountNumber: 'bank_account_number',
    bankBranch: 'bank_branch',
    ntnNumber: 'ntn_number',
    taxFilingStatus: 'tax_filing_status',
    status: 'status',
    profileImage: 'profile_image',
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      updates.push(`${column} = $${paramIndex}`);
      params.push(data[key]);
      paramIndex++;
    }
  }

  if (updates.length === 0) {
    throw new BadRequestError('No valid fields to update');
  }

  params.push(id);
  const query = `
    UPDATE employees
    SET ${updates.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  await db.query(query, params);

  return getEmployeeById(id);
};

/**
 * Delete employee (soft delete by setting status to terminated)
 */
const deleteEmployee = async (id) => {
  const result = await db.query(
    `UPDATE employees SET status = 'terminated', end_date = CURRENT_DATE
     WHERE id = $1 RETURNING id`,
    [id]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Employee not found');
  }

  return { message: 'Employee terminated successfully' };
};

/**
 * Get employee statistics
 */
const getEmployeeStats = async () => {
  const query = `
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'active') as active,
      COUNT(*) FILTER (WHERE status = 'inactive') as inactive,
      COUNT(*) FILTER (WHERE status = 'on_leave') as on_leave,
      COUNT(*) FILTER (WHERE joining_date >= CURRENT_DATE - INTERVAL '30 days') as new_hires
    FROM employees
  `;

  const result = await db.query(query);
  const stats = result.rows[0];

  return {
    total: parseInt(stats.total),
    active: parseInt(stats.active),
    inactive: parseInt(stats.inactive),
    onLeave: parseInt(stats.on_leave),
    newHires: parseInt(stats.new_hires),
  };
};

/**
 * Get employees by department
 */
const getEmployeesByDepartment = async () => {
  const query = `
    SELECT
      d.id,
      d.name,
      d.code,
      COUNT(e.id) as employee_count
    FROM departments d
    LEFT JOIN employees e ON e.department_id = d.id AND e.status = 'active'
    WHERE d.is_active = true
    GROUP BY d.id, d.name, d.code
    ORDER BY employee_count DESC
  `;

  const result = await db.query(query);

  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    code: row.code,
    employeeCount: parseInt(row.employee_count),
  }));
};

module.exports = {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getEmployeeStats,
  getEmployeesByDepartment,
};
