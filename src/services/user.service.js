const db = require('../config/database');
const { BadRequestError, NotFoundError } = require('../utils/errors');

const VALID_ROLES = ['hr', 'employee'];

const assignRole = async ({ targetUserId, newRole, changedBy, reason }) => {
  if (!VALID_ROLES.includes(newRole)) {
    throw new BadRequestError('Invalid role. Allowed roles: hr, employee');
  }

  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      'SELECT id, email, role, is_active FROM users WHERE id = $1',
      [targetUserId]
    );
    const user = userResult.rows[0];

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.role === newRole) {
      await client.query('COMMIT');
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.is_active,
      };
    }

    // Prevent lockout by retaining at least one active HR user.
    if (user.role === 'hr' && newRole !== 'hr') {
      const hrCountResult = await client.query(
        `SELECT COUNT(*) AS count
         FROM users
         WHERE role = 'hr'
           AND is_active = true
           AND id <> $1`,
        [targetUserId]
      );
      const remainingHrCount = parseInt(hrCountResult.rows[0].count, 10);
      if (remainingHrCount === 0) {
        throw new BadRequestError('Cannot remove the last active HR user');
      }
    }

    const updateResult = await client.query(
      `UPDATE users
       SET role = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, email, role, is_active`,
      [newRole, targetUserId]
    );
    const updatedUser = updateResult.rows[0];

    await client.query(
      `INSERT INTO role_change_history (user_id, old_role, new_role, changed_by, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [targetUserId, user.role, newRole, changedBy, reason || null]
    );

    await client.query(
      `INSERT INTO security_audit_log (user_id, event_type, details)
       VALUES ($1, 'role_changed', $2::jsonb)`,
      [
        changedBy,
        JSON.stringify({
          targetUserId,
          oldRole: user.role,
          newRole,
          reason: reason || null,
        }),
      ]
    );

    await client.query('COMMIT');

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      isActive: updatedUser.is_active,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  assignRole,
};
