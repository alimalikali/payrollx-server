/**
 * Data Transformation Utilities
 * Converts between snake_case (database) and camelCase (frontend)
 */

const snakeToCamel = (str) => str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

const camelToSnake = (str) => str
  .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
  .toLowerCase();

const toCamelCase = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (obj instanceof Date) return obj;

  if (typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      acc[snakeToCamel(key)] = toCamelCase(obj[key]);
      return acc;
    }, {});
  }

  return obj;
};

const toSnakeCase = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toSnakeCase);
  if (obj instanceof Date) return obj;

  if (typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      acc[camelToSnake(key)] = toSnakeCase(obj[key]);
      return acc;
    }, {});
  }

  return obj;
};

const parseNumber = (value, fallback = 0) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getNameParts = (record) => {
  const firstName = record.first_name || record.firstName || '';
  const lastName = record.last_name || record.lastName || '';

  if (firstName || lastName) {
    return { firstName, lastName };
  }

  const fullName = record.name || record.employee_name || '';
  const [first = '', ...rest] = fullName.split(' ');
  return { firstName: first, lastName: rest.join(' ') };
};

const transformEmployee = (dbRecord) => {
  if (!dbRecord) return null;

  const { firstName, lastName } = getNameParts(dbRecord);
  const employeeCode = dbRecord.employee_id || dbRecord.employee_code || dbRecord.code || null;
  const basicSalary = parseNumber(dbRecord.basic_salary);
  const grossSalary = parseNumber(dbRecord.gross_salary);

  return {
    id: dbRecord.id,
    employeeId: employeeCode,
    code: employeeCode,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
    email: dbRecord.email,
    phone: dbRecord.phone || null,
    cnic: dbRecord.cnic || null,
    dateOfBirth: formatDate(dbRecord.date_of_birth),
    gender: dbRecord.gender || null,
    maritalStatus: dbRecord.marital_status || null,
    address: dbRecord.address || null,
    city: dbRecord.city || null,
    departmentId: dbRecord.department_id || null,
    departmentName: dbRecord.department_name || null,
    departmentCode: dbRecord.department_code || null,
    department: dbRecord.department_name || dbRecord.department || null,
    designation: dbRecord.designation || null,
    employmentType: dbRecord.employment_type || 'full_time',
    joiningDate: formatDate(dbRecord.joining_date || dbRecord.joined_date),
    joinedDate: formatDate(dbRecord.joining_date || dbRecord.joined_date),
    endDate: formatDate(dbRecord.end_date),
    reportingTo: dbRecord.reporting_to || dbRecord.manager_id || null,
    managerName: dbRecord.manager_first_name
      ? `${dbRecord.manager_first_name} ${dbRecord.manager_last_name || ''}`.trim()
      : null,
    bankName: dbRecord.bank_name || null,
    bankAccountNumber: dbRecord.bank_account_number || null,
    bankBranch: dbRecord.bank_branch || null,
    ntnNumber: dbRecord.ntn_number || null,
    taxFilingStatus: dbRecord.tax_filing_status || 'non_filer',
    status: dbRecord.status,
    profileImage: dbRecord.profile_image || dbRecord.avatar_url || null,
    avatar: dbRecord.profile_image || dbRecord.avatar_url || null,
    basicSalary,
    grossSalary,
    salary: {
      basic: basicSalary,
      hra: parseNumber(dbRecord.housing_allowance || dbRecord.hra),
      transport: parseNumber(dbRecord.transport_allowance),
      medical: parseNumber(dbRecord.medical_allowance),
      overtime: parseNumber(dbRecord.overtime_rate),
    },
    leaveBalance: {
      annual: parseNumber(dbRecord.annual_leaves) - parseNumber(dbRecord.annual_used),
      sick: parseNumber(dbRecord.sick_leaves) - parseNumber(dbRecord.sick_used),
      casual: parseNumber(dbRecord.casual_leaves) - parseNumber(dbRecord.casual_used),
    },
    createdAt: dbRecord.created_at,
    updatedAt: dbRecord.updated_at,
  };
};

const transformEmployeeList = (records = []) => records.map(transformEmployee);

