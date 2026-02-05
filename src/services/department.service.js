/**
 * Department Service
 * Handles department operations
 */

const db = require('../config/database');
const { NotFoundError } = require('../utils/errors');

/**
 * Get all departments
 */
const getDepartments = async ({ includeInactive = false } = {}) => {
  const query = includeInactive
    ? 'SELECT * FROM departments ORDER BY name'
    : 'SELECT * FROM departments WHERE is_active = true ORDER BY name';

  const result = await db.query(query);

  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
  }));
};

/**
 * Get department by ID
 */
const getDepartmentById = async (id) => {
  const result = await db.query(
    'SELECT * FROM departments WHERE id = $1',
    [id]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Department not found');
  }

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
};

/**
 * Create department
 */
const createDepartment = async ({ name, code, description }) => {
  const result = await db.query(
    `INSERT INTO departments (name, code, description)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [name, code.toUpperCase(), description]
  );

  return getDepartmentById(result.rows[0].id);
};

/**
 * Update department
 */
const updateDepartment = async (id, { name, code, description, isActive }) => {
  const updates = [];
  const params = [];
  let paramIndex = 1;

  if (name !== undefined) {
    updates.push(`name = $${paramIndex}`);
    params.push(name);
    paramIndex++;
  }
  if (code !== undefined) {
    updates.push(`code = $${paramIndex}`);
    params.push(code.toUpperCase());
    paramIndex++;
  }
  if (description !== undefined) {
    updates.push(`description = $${paramIndex}`);
    params.push(description);
    paramIndex++;
  }
  if (isActive !== undefined) {
    updates.push(`is_active = $${paramIndex}`);
    params.push(isActive);
    paramIndex++;
  }

  if (updates.length === 0) {
    return getDepartmentById(id);
  }

  params.push(id);
  await db.query(
    `UPDATE departments SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
    params
  );

  return getDepartmentById(id);
};

/**
 * Delete department (soft delete)
 */
const deleteDepartment = async (id) => {
  const result = await db.query(
    'UPDATE departments SET is_active = false WHERE id = $1 RETURNING id',
    [id]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Department not found');
  }

  return { message: 'Department deactivated successfully' };
};

module.exports = {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
};
