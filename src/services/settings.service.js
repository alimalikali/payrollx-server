/**
 * Settings Service
 * Handles system settings and configurations
 */

const db = require('../config/database');

// Default settings
const DEFAULT_SETTINGS = {
  company: {
    name: 'PayrollX Company',
    address: 'Lahore, Pakistan',
    phone: '+92-42-1234567',
    email: 'hr@company.com',
    ntn: '',
    registrationNo: '',
  },
  payroll: {
    paymentDay: 28,
    workingHoursPerDay: 8,
    workingDaysPerWeek: 5,
    overtimeMultiplier: 1.5,
    gracePeriodMinutes: 15,
    lateArrivalDeduction: false,
    currency: 'PKR',
  },
  leave: {
    carryForwardEnabled: true,
    maxCarryForwardDays: 7,
    probationLeaveDays: 0,
    requireApproval: true,
  },
  attendance: {
    workStartTime: '09:00',
    workEndTime: '18:00',
    halfDayHours: 4,
    autoMarkAbsent: true,
    autoMarkAbsentTime: '10:30',
  },
  notifications: {
    emailEnabled: true,
    payslipEmail: true,
    leaveApprovalEmail: true,
    attendanceAlertEmail: false,
  },
};

/**
 * Get all settings
 */
const getSettings = async () => {
  const result = await db.query('SELECT key, value FROM settings');

  const settings = { ...DEFAULT_SETTINGS };

  for (const row of result.rows) {
    const keys = row.key.split('.');
    let current = settings;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    try {
      current[keys[keys.length - 1]] = JSON.parse(row.value);
    } catch {
      current[keys[keys.length - 1]] = row.value;
    }
  }

  return settings;
};

/**
 * Get setting by key
 */
const getSetting = async (key) => {
  const result = await db.query(
    'SELECT value FROM settings WHERE key = $1',
    [key]
  );

  if (result.rows.length === 0) {
    // Return default
    const keys = key.split('.');
    let value = DEFAULT_SETTINGS;
    for (const k of keys) {
      value = value?.[k];
    }
    return value;
  }

  try {
    return JSON.parse(result.rows[0].value);
  } catch {
    return result.rows[0].value;
  }
};

/**
 * Update settings
 */
const updateSettings = async (settings) => {
  const flatSettings = flattenObject(settings);

  for (const [key, value] of Object.entries(flatSettings)) {
    const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);

    await db.query(`
      INSERT INTO settings (key, value)
      VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP
    `, [key, valueStr]);
  }

  return getSettings();
};

/**
 * Update single setting
 */
const updateSetting = async (key, value) => {
  const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);

  await db.query(`
    INSERT INTO settings (key, value)
    VALUES ($1, $2)
    ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP
  `, [key, valueStr]);

  return getSetting(key);
};

/**
 * Get public holidays
 */
const getPublicHolidays = async (year) => {
  const targetYear = year || new Date().getFullYear();

  const result = await db.query(
    'SELECT * FROM public_holidays WHERE year = $1 ORDER BY date',
    [targetYear]
  );

  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    date: row.date,
    description: row.description,
    isOptional: row.is_optional,
  }));
};

/**
 * Add public holiday
 */
const addPublicHoliday = async ({ name, date, description, isOptional }) => {
  const year = new Date(date).getFullYear();

  const result = await db.query(`
    INSERT INTO public_holidays (name, date, year, description, is_optional)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [name, date, year, description, isOptional || false]);

  return result.rows[0];
};

/**
 * Delete public holiday
 */
const deletePublicHoliday = async (id) => {
  await db.query('DELETE FROM public_holidays WHERE id = $1', [id]);
};

// Helper function to flatten nested object
const flattenObject = (obj, prefix = '') => {
  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey));
    } else {
      result[newKey] = value;
    }
  }

  return result;
};

module.exports = {
  getSettings,
  getSetting,
  updateSettings,
  updateSetting,
  getPublicHolidays,
  addPublicHoliday,
  deletePublicHoliday,
  DEFAULT_SETTINGS,
};
