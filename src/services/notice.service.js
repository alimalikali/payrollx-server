/**
 * Notice Service
 * Handles notice board CRUD and notifications
 */

const db = require('../config/database');
const { NotFoundError } = require('../utils/errors');
const notificationService = require('./notification.service');
const emailService = require('./email.service');

const transformNotice = (row) => ({
  id: row.id,
  title: row.title,
  content: row.content,
  priority: row.priority,
  category: row.category,
  isPinned: row.is_pinned,
  expiresAt: row.expires_at,
  createdBy: row.created_by,
  createdByName: row.created_by_name || null,
  createdByEmail: row.created_by_email || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Get notices with filters and pagination
 */
const getNotices = async ({ page = 1, limit = 10, priority, category, search, pinnedOnly }) => {
  const offset = (page - 1) * limit;
  const params = [];
  let paramIndex = 1;
  const conditions = [];

  // Exclude expired notices
  conditions.push(`(n.expires_at IS NULL OR n.expires_at > CURRENT_TIMESTAMP)`);

  if (priority) {
    conditions.push(`n.priority = $${paramIndex}`);
    params.push(priority);
    paramIndex++;
  }

  if (category) {
    conditions.push(`n.category = $${paramIndex}`);
    params.push(category);
    paramIndex++;
  }

  if (search) {
    conditions.push(`(n.title ILIKE $${paramIndex} OR n.content ILIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (pinnedOnly === 'true' || pinnedOnly === true) {
    conditions.push(`n.is_pinned = true`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await db.query(
    `SELECT COUNT(*) FROM notices n ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(limit, offset);
  const result = await db.query(
    `SELECT n.*,
            u.email AS created_by_email,
            COALESCE(e.first_name || ' ' || e.last_name, u.email) AS created_by_name
     FROM notices n
     JOIN users u ON n.created_by = u.id
     LEFT JOIN employees e ON e.user_id = u.id
     ${whereClause}
     ORDER BY n.is_pinned DESC, n.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    params
  );

  return {
    notices: result.rows.map(transformNotice),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get single notice by ID
 */
const getNoticeById = async (id) => {
  const result = await db.query(
    `SELECT n.*,
            u.email AS created_by_email,
            COALESCE(e.first_name || ' ' || e.last_name, u.email) AS created_by_name
     FROM notices n
     JOIN users u ON n.created_by = u.id
     LEFT JOIN employees e ON e.user_id = u.id
     WHERE n.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Notice not found');
  }

  return transformNotice(result.rows[0]);
};

/**
 * Create a new notice and notify all active users
 */
const createNotice = async ({ title, content, priority, category, isPinned, expiresAt, createdBy }) => {
  const result = await db.query(
    `INSERT INTO notices (title, content, priority, category, is_pinned, expires_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [title, content, priority || 'low', category || 'general', isPinned || false, expiresAt || null, createdBy]
  );

  const notice = result.rows[0];

  // Notify all active users
  const usersResult = await db.query(
    `SELECT id, email FROM users WHERE is_active = true AND id != $1`,
    [createdBy]
  );

  // Fire-and-forget: notifications + emails should never crash notice creation
  if (usersResult.rows.length > 0) {
    notificationService.createBulkNotifications(
      usersResult.rows.map((u) => ({
        userId: u.id,
        type: 'new_notice',
        title: `New Notice: ${title}`,
        message: content.length > 100 ? content.substring(0, 100) + '...' : content,
        entityType: 'notice',
        entityId: notice.id,
      }))
    ).catch((err) => console.error('[Notice] Bulk notification failed:', err.message));

    if (['high', 'urgent'].includes(priority)) {
      const emailData = { title, content, priority, category };
      Promise.allSettled(
        usersResult.rows
          .filter((u) => u.email)
          .map((u) =>
            emailService.sendEmail({ to: u.email, template: 'newNoticePosted', data: emailData })
          )
      ).catch(() => {});
    }
  }

  return getNoticeById(notice.id);
};

/**
 * Update a notice
 */
const updateNotice = async (id, { title, content, priority, category, isPinned, expiresAt }) => {
  const fields = [];
  const params = [];
  let paramIndex = 1;

  if (title !== undefined) {
    fields.push(`title = $${paramIndex}`);
    params.push(title);
    paramIndex++;
  }
  if (content !== undefined) {
    fields.push(`content = $${paramIndex}`);
    params.push(content);
    paramIndex++;
  }
  if (priority !== undefined) {
    fields.push(`priority = $${paramIndex}`);
    params.push(priority);
    paramIndex++;
  }
  if (category !== undefined) {
    fields.push(`category = $${paramIndex}`);
    params.push(category);
    paramIndex++;
  }
  if (isPinned !== undefined) {
    fields.push(`is_pinned = $${paramIndex}`);
    params.push(isPinned);
    paramIndex++;
  }
  if (expiresAt !== undefined) {
    fields.push(`expires_at = $${paramIndex}`);
    params.push(expiresAt || null);
    paramIndex++;
  }

  if (fields.length === 0) {
    return getNoticeById(id);
  }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);

  const result = await db.query(
    `UPDATE notices SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING id`,
    params
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Notice not found');
  }

  return getNoticeById(id);
};

/**
 * Delete a notice
 */
const deleteNotice = async (id) => {
  const result = await db.query(
    `DELETE FROM notices WHERE id = $1 RETURNING id`,
    [id]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Notice not found');
  }
};

module.exports = {
  getNotices,
  getNoticeById,
  createNotice,
  updateNotice,
  deleteNotice,
};
