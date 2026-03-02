/**
 * Employee Service
 * Handles employee CRUD operations and business logic
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const { transformEmployee, transformEmployeeList } = require('../utils/transformers');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALT_ROUNDS = 12;
const DEFAULT_ATTENDANCE_SUMMARY_LIMIT = 30;
const KNOWN_LEAVE_CODES = {
  sick: ['sl', 'sick_leave', 'sick'],
  casual: ['cl', 'casual_leave', 'casual'],
  paid: ['al', 'annual_leave', 'paid_leave', 'annual', 'paid'],
};

const generateTemporaryPassword = (length = 12) => {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const specials = '@#$%*!?';
  const allChars = uppercase + lowercase + numbers + specials;

  const required = [
    uppercase[crypto.randomInt(0, uppercase.length)],
    lowercase[crypto.randomInt(0, lowercase.length)],
    numbers[crypto.randomInt(0, numbers.length)],
    specials[crypto.randomInt(0, specials.length)],
  ];

  const passwordChars = [...required];
  while (passwordChars.length < length) {
    passwordChars.push(allChars[crypto.randomInt(0, allChars.length)]);
  }

  for (let i = passwordChars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
  }

  return passwordChars.join('');
};

const parseNumberValue = (value, fallback = 0) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const splitFullName = (fullName = '') => {
  const trimmed = String(fullName).trim();
  if (!trimmed) {
    return { firstName: '', lastName: '' };
  }

  const [first = '', ...rest] = trimmed.split(/\s+/);
  return {
    firstName: first,
    lastName: rest.join(' '),
  };
};

const mapLeaveCategory = (code = '', name = '') => {
  const normalizedCode = String(code || '').trim().toLowerCase();
  const normalizedName = String(name || '').trim().toLowerCase().replace(/\s+/g, '_');
  const tokens = [normalizedCode, normalizedName];

  if (tokens.some((token) => KNOWN_LEAVE_CODES.sick.includes(token))) {
    return 'sick';
  }
  if (tokens.some((token) => KNOWN_LEAVE_CODES.casual.includes(token))) {
    return 'casual';
  }
  if (tokens.some((token) => KNOWN_LEAVE_CODES.paid.includes(token))) {
    return 'paid';
  }
  return null;
};

const normalizeEmployeePayload = (data = {}) => {
  const basicInfo = data.basicInfo || {};
  const jobDetails = data.jobDetails || {};
  const salaryDetails = data.salaryDetails || {};
  const legalInfo = data.legalInfo || {};
  const salaryAllowances = salaryDetails.allowances || {};

  const mergedFullName = basicInfo.fullName || data.fullName || [data.firstName, data.lastName].filter(Boolean).join(' ').trim();
  const { firstName: parsedFirstName, lastName: parsedLastName } = splitFullName(mergedFullName);

  const firstName = (basicInfo.firstName || data.firstName || parsedFirstName || '').trim();
  const lastName = (basicInfo.lastName || data.lastName || parsedLastName || '').trim();
  const fullName = mergedFullName || `${firstName} ${lastName}`.trim();

  return {
    firstName,
    lastName,
    fullName,
    email: (basicInfo.email || data.email || '').trim(),
    phone: (basicInfo.phone || data.phone || '').trim(),
    dateOfBirth: basicInfo.dateOfBirth || data.dateOfBirth || null,
    gender: basicInfo.gender || data.gender || null,
    maritalStatus: basicInfo.maritalStatus || data.maritalStatus || null,
    nationality: (basicInfo.nationality || data.nationality || '').trim(),
    profileImage: basicInfo.profileImage || data.profileImage || null,
    residentialAddress: (basicInfo.residentialAddress || data.residentialAddress || data.address || '').trim(),
    city: data.city || null,

    departmentId: jobDetails.departmentId || data.departmentId || null,
    jobTitle: (jobDetails.jobTitle || data.jobTitle || data.designation || '').trim(),
    employmentType: jobDetails.employmentType || data.employmentType || 'full_time',
    joiningDate: jobDetails.joiningDate || data.joiningDate || null,
    probationPeriodMonths: jobDetails.probationPeriodMonths ?? data.probationPeriodMonths ?? null,
    workLocation: (jobDetails.workLocation || data.workLocation || '').trim(),
    reportingTo: jobDetails.reportingManagerId || data.reportingTo || null,

    basicSalary: parseNumberValue(salaryDetails.basicSalary ?? data.basicSalary, 0),
    housingAllowance: parseNumberValue(salaryAllowances.hra ?? salaryDetails.hra ?? data.housingAllowance, 0),
    transportAllowance: parseNumberValue(salaryAllowances.travel ?? salaryDetails.travel ?? data.transportAllowance, 0),
    medicalAllowance: parseNumberValue(salaryAllowances.medical ?? salaryDetails.medical ?? data.medicalAllowance, 0),
    utilityAllowance: parseNumberValue(salaryAllowances.utility ?? salaryDetails.utility ?? data.utilityAllowance, 0),
    otherAllowances: parseNumberValue(salaryAllowances.other ?? salaryDetails.other ?? data.otherAllowances, 0),
    bonus: parseNumberValue(salaryDetails.bonus ?? data.bonus, 0),
    overtimeRate: parseNumberValue(salaryDetails.overtimeRate ?? data.overtimeRate, 0),
    taxInformation: salaryDetails.taxInformation || data.taxInformation || null,
    providentFundEmployee: parseNumberValue(salaryDetails.providentFundEmployee ?? data.providentFundEmployee, 0),
    providentFundEmployer: parseNumberValue(salaryDetails.providentFundEmployer ?? data.providentFundEmployer, 0),
    bankAccountNumber: salaryDetails.bankAccountNumber || data.bankAccountNumber || null,
    bankName: salaryDetails.bankName || data.bankName || null,
    bankRoutingCode: salaryDetails.bankRoutingCode || data.bankRoutingCode || null,
    paymentMethod: salaryDetails.paymentMethod || data.paymentMethod || 'bank_transfer',

    legalIdType: legalInfo.legalIdType || data.legalIdType || null,
    legalIdNumber: legalInfo.legalIdNumber || data.legalIdNumber || null,
    taxIdentifier: legalInfo.taxIdentifier || data.taxIdentifier || data.ntnNumber || null,
    taxFilingStatus: data.taxFilingStatus || 'non_filer',
    status: data.status || 'active',
  };
};

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
      u.id as user_id,
      u.role as user_role,
      ss.basic_salary,
      ss.gross_salary,
      ss.bonus,
      ss.overtime_rate,
      ss.provident_fund_employee,
      ss.provident_fund_employer,
      ss.payment_method
    FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN users u ON e.user_id = u.id
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
const employeeDetailsQuery = `
    SELECT
      e.*,
      d.name as department_name,
      d.code as department_code,
      u.id as user_id,
      u.role as user_role,
      ss.id as salary_id,
      ss.basic_salary,
      ss.housing_allowance,
      ss.transport_allowance,
      ss.medical_allowance,
      ss.utility_allowance,
      ss.other_allowances,
      ss.gross_salary,
      ss.bonus,
      ss.overtime_rate,
      ss.provident_fund_employee,
      ss.provident_fund_employer,
      ss.payment_method,
      ss.eobi_contribution,
      ss.sessi_contribution,
      ss.effective_from as salary_effective_from,
      mgr.id as manager_id,
      mgr.first_name as manager_first_name,
      mgr.last_name as manager_last_name
    FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN users u ON e.user_id = u.id
    LEFT JOIN salary_structures ss ON ss.employee_id = e.id AND ss.is_current = true
    LEFT JOIN employees mgr ON e.reporting_to = mgr.id
  `;

const getEmployeeById = async (id) => {
  const query = `${employeeDetailsQuery} WHERE e.id = $1`;
  const result = await db.query(query, [id]);

  if (result.rows.length === 0) {
    throw new NotFoundError('Employee not found');
  }

  return transformEmployee(result.rows[0]);
};

/**
 * Get employee by employee_id (code)
 */
