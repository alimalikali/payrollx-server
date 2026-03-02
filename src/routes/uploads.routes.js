const express = require('express');
const uploadController = require('../controllers/upload.controller');
const { protect, hrOnly } = require('../middleware/auth');
const { body, handleValidation } = require('../middleware/validate');

const router = express.Router();

router.use(protect);
router.use(hrOnly);

router.post(
  '/profile-photo',
  [
    body('fileName').trim().notEmpty().withMessage('fileName is required'),
    body('contentType')
      .trim()
      .isIn(['image/jpeg', 'image/png', 'image/webp'])
      .withMessage('contentType must be image/jpeg, image/png, or image/webp'),
    body('data').trim().notEmpty().withMessage('data is required'),
    handleValidation,
  ],
  uploadController.saveProfilePhoto
);

module.exports = router;
