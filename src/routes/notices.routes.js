/**
 * Notice Routes
 * /api/v1/notices
 */

const express = require('express');
const { body } = require('express-validator');
const { protect, hrOnly } = require('../middleware/auth');
const { handleValidation, commonValidation } = require('../middleware/validate');
const noticeController = require('../controllers/notice.controller');

const router = express.Router();

router.use(protect);

const noticeValidation = {
  create: [
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 255 }).withMessage('Title max 255 characters'),
    body('content').trim().notEmpty().withMessage('Content is required'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
    body('category').optional().isIn(['general', 'policy', 'event', 'holiday', 'payroll']).withMessage('Invalid category'),
    body('isPinned').optional().isBoolean().withMessage('isPinned must be boolean'),
    body('expiresAt').optional({ nullable: true }).isISO8601().withMessage('Invalid expiry date'),
    handleValidation,
  ],
  update: [
    body('title').optional().trim().notEmpty().withMessage('Title cannot be empty').isLength({ max: 255 }),
    body('content').optional().trim().notEmpty().withMessage('Content cannot be empty'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
    body('category').optional().isIn(['general', 'policy', 'event', 'holiday', 'payroll']).withMessage('Invalid category'),
    body('isPinned').optional().isBoolean().withMessage('isPinned must be boolean'),
    body('expiresAt').optional({ nullable: true }).isISO8601().withMessage('Invalid expiry date'),
    handleValidation,
  ],
};

// All authenticated users can view notices
router.get('/', noticeController.getNotices);
router.get('/:id', commonValidation.uuid('id')[0], noticeController.getNotice);

// HR/Admin only: create, update, delete
router.post('/', hrOnly, ...noticeValidation.create, noticeController.createNotice);
router.put('/:id', hrOnly, commonValidation.uuid('id')[0], ...noticeValidation.update, noticeController.updateNotice);
router.delete('/:id', hrOnly, commonValidation.uuid('id')[0], noticeController.deleteNotice);

module.exports = router;
