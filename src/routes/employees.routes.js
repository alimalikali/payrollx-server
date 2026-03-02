/**
 * Employee Routes
 */

const express = require('express');
const employeeController = require('../controllers/employee.controller');
const { protect, hrOnly } = require('../middleware/auth');
const { commonValidation, body, handleValidation } = require('../middleware/validate');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Employee validation rules
const employeeValidation = {
  create: [
    body('basicInfo.fullName').optional().trim().notEmpty().withMessage('Full name is required'),
    body('firstName').optional().trim().notEmpty().withMessage('First name is required'),
    body('lastName').optional().trim().notEmpty().withMessage('Last name is required'),
    body('basicInfo.email').optional().trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('email').optional().trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('basicInfo.phone').optional().trim(),
    body('phone').optional().trim(),
    body('cnic').optional().matches(/^\d{5}-\d{7}-\d$/).withMessage('Invalid CNIC format (XXXXX-XXXXXXX-X)'),
    body('basicInfo.dateOfBirth').optional().isISO8601().withMessage('Valid date of birth is required'),
    body('dateOfBirth').optional().isISO8601().withMessage('Valid date of birth is required'),
    body('basicInfo.gender').optional().isIn(['male', 'female', 'other']),
    body('gender').optional().isIn(['male', 'female', 'other']),
    body('basicInfo.maritalStatus').optional().isIn(['single', 'married', 'divorced', 'widowed']),
    body('maritalStatus').optional().isIn(['single', 'married', 'divorced', 'widowed']),
    body('basicInfo.nationality').optional().trim().notEmpty().withMessage('Nationality is required'),
    body('basicInfo.profileImage').optional().trim().notEmpty().withMessage('Profile photo is required'),
    body('basicInfo.residentialAddress').optional().trim().notEmpty().withMessage('Residential address is required'),
    body('jobDetails.departmentId').optional().isUUID().withMessage('Department is required'),
    body('departmentId').optional().isUUID().withMessage('Department is required'),
    body('jobDetails.jobTitle').optional().trim().notEmpty().withMessage('Job title is required'),
    body('designation').optional().trim().notEmpty().withMessage('Job title is required'),
    body('jobDetails.employmentType').optional().isIn(['full_time', 'part_time', 'contract', 'intern']),
    body('employmentType').optional().isIn(['full_time', 'part_time', 'contract', 'intern']),
    body('jobDetails.joiningDate').optional().isISO8601().withMessage('Valid joining date is required'),
    body('joiningDate').optional().isISO8601().withMessage('Valid joining date is required'),
    body('jobDetails.probationPeriodMonths').optional().isInt({ min: 0, max: 24 }),
    body('probationPeriodMonths').optional().isInt({ min: 0, max: 24 }),
    body('jobDetails.workLocation').optional().trim().notEmpty().withMessage('Work location is required'),
    body('workLocation').optional().trim().notEmpty().withMessage('Work location is required'),
    body('jobDetails.reportingManagerId').optional().isUUID().withMessage('Reporting manager is required'),
    body('reportingTo').optional().isUUID().withMessage('Reporting manager is required'),
    body('salaryDetails.basicSalary').optional().isFloat({ min: 0 }),
    body('status').optional().isIn(['active', 'inactive', 'terminated', 'on_leave']),
    body('salaryDetails.allowances.hra').optional().isFloat({ min: 0 }),
    body('salaryDetails.allowances.travel').optional().isFloat({ min: 0 }),
    body('salaryDetails.allowances.medical').optional().isFloat({ min: 0 }),
    body('salaryDetails.allowances.utility').optional().isFloat({ min: 0 }),
    body('salaryDetails.allowances.other').optional().isFloat({ min: 0 }),
    body('salaryDetails.bonus').optional().isFloat({ min: 0 }),
    body('salaryDetails.overtimeRate').optional().isFloat({ min: 0 }),
    body('salaryDetails.taxInformation').optional().trim().notEmpty(),
    body('salaryDetails.providentFundEmployee').optional().isFloat({ min: 0 }),
    body('salaryDetails.providentFundEmployer').optional().isFloat({ min: 0 }),
    body('salaryDetails.bankAccountNumber').optional().trim().notEmpty(),
    body('salaryDetails.bankName').optional().trim().notEmpty(),
    body('salaryDetails.bankRoutingCode').optional().trim().notEmpty(),
    body('salaryDetails.paymentMethod').optional().isIn(['bank_transfer', 'check']),
    body('legalInfo.legalIdType').optional().isIn(['cnic', 'passport', 'national_id', 'other']),
    body('legalInfo.legalIdNumber').optional().trim().notEmpty(),
    body('legalInfo.taxIdentifier').optional().trim().notEmpty(),
    body('taxFilingStatus').optional().isIn(['filer', 'non_filer']),
    body('basicSalary').optional().isFloat({ min: 0 }),

    body().custom((value) => {
      const basicInfo = value.basicInfo || {};
      const jobDetails = value.jobDetails || {};
      const salaryDetails = value.salaryDetails || {};
      const legalInfo = value.legalInfo || {};

      const fullName = basicInfo.fullName || [value.firstName, value.lastName].filter(Boolean).join(' ').trim();
      const email = basicInfo.email || value.email;
      const phone = basicInfo.phone || value.phone;
      const dateOfBirth = basicInfo.dateOfBirth || value.dateOfBirth;
      const gender = basicInfo.gender || value.gender;
      const maritalStatus = basicInfo.maritalStatus || value.maritalStatus;
      const nationality = basicInfo.nationality || value.nationality;
      const profileImage = basicInfo.profileImage || value.profileImage;
      const residentialAddress = basicInfo.residentialAddress || value.residentialAddress || value.address;

      const departmentId = jobDetails.departmentId || value.departmentId;
      const jobTitle = jobDetails.jobTitle || value.jobTitle || value.designation;
      const employmentType = jobDetails.employmentType || value.employmentType;
      const joiningDate = jobDetails.joiningDate || value.joiningDate;
      const probationPeriodMonths = jobDetails.probationPeriodMonths ?? value.probationPeriodMonths;
      const workLocation = jobDetails.workLocation || value.workLocation;
      const reportingManagerId = jobDetails.reportingManagerId || value.reportingTo;

      const salaryAllowances = salaryDetails.allowances || {};
      const basicSalary = salaryDetails.basicSalary ?? value.basicSalary;
      const bonus = salaryDetails.bonus ?? value.bonus;
      const overtimeRate = salaryDetails.overtimeRate ?? value.overtimeRate;
      const taxInformation = salaryDetails.taxInformation ?? value.taxInformation;
      const providentFundEmployee = salaryDetails.providentFundEmployee ?? value.providentFundEmployee;
      const providentFundEmployer = salaryDetails.providentFundEmployer ?? value.providentFundEmployer;
      const bankAccountNumber = salaryDetails.bankAccountNumber ?? value.bankAccountNumber;
      const bankName = salaryDetails.bankName ?? value.bankName;
      const bankRoutingCode = salaryDetails.bankRoutingCode ?? value.bankRoutingCode;
      const paymentMethod = salaryDetails.paymentMethod ?? value.paymentMethod;

      const legalIdType = legalInfo.legalIdType ?? value.legalIdType;
      const legalIdNumber = legalInfo.legalIdNumber ?? value.legalIdNumber;
      const taxIdentifier = legalInfo.taxIdentifier ?? value.taxIdentifier;

      if (!fullName) throw new Error('Full name is required');
      if (!email) throw new Error('Email is required');
      if (!phone) throw new Error('Phone number is required');
      if (!dateOfBirth) throw new Error('Date of birth is required');
      if (!gender) throw new Error('Gender is required');
      if (!maritalStatus) throw new Error('Marital status is required');
      if (!nationality) throw new Error('Nationality is required');
      if (!profileImage) throw new Error('Profile photo is required');
      if (!residentialAddress) throw new Error('Residential address is required');

      if (!departmentId) throw new Error('Department is required');
      if (!jobTitle) throw new Error('Job title is required');
      if (!employmentType) throw new Error('Employment type is required');
      if (!joiningDate) throw new Error('Joining date is required');
      if (probationPeriodMonths === undefined || probationPeriodMonths === null) {
        throw new Error('Probation period is required');
      }
      if (!workLocation) throw new Error('Work location is required');
      if (!reportingManagerId) throw new Error('Reporting manager is required');

      if (basicSalary === undefined || basicSalary === null) throw new Error('Basic salary is required');
      if (bonus === undefined || bonus === null) throw new Error('Bonus is required');
      if (overtimeRate === undefined || overtimeRate === null) throw new Error('Overtime rate is required');
      if (!taxInformation) throw new Error('Tax information is required');
      if (providentFundEmployee === undefined || providentFundEmployee === null) {
        throw new Error('Provident fund employee contribution is required');
      }
      if (providentFundEmployer === undefined || providentFundEmployer === null) {
        throw new Error('Provident fund employer contribution is required');
      }
      if (!bankAccountNumber) throw new Error('Bank account number is required');
      if (!bankName) throw new Error('Bank name is required');
      if (!bankRoutingCode) throw new Error('Bank routing code is required');
      if (!paymentMethod) throw new Error('Payment method is required');
      if (!['bank_transfer', 'check'].includes(paymentMethod)) {
        throw new Error('Payment method must be bank_transfer or check');
      }

      if (!legalIdType) throw new Error('Legal ID type is required');
      if (!legalIdNumber) throw new Error('Legal ID number is required');
      if (!taxIdentifier) throw new Error('Tax identifier is required');
      if (legalIdType === 'cnic' && !/^\d{5}-\d{7}-\d$/.test(legalIdNumber)) {
        throw new Error('Invalid CNIC format (XXXXX-XXXXXXX-X)');
      }

      if (salaryAllowances.hra !== undefined && salaryAllowances.hra < 0) throw new Error('HRA cannot be negative');
      if (salaryAllowances.travel !== undefined && salaryAllowances.travel < 0) throw new Error('Travel allowance cannot be negative');
      if (salaryAllowances.medical !== undefined && salaryAllowances.medical < 0) throw new Error('Medical allowance cannot be negative');
      if (salaryAllowances.utility !== undefined && salaryAllowances.utility < 0) throw new Error('Utility allowance cannot be negative');
      if (salaryAllowances.other !== undefined && salaryAllowances.other < 0) throw new Error('Other allowance cannot be negative');

      return true;
    }),
    handleValidation,
  ],
  update: [
    body('firstName').optional().trim().notEmpty(),
    body('lastName').optional().trim().notEmpty(),
    body('email').optional().trim().isEmail().normalizeEmail(),
    body('phone').optional().trim(),
    body('cnic').optional().matches(/^\d{5}-\d{7}-\d$/).withMessage('Invalid CNIC format'),
    body('gender').optional().isIn(['male', 'female', 'other']),
    body('employmentType').optional().isIn(['full_time', 'part_time', 'contract', 'intern']),
    body('status').optional().isIn(['active', 'inactive', 'terminated', 'on_leave']),
    body('taxFilingStatus').optional().isIn(['filer', 'non_filer']),
    body('jobTitle').optional().trim().notEmpty(),
    body('probationPeriodMonths').optional().isInt({ min: 0, max: 24 }),
    body('workLocation').optional().trim().notEmpty(),
    body('nationality').optional().trim().notEmpty(),
    body('residentialAddress').optional().trim().notEmpty(),
    body('taxInformation').optional().trim().notEmpty(),
    body('bankRoutingCode').optional().trim().notEmpty(),
    body('paymentMethod').optional().isIn(['bank_transfer', 'check']),
    body('legalIdType').optional().isIn(['cnic', 'passport', 'national_id', 'other']),
    body('legalIdNumber').optional().trim().notEmpty(),
    body('taxIdentifier').optional().trim().notEmpty(),
    body('bonus').optional().isFloat({ min: 0 }),
    body('overtimeRate').optional().isFloat({ min: 0 }),
    body('providentFundEmployee').optional().isFloat({ min: 0 }),
    body('providentFundEmployer').optional().isFloat({ min: 0 }),
    handleValidation,
  ],
};

// Statistics routes (must be before :id routes)
router.get('/stats', hrOnly, employeeController.getStats);
router.get('/by-department', hrOnly, employeeController.getByDepartment);

// CRUD routes
router.get('/me', employeeController.getMyEmployee);
router.get('/:id/attendance-leave-summary', employeeController.getAttendanceLeaveSummary);
router.get('/', hrOnly, employeeController.getEmployees);
router.post('/', hrOnly, employeeValidation.create, employeeController.createEmployee);
router.get('/:id', employeeController.getEmployee);
router.put('/:id', hrOnly, commonValidation.uuid('id')[0], employeeValidation.update, employeeController.updateEmployee);
router.delete('/:id', hrOnly, commonValidation.uuid('id')[0], employeeController.deleteEmployee);

module.exports = router;