const formatTime = (value) => {
  if (!value) return null;

  if (typeof value === 'string') {
    const withSeconds = value.match(/^(\d{2}:\d{2}:\d{2})$/);
    if (withSeconds) return withSeconds[1];

    const withoutSeconds = value.match(/^(\d{2}:\d{2})$/);
    if (withoutSeconds) return withoutSeconds[1];
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const transformAttendance = (dbRecord) => {
  if (!dbRecord) return null;

  const { firstName, lastName } = getNameParts(dbRecord);

  return {
    id: dbRecord.id,
    employeeId: dbRecord.employee_id,
    employeeName: (dbRecord.employee_name || `${firstName} ${lastName}`).trim() || null,
    employeeCode: dbRecord.emp_code || dbRecord.employee_code || null,
    departmentName: dbRecord.department_name || null,
    date: formatDate(dbRecord.date),
    checkIn: formatTime(dbRecord.check_in),
    checkOut: formatTime(dbRecord.check_out),
    workingHours: parseNumber(dbRecord.working_hours || dbRecord.hours_worked),
    hoursWorked: parseNumber(dbRecord.working_hours || dbRecord.hours_worked),
    overtimeHours: parseNumber(dbRecord.overtime_hours),
    status: dbRecord.status,
    notes: dbRecord.notes || null,
  };
};

const transformAttendanceList = (records = []) => records.map(transformAttendance);

const transformLeaveRequest = (dbRecord) => {
  if (!dbRecord) return null;

  const { firstName, lastName } = getNameParts(dbRecord);
  const employeeName = (dbRecord.employee_name || `${firstName} ${lastName}`).trim();

  return {
    id: dbRecord.id,
    employeeId: dbRecord.employee_id,
    employeeName,
    employeeCode: dbRecord.emp_code || null,
    departmentName: dbRecord.department_name || null,
    leaveTypeId: dbRecord.leave_type_id,
    leaveTypeName: dbRecord.leave_type_name || dbRecord.leave_type || null,
    leaveTypeCode: dbRecord.leave_type_code || null,
    isPaid: dbRecord.is_paid,
    startDate: formatDate(dbRecord.start_date),
    endDate: formatDate(dbRecord.end_date),
    totalDays: parseNumber(dbRecord.total_days || dbRecord.days_count),
    days: parseNumber(dbRecord.total_days || dbRecord.days_count),
    isHalfDay: !!dbRecord.is_half_day,
    halfDayType: dbRecord.half_day_type || null,
    reason: dbRecord.reason,
    attachmentUrl: dbRecord.attachment_url || null,
    status: dbRecord.status,
    approvedBy: dbRecord.approved_by || null,
    approvedByEmail: dbRecord.approved_by_email || null,
    approvedAt: dbRecord.approved_at,
    rejectionReason: dbRecord.rejection_reason || null,
    type: dbRecord.leave_type_code || dbRecord.leave_type || dbRecord.leave_type_name || 'leave',
    appliedOn: formatDate(dbRecord.created_at),
    createdAt: dbRecord.created_at,
  };
};

const transformLeaveRequestList = (records = []) => records.map(transformLeaveRequest);

const transformPayrollRecord = (dbRecord) => {
  if (!dbRecord) return null;

  const { firstName, lastName } = getNameParts(dbRecord);

  return {
    id: dbRecord.id,
    employeeId: dbRecord.employee_id,
    employeeName: (dbRecord.employee_name || `${firstName} ${lastName}`).trim() || null,
    month: dbRecord.month,
    basic: parseNumber(dbRecord.basic_salary),
    allowances:
      parseNumber(dbRecord.hra) +
      parseNumber(dbRecord.transport_allowance) +
      parseNumber(dbRecord.medical_allowance) +
      parseNumber(dbRecord.overtime_pay),
    deductions: parseNumber(dbRecord.total_deductions),
    tax: parseNumber(dbRecord.income_tax),
    netPay: parseNumber(dbRecord.net_salary),
    status: dbRecord.status,
  };
};

const transformAlert = (dbRecord) => {
  if (!dbRecord) return null;

  const { firstName, lastName } = getNameParts(dbRecord);

  return {
    id: dbRecord.id,
    severity: dbRecord.severity,
    title: dbRecord.title,
    employeeId: dbRecord.employee_id,
    employeeName: (dbRecord.employee_name || `${firstName} ${lastName}`).trim() || null,
    description: dbRecord.description,
    timestamp: formatDateTime(dbRecord.generated_at || dbRecord.created_at),
    reviewed: !!dbRecord.is_reviewed,
  };
};

const transformRecommendation = (record) => {
  if (!record) return null;

  return {
    id: record.id,
    employeeId: record.employee_id,
    employeeName: record.employee_name,
    score: record.score,
    recommendation: record.recommendation,
    suggestedRange: record.suggested_range,
    rationale: record.rationale,
  };
};

const transformForecast = (record) => {
  if (!record) return null;

  return {
    month: record.month,
    actual: record.actual !== undefined ? parseNumber(record.actual) : undefined,
    forecast: record.forecast !== undefined ? parseNumber(record.forecast) : undefined,
  };
};

const formatDate = (date) => {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return String(date);
  return parsed.toISOString().split('T')[0];
};

const formatDateTime = (datetime) => {
  if (!datetime) return null;
  const d = new Date(datetime);
  if (Number.isNaN(d.getTime())) return String(datetime);
  return `${formatDate(d)} ${formatTime(d)}`;
};

module.exports = {
  snakeToCamel,
  camelToSnake,
  toCamelCase,
  toSnakeCase,
  transformEmployee,
  transformEmployeeList,
  transformAttendance,
  transformAttendanceList,
  transformLeaveRequest,
  transformLeaveRequestList,
  transformPayrollRecord,
  transformAlert,
  transformRecommendation,
  transformForecast,
  formatDate,
  formatTime,
  formatDateTime,
};
