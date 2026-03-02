const db = require('../config/database');
const { NotFoundError } = require('../utils/errors');

const createNotification = async ({
  userId,
  type,
  title,
  message,
  entityType = null,
  entityId = null,
}) => {
  await db.query(
    `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, type, title, message, entityType, entityId]
  );
};

const createBulkNotifications = async (notifications) => {
  if (!Array.isArray(notifications) || notifications.length === 0) return;

  const values = [];
  const placeholders = notifications.map((notification, index) => {
    const baseIndex = index * 6;
    values.push(
      notification.userId,
      notification.type,
      notification.title,
      notification.message,
      notification.entityType || null,
      notification.entityId || null
    );
    return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6})`;
  });

  await db.query(
    `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
     VALUES ${placeholders.join(', ')}`,
    values
  );
};

const getUserNotifications = async ({ userId, page = 1, limit = 20, unreadOnly = false }) => {
  const offset = (page - 1) * limit;
  const conditions = ['user_id = $1'];
  const params = [userId];
  let paramIndex = 2;

  if (unreadOnly) {
    conditions.push(`is_read = $${paramIndex}`);
    params.push(false);
    paramIndex++;
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countResult = await db.query(
    `SELECT COUNT(*) FROM notifications ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(limit, offset);
  const result = await db.query(
    `SELECT *
     FROM notifications
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    params
  );

  return {
    notifications: result.rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      entityType: row.entity_type,
      entityId: row.entity_id,
      isRead: row.is_read,
      readAt: row.read_at,
      createdAt: row.created_at,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const markNotificationAsRead = async ({ userId, notificationId }) => {
  const result = await db.query(
    `UPDATE notifications
     SET is_read = true, read_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [notificationId, userId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Notification not found');
  }
};

const markAllNotificationsAsRead = async ({ userId }) => {
  await db.query(
    `UPDATE notifications
     SET is_read = true, read_at = CURRENT_TIMESTAMP
     WHERE user_id = $1 AND is_read = false`,
    [userId]
  );
};

module.exports = {
  createNotification,
  createBulkNotifications,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