const getEmployeeByEmployeeId = async (employeeId) => {
  const query = `${employeeDetailsQuery} WHERE e.employee_id = $1`;
  const result = await db.query(query, [employeeId]);

  if (result.rows.length === 0) {
    throw new NotFoundError('Employee not found');
  }

  return transformEmployee(result.rows[0]);
};

/**
 * Get employee by identifier (UUID or employee_id)
 */
const getEmployeeByIdentifier = async (identifier) => {
  if (!identifier) {
    throw new BadRequestError('Employee identifier is required');
  }

  return UUID_REGEX.test(identifier)
    ? getEmployeeById(identifier)
    : getEmployeeByEmployeeId(identifier);
};

/**
 * Create new employee
 */
const createEmployee = async (data) => {
  const normalizedData = normalizeEmployeePayload(data);
  const today = new Date();
  const dob = new Date(normalizedData.dateOfBirth);
  const joiningDate = new Date(normalizedData.joiningDate);

  if (Number.isNaN(dob.getTime()) || dob >= today) {
    throw new BadRequestError('Date of birth must be a valid past date');
  }

  if (Number.isNaN(joiningDate.getTime())) {
    throw new BadRequestError('Joining date must be valid');
  }

  const minimumJoinDate = new Date(dob);
  minimumJoinDate.setFullYear(minimumJoinDate.getFullYear() + 18);
  if (joiningDate < minimumJoinDate) {
    throw new BadRequestError('Joining date must be at least 18 years after date of birth');
  }

  if (normalizedData.reportingTo && !UUID_REGEX.test(normalizedData.reportingTo)) {
    throw new BadRequestError('Reporting manager must be a valid employee ID');
  }

  if (normalizedData.paymentMethod && !['bank_transfer', 'check'].includes(normalizedData.paymentMethod)) {
    throw new BadRequestError('Payment method must be bank_transfer or check');
  }

  if (normalizedData.legalIdType === 'cnic' && !/^\d{5}-\d{7}-\d$/.test(normalizedData.legalIdNumber || '')) {
    throw new BadRequestError('Invalid CNIC format (XXXXX-XXXXXXX-X)');
  }

  if (
    normalizedData.reportingTo &&
    data.employeeId &&
    normalizedData.reportingTo === data.employeeId
  ) {
    throw new BadRequestError('Reporting manager cannot be the same employee');
  }

  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // Generate employee ID
    const countResult = await client.query('SELECT COUNT(*) FROM employees');
    const count = parseInt(countResult.rows[0].count) + 1;
    const employeeId = `EMP${String(count).padStart(4, '0')}`;
    const normalizedEmail = normalizedData.email.trim().toLowerCase();

    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [normalizedEmail]
    );
    if (existingUser.rows.length > 0) {
      throw new BadRequestError('A login account with this email already exists');
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, SALT_ROUNDS);

    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, role, must_change_password)
       VALUES ($1, $2, 'employee', true)
       RETURNING id, email`,
      [normalizedEmail, passwordHash]
    );
    const user = userResult.rows[0];

    // Insert employee
    const employeeQuery = `
      INSERT INTO employees (
        user_id, employee_id, first_name, last_name, full_name_display, email, phone, cnic,
        date_of_birth, gender, marital_status, address, residential_address, city, nationality,
        department_id, designation, job_title, employment_type, joining_date, probation_period_months, work_location,
        reporting_to, bank_name, bank_account_number, bank_routing_code, bank_branch,
        ntn_number, tax_identifier, tax_information, tax_filing_status,
        legal_id_type, legal_id_number, status, profile_image
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27,
        $28, $29, $30, $31, $32, $33, $34, $35
      ) RETURNING *
    `;

    const cnicValue = normalizedData.legalIdType === 'cnic'
      ? normalizedData.legalIdNumber
      : (data.cnic || null);

    const employeeParams = [
      user.id,
      employeeId,
      normalizedData.firstName,
      normalizedData.lastName,
      normalizedData.fullName,
      normalizedEmail,
      normalizedData.phone || null,
      cnicValue,
      normalizedData.dateOfBirth || null,
      normalizedData.gender || null,
      normalizedData.maritalStatus || null,
      normalizedData.residentialAddress || null,
      normalizedData.residentialAddress || null,
      normalizedData.city || null,
      normalizedData.nationality || null,
      normalizedData.departmentId || null,
      normalizedData.jobTitle || null,
      normalizedData.jobTitle || null,
      normalizedData.employmentType || 'full_time',
      normalizedData.joiningDate,
      normalizedData.probationPeriodMonths,
      normalizedData.workLocation || null,
      normalizedData.reportingTo || null,
      normalizedData.bankName || null,
      normalizedData.bankAccountNumber || null,
      normalizedData.bankRoutingCode || null,
      data.bankBranch || null,
      normalizedData.taxIdentifier || null,
      normalizedData.taxIdentifier || null,
      normalizedData.taxInformation || null,
      normalizedData.taxFilingStatus || 'non_filer',
      normalizedData.legalIdType || null,
      normalizedData.legalIdNumber || null,
      normalizedData.status || 'active',
      normalizedData.profileImage || null,
    ];

    const employeeResult = await client.query(employeeQuery, employeeParams);
    const employee = employeeResult.rows[0];

    // Create salary structure
    const salaryQuery = `
      INSERT INTO salary_structures (
        employee_id, basic_salary, housing_allowance, transport_allowance,
        medical_allowance, utility_allowance, other_allowances,
        bonus, overtime_rate, provident_fund_employee, provident_fund_employer,
        payment_method, eobi_contribution, sessi_contribution, effective_from
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `;

    const grossSalary = normalizedData.basicSalary +
      normalizedData.housingAllowance +
      normalizedData.transportAllowance +
      normalizedData.medicalAllowance +
      normalizedData.utilityAllowance +
      normalizedData.otherAllowances;

    // EOBI and SESSI are 0.75% of gross (employer contribution)
    const eobiContribution = grossSalary * 0.0075;
    const sessiContribution = grossSalary * 0.0075;

    await client.query(salaryQuery, [
      employee.id,
      normalizedData.basicSalary,
      normalizedData.housingAllowance,
      normalizedData.transportAllowance,
      normalizedData.medicalAllowance,
      normalizedData.utilityAllowance,
      normalizedData.otherAllowances,
      normalizedData.bonus,
      normalizedData.overtimeRate,
      normalizedData.providentFundEmployee,
      normalizedData.providentFundEmployer,
      normalizedData.paymentMethod,
      eobiContribution,
      sessiContribution,
      normalizedData.joiningDate,
    ]);

    await client.query('COMMIT');

    // Fetch complete employee data
    const createdEmployee = await getEmployeeById(employee.id);
    return {
      ...createdEmployee,
      loginCredentials: {
        email: user.email,
        temporaryPassword,
      },
    };
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
  const normalizedData = normalizeEmployeePayload(data);

  // Check if employee exists
  const existing = await db.query('SELECT id, user_id FROM employees WHERE id = $1', [id]);
  if (existing.rows.length === 0) {
    throw new NotFoundError('Employee not found');
  }

  const existingEmployee = existing.rows[0];
  const normalizedEmail = data.email !== undefined
    ? String(data.email).trim().toLowerCase()
    : undefined;

  if (normalizedEmail !== undefined) {
    if (!normalizedEmail) {
      throw new BadRequestError('Email is required');
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      throw new BadRequestError('Please provide a valid email');
    }

    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1 AND id <> $2',
      [normalizedEmail, existingEmployee.user_id || null]
    );

    if (existingUser.rows.length > 0) {
      throw new BadRequestError('A login account with this email already exists');
    }
  }

  // Build update query dynamically
  const updates = [];
  const params = [];
  let paramIndex = 1;

  if (data.fullName !== undefined) {
    const { firstName, lastName } = splitFullName(data.fullName);
    updates.push(`first_name = $${paramIndex}`);
    params.push(firstName);
    paramIndex++;
    updates.push(`last_name = $${paramIndex}`);
    params.push(lastName);
    paramIndex++;
    updates.push(`full_name_display = $${paramIndex}`);
    params.push(data.fullName.trim());
    paramIndex++;
  }

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
    residentialAddress: 'residential_address',
    city: 'city',
    nationality: 'nationality',
    departmentId: 'department_id',
    designation: 'designation',
    jobTitle: 'job_title',
    employmentType: 'employment_type',
    joiningDate: 'joining_date',
    probationPeriodMonths: 'probation_period_months',
    workLocation: 'work_location',
    endDate: 'end_date',
    reportingTo: 'reporting_to',
    bankName: 'bank_name',
    bankAccountNumber: 'bank_account_number',
    bankRoutingCode: 'bank_routing_code',
    bankBranch: 'bank_branch',
    ntnNumber: 'ntn_number',
    taxIdentifier: 'tax_identifier',
    taxInformation: 'tax_information',
    legalIdType: 'legal_id_type',
    legalIdNumber: 'legal_id_number',
    taxFilingStatus: 'tax_filing_status',
    status: 'status',
    profileImage: 'profile_image',
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      updates.push(`${column} = $${paramIndex}`);
      params.push(key === 'email' ? normalizedEmail : data[key]);
      paramIndex++;
    }
  }

  if (updates.length === 0 && ![
    'basicSalary',
    'housingAllowance',
    'transportAllowance',
    'medicalAllowance',
    'utilityAllowance',
    'otherAllowances',
    'bonus',
    'overtimeRate',
    'providentFundEmployee',
    'providentFundEmployer',
    'paymentMethod',
  ].some((key) => data[key] !== undefined)) {
    throw new BadRequestError('No valid fields to update');
  }

  if (updates.length > 0) {
    params.push(id);
    const query = `
      UPDATE employees
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    await db.query(query, params);
  }

  if (normalizedEmail !== undefined && existingEmployee.user_id) {
    await db.query(
      'UPDATE users SET email = $1 WHERE id = $2',
      [normalizedEmail, existingEmployee.user_id]
    );
  }

  if (
    data.basicSalary !== undefined ||
    data.housingAllowance !== undefined ||
    data.transportAllowance !== undefined ||
    data.medicalAllowance !== undefined ||
    data.utilityAllowance !== undefined ||
    data.otherAllowances !== undefined ||
    data.bonus !== undefined ||
    data.overtimeRate !== undefined ||
    data.providentFundEmployee !== undefined ||
    data.providentFundEmployer !== undefined ||
    data.paymentMethod !== undefined
  ) {
    const salaryResult = await db.query(
      `SELECT id, basic_salary, housing_allowance, transport_allowance, medical_allowance,
              utility_allowance, other_allowances, bonus, overtime_rate,
              provident_fund_employee, provident_fund_employer, payment_method
       FROM salary_structures
       WHERE employee_id = $1 AND is_current = true`,
      [id]
    );

    if (salaryResult.rows.length > 0) {
      const current = salaryResult.rows[0];
      await db.query(
        `UPDATE salary_structures
         SET basic_salary = $1,
             housing_allowance = $2,
             transport_allowance = $3,
             medical_allowance = $4,
             utility_allowance = $5,
             other_allowances = $6,
             bonus = $7,
             overtime_rate = $8,
             provident_fund_employee = $9,
             provident_fund_employer = $10,
             payment_method = $11
         WHERE id = $12`,
        [
          data.basicSalary !== undefined ? parseNumberValue(data.basicSalary, current.basic_salary) : current.basic_salary,
          data.housingAllowance !== undefined ? parseNumberValue(data.housingAllowance, current.housing_allowance) : current.housing_allowance,
          data.transportAllowance !== undefined ? parseNumberValue(data.transportAllowance, current.transport_allowance) : current.transport_allowance,
          data.medicalAllowance !== undefined ? parseNumberValue(data.medicalAllowance, current.medical_allowance) : current.medical_allowance,
          data.utilityAllowance !== undefined ? parseNumberValue(data.utilityAllowance, current.utility_allowance) : current.utility_allowance,
          data.otherAllowances !== undefined ? parseNumberValue(data.otherAllowances, current.other_allowances) : current.other_allowances,
          data.bonus !== undefined ? parseNumberValue(data.bonus, current.bonus) : current.bonus,
          data.overtimeRate !== undefined ? parseNumberValue(data.overtimeRate, current.overtime_rate) : current.overtime_rate,
          data.providentFundEmployee !== undefined ? parseNumberValue(data.providentFundEmployee, current.provident_fund_employee) : current.provident_fund_employee,
          data.providentFundEmployer !== undefined ? parseNumberValue(data.providentFundEmployer, current.provident_fund_employer) : current.provident_fund_employer,
          data.paymentMethod !== undefined ? data.paymentMethod : current.payment_method,
          current.id,
        ]
      );
    } else {
      await db.query(
        `INSERT INTO salary_structures (
          employee_id, basic_salary, housing_allowance, transport_allowance,
          medical_allowance, utility_allowance, other_allowances,
          bonus, overtime_rate, provident_fund_employee, provident_fund_employer, payment_method
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          id,
          normalizedData.basicSalary,
          normalizedData.housingAllowance,
          normalizedData.transportAllowance,
          normalizedData.medicalAllowance,
          normalizedData.utilityAllowance,
          normalizedData.otherAllowances,
          normalizedData.bonus,
          normalizedData.overtimeRate,
          normalizedData.providentFundEmployee,
          normalizedData.providentFundEmployer,
          normalizedData.paymentMethod || 'bank_transfer',
        ]
      );
    }
  }

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
 * Get attendance and leave summary for employee
 */
const getAttendanceLeaveSummary = async (employeeId, { month, year, limit } = {}) => {
  const now = new Date();
  const targetMonth = month || (now.getMonth() + 1);
  const targetYear = year || now.getFullYear();
  const rowLimit = limit || DEFAULT_ATTENDANCE_SUMMARY_LIMIT;

  const leaveResult = await db.query(
    `SELECT
       lt.code,
       lt.name,
       COALESCE(la.remaining_days, 0) AS remaining_days
     FROM leave_types lt
     LEFT JOIN leave_allocations la
       ON la.leave_type_id = lt.id
      AND la.employee_id = $1
      AND la.year = $2
     WHERE lt.is_active = true`,
    [employeeId, targetYear]
  );

  const leaveItems = leaveResult.rows.map((row) => ({
    code: row.code,
    name: row.name,
    remainingDays: parseNumberValue(row.remaining_days, 0),
  }));

  const leaveBalance = {
    total: 0,
    sickLeave: 0,
    casualLeave: 0,
    paidLeave: 0,
    items: leaveItems,
  };

  for (const item of leaveItems) {
    const category = mapLeaveCategory(item.code, item.name);
    if (category === 'sick') {
      leaveBalance.sickLeave += item.remainingDays;
    } else if (category === 'casual') {
      leaveBalance.casualLeave += item.remainingDays;
    } else if (category === 'paid') {
      leaveBalance.paidLeave += item.remainingDays;
    }
    leaveBalance.total += item.remainingDays;
  }

  const attendanceResult = await db.query(
    `SELECT id, date, check_in, check_out, working_hours, overtime_hours, status, notes
     FROM attendance
     WHERE employee_id = $1
     ORDER BY date DESC
     LIMIT $2`,
    [employeeId, rowLimit]
  );

  const overtimeResult = await db.query(
    `SELECT COALESCE(SUM(overtime_hours), 0) AS overtime_hours
     FROM attendance
     WHERE employee_id = $1
       AND EXTRACT(MONTH FROM date) = $2
       AND EXTRACT(YEAR FROM date) = $3`,
    [employeeId, targetMonth, targetYear]
  );

  return {
    leaveBalance,
    attendanceRecords: attendanceResult.rows.map((row) => ({
      id: row.id,
      date: row.date,
      checkIn: row.check_in,
      checkOut: row.check_out,
      workingHours: parseNumberValue(row.working_hours, 0),
      overtimeHours: parseNumberValue(row.overtime_hours, 0),
      status: row.status,
      notes: row.notes || null,
    })),
    overtimeHours: parseNumberValue(overtimeResult.rows[0]?.overtime_hours, 0),
    month: targetMonth,
    year: targetYear,
  };
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
  getEmployeeByEmployeeId,
  getEmployeeByIdentifier,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getAttendanceLeaveSummary,
  getEmployeeStats,
  getEmployeesByDepartment,
};
