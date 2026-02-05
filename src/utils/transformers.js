/**
 * Data Transformation Utilities
 * Converts between snake_case (database) and camelCase (frontend)
 */

/**
 * Convert snake_case string to camelCase
 * @param {string} str - snake_case string
 * @returns {string} camelCase string
 */
const snakeToCamel = (str) => {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};

/**
 * Convert camelCase string to snake_case
 * @param {string} str - camelCase string
 * @returns {string} snake_case string
 */
const camelToSnake = (str) => {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
};

/**
 * Transform object keys from snake_case to camelCase (recursive)
 * @param {any} obj - Object to transform
 * @returns {any} Transformed object
 */
const toCamelCase = (obj) => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(toCamelCase);
  }

  if (obj instanceof Date) {
    return obj;
  }

  if (typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = snakeToCamel(key);
      acc[camelKey] = toCamelCase(obj[key]);
      return acc;
    }, {});
  }

  return obj;
};

/**
 * Transform object keys from camelCase to snake_case (recursive)
 * @param {any} obj - Object to transform
 * @returns {any} Transformed object
 */
const toSnakeCase = (obj) => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase);
  }

  if (obj instanceof Date) {
    return obj;
  }

  if (typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const snakeKey = camelToSnake(key);
      acc[snakeKey] = toSnakeCase(obj[key]);
      return acc;
    }, {});
  }

  return obj;
};

/**
 * Transform employee database record to frontend format
 * @param {object} dbRecord - Database employee record with joined data
 * @returns {object} Frontend-formatted employee
 */
const transformEmployee = (dbRecord) => {
  if (!dbRecord) return null;

  return {
    id: dbRecord.id,
    code: dbRecord.employee_code,
    name: `${dbRecord.first_name} ${dbRecord.last_name}`,
    email: dbRecord.email,
    phone: dbRecord.phone || '',
    avatar: dbRecord.avatar_url || null,
    department: dbRecord.department_name || dbRecord.department,
    designation: dbRecord.designation,
    status: dbRecord.status,
    joinedDate: dbRecord.joined_date ? formatDate(dbRecord.joined_date) : null,
    salary: {
      basic: parseFloat(dbRecord.basic_salary) || 0,
      hra: parseFloat(dbRecord.hra) || 0,
      transport: parseFloat(dbRecord.transport_allowance) || 0,
      medical: parseFloat(dbRecord.medical_allowance) || 0,
      overtime: parseFloat(dbRecord.overtime_rate) || 0,
    },
    leaveBalance: {
      annual: (dbRecord.annual_leaves || 0) - (dbRecord.annual_used || 0),
      sick: (dbRecord.sick_leaves || 0) - (dbRecord.sick_used || 0),
      casual: (dbRecord.casual_leaves || 0) - (dbRecord.casual_used || 0),
    },
  };
};

/**
 * Transform attendance database record to frontend format
 * @param {object} dbRecord - Database attendance record
 * @returns {object} Frontend-formatted attendance
 */
const transformAttendance = (dbRecord) => {
  if (!dbRecord) return null;

  return {
    id: dbRecord.id,
    employeeId: dbRecord.employee_id,
    date: formatDate(dbRecord.date),
    checkIn: dbRecord.check_in ? formatTime(dbRecord.check_in) : null,
    checkOut: dbRecord.check_out ? formatTime(dbRecord.check_out) : null,
    status: dbRecord.status,
    hoursWorked: parseFloat(dbRecord.hours_worked) || 0,
  };
};

/**
 * Transform leave request database record to frontend format
 * @param {object} dbRecord - Database leave record
 * @returns {object} Frontend-formatted leave request
 */
const transformLeaveRequest = (dbRecord) => {
  if (!dbRecord) return null;

  return {
    id: dbRecord.id,
    employeeId: dbRecord.employee_id,
    employeeName: dbRecord.employee_name || `${dbRecord.first_name} ${dbRecord.last_name}`,
    type: dbRecord.leave_type,
    startDate: formatDate(dbRecord.start_date),
    endDate: formatDate(dbRecord.end_date),
    days: dbRecord.days_count,
    reason: dbRecord.reason,
    status: dbRecord.status,
    appliedOn: formatDate(dbRecord.applied_on || dbRecord.created_at),
  };
};

/**
 * Transform payroll record to frontend format
 * @param {object} dbRecord - Database payroll/payslip record
 * @returns {object} Frontend-formatted payroll record
 */
const transformPayrollRecord = (dbRecord) => {
  if (!dbRecord) return null;

  return {
    id: dbRecord.id,
    employeeId: dbRecord.employee_id,
    employeeName: dbRecord.employee_name || `${dbRecord.first_name} ${dbRecord.last_name}`,
    month: dbRecord.month,
    basic: parseFloat(dbRecord.basic_salary) || 0,
    allowances: parseFloat(dbRecord.hra || 0) +
                parseFloat(dbRecord.transport_allowance || 0) +
                parseFloat(dbRecord.medical_allowance || 0) +
                parseFloat(dbRecord.overtime_pay || 0),
    deductions: parseFloat(dbRecord.total_deductions) || 0,
    tax: parseFloat(dbRecord.income_tax) || 0,
    netPay: parseFloat(dbRecord.net_salary) || 0,
    status: dbRecord.status,
  };
};

/**
 * Transform AI alert to frontend format
 * @param {object} dbRecord - Database AI alert record
 * @returns {object} Frontend-formatted alert
 */
const transformAlert = (dbRecord) => {
  if (!dbRecord) return null;

  return {
    id: dbRecord.id,
    severity: dbRecord.severity,
    title: dbRecord.title,
    employeeId: dbRecord.employee_id,
    employeeName: dbRecord.employee_name || `${dbRecord.first_name} ${dbRecord.last_name}`,
    description: dbRecord.description,
    timestamp: formatDateTime(dbRecord.generated_at || dbRecord.created_at),
    reviewed: dbRecord.is_reviewed || false,
  };
};

/**
 * Transform salary recommendation to frontend format
 * @param {object} record - Recommendation data
 * @returns {object} Frontend-formatted recommendation
 */
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

/**
 * Transform payroll forecast to frontend format
 * @param {object} record - Forecast data
 * @returns {object} Frontend-formatted forecast
 */
const transformForecast = (record) => {
  if (!record) return null;

  return {
    month: record.month,
    actual: record.actual !== undefined ? parseFloat(record.actual) : undefined,
    forecast: record.forecast !== undefined ? parseFloat(record.forecast) : undefined,
  };
};

// Date formatting helpers
const formatDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
};

const formatTime = (datetime) => {
  if (!datetime) return null;
  const d = new Date(datetime);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }); // e.g., "09:00 AM"
};

const formatDateTime = (datetime) => {
  if (!datetime) return null;
  const d = new Date(datetime);
  return `${formatDate(d)} ${formatTime(d)}`; // "2024-11-15 09:00 AM"
};

module.exports = {
  snakeToCamel,
  camelToSnake,
  toCamelCase,
  toSnakeCase,
  transformEmployee,
  transformAttendance,
  transformLeaveRequest,
  transformPayrollRecord,
  transformAlert,
  transformRecommendation,
  transformForecast,
  formatDate,
  formatTime,
  formatDateTime,
};
