/**
 * Department Routes
 */

const express = require('express');
const departmentController = require('../controllers/department.controller');
const { protect, adminOnly } = require('../middleware/auth');
const { commonValidation, body, handleValidation } = require('../middleware/validate');

const router = express.Router();

router.use(protect);

const departmentValidation = {
  create: [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('code').trim().notEmpty().isLength({ max: 10 }).withMessage('Code is required (max 10 chars)'),
    body('description').optional().trim(),
    handleValidation,
  ],
  update: [
    body('name').optional().trim().notEmpty(),
    body('code').optional().trim().isLength({ max: 10 }),
    body('description').optional().trim(),
    body('isActive').optional().isBoolean(),
    handleValidation,
  ],
};

router.get('/', departmentController.getDepartments);
router.get('/:id', commonValidation.uuid('id')[0], departmentController.getDepartment);
router.post('/', adminOnly, departmentValidation.create, departmentController.createDepartment);
router.put('/:id', adminOnly, commonValidation.uuid('id')[0], departmentValidation.update, departmentController.updateDepartment);
router.delete('/:id', adminOnly, commonValidation.uuid('id')[0], departmentController.deleteDepartment);

module.exports = router;
