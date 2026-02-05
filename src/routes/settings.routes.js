/**
 * Settings Routes
 */

const express = require('express');
const settingsController = require('../controllers/settings.controller');
const { protect, adminOnly } = require('../middleware/auth');
const { commonValidation, body, handleValidation } = require('../middleware/validate');

const router = express.Router();

router.use(protect);

const holidayValidation = [
  body('name').trim().notEmpty().withMessage('Holiday name is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('description').optional().trim(),
  body('isOptional').optional().isBoolean(),
  handleValidation,
];

// Settings (Admin only)
router.get('/', adminOnly, settingsController.getSettings);
router.put('/', adminOnly, settingsController.updateSettings);

// Public holidays
router.get('/holidays', settingsController.getPublicHolidays);
router.post('/holidays', adminOnly, holidayValidation, settingsController.addPublicHoliday);
router.delete('/holidays/:id', adminOnly, commonValidation.uuid('id')[0], settingsController.deletePublicHoliday);

module.exports = router;
