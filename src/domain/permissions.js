const ROLES = {
  HR: 'hr',
  EMPLOYEE: 'employee',
};

const PERMISSIONS = {
  EMPLOYEE_CREATE: 'employee:create',
  EMPLOYEE_UPDATE: 'employee:update',
  EMPLOYEE_DELETE: 'employee:delete',
  USER_ROLE_ASSIGN: 'user:role:assign',
  EMPLOYEE_RECORD_MANAGE: 'employee:record:manage',
  LEAVE_APPROVE: 'leave:approve',
  ATTENDANCE_MANAGE: 'attendance:manage',
  PAYSLIP_GENERATE: 'payslip:generate',
  PAYROLL_REPORT_VIEW: 'payroll:report:view',
  PROFILE_VIEW_SELF: 'profile:view:self',
  ATTENDANCE_VIEW_SELF: 'attendance:view:self',
  LEAVE_APPLY_SELF: 'leave:apply:self',
  PAYSLIP_VIEW_SELF: 'payslip:view:self',
  SALARY_HISTORY_VIEW_SELF: 'salary_history:view:self',
};

const rolePermissions = {
  [ROLES.HR]: Object.values(PERMISSIONS),
  [ROLES.EMPLOYEE]: [
    PERMISSIONS.PROFILE_VIEW_SELF,
    PERMISSIONS.ATTENDANCE_VIEW_SELF,
    PERMISSIONS.LEAVE_APPLY_SELF,
    PERMISSIONS.PAYSLIP_VIEW_SELF,
    PERMISSIONS.SALARY_HISTORY_VIEW_SELF,
  ],
};

const getPermissionsForRole = (role) => rolePermissions[role] || [];

module.exports = {
  ROLES,
  PERMISSIONS,
  rolePermissions,
  getPermissionsForRole,
};
