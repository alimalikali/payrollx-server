const notificationService = require('../services/notification.service');
const { success } = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');

const getNotifications = asyncHandler(async (req, res) => {
  const { page, limit, unreadOnly } = req.query;

  const result = await notificationService.getUserNotifications({
    userId: req.user.id,
    page: parseInt(page, 10) || 1,
    limit: parseInt(limit, 10) || 20,
    unreadOnly: unreadOnly === 'true',
  });

  res.json(success(result.notifications, null, result.pagination));
});

const markAsRead = asyncHandler(async (req, res) => {
  await notificationService.markNotificationAsRead({
    userId: req.user.id,
    notificationId: req.params.id,
  });

  res.json(success(null, 'Notification marked as read'));
});

const markAllAsRead = asyncHandler(async (req, res) => {
  await notificationService.markAllNotificationsAsRead({
    userId: req.user.id,
  });

  res.json(success(null, 'All notifications marked as read'));
});

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
};
