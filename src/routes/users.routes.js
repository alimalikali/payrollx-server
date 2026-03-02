const express = require('express');
const userController = require('../controllers/user.controller');
const { protect, hrOnly } = require('../middleware/auth');
const { commonValidation, body, handleValidation } = require('../middleware/validate');

const router = express.Router();

router.use(protect);
router.use(hrOnly);

const roleValidation = [
  body('role').isIn(['admin', 'hr', 'employee']).withMessage('Role must be admin, hr, or employee'),
  body('reason').optional().isString().withMessage('Reason must be a string'),
  handleValidation,
];

router.patch('/:id/role', commonValidation.uuid('id')[0], roleValidation, userController.assignRole);

module.exports = router;
