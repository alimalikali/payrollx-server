const express = require('express');
const notificationController = require('../controllers/notification.controller');
const { protect } = require('../middleware/auth');
const { commonValidation } = require('../middleware/validate');

const router = express.Router();

router.use(protect);

router.get('/', notificationController.getNotifications);
router.patch('/:id/read', commonValidation.uuid('id')[0], notificationController.markAsRead);
router.post('/read-all', notificationController.markAllAsRead);

module.exports = router;
