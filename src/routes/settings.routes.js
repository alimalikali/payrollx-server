/**
 * Settings Routes
 */

const express = require('express');
const settingsController = require('../controllers/settings.controller');
const { protect, hrOnly } = require('../middleware/auth');
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

// Settings (HR only)
router.get('/', hrOnly, settingsController.getSettings);
router.put('/', hrOnly, settingsController.updateSettings);

// Public holidays
router.get('/holidays', settingsController.getPublicHolidays);
router.post('/holidays', hrOnly, holidayValidation, settingsController.addPublicHoliday);
router.delete('/holidays/:id', hrOnly, commonValidation.uuid('id')[0], settingsController.deletePublicHoliday);

module.exports = router;
