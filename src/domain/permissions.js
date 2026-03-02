const ROLES = {
  ADMIN: 'admin',
  HR: 'hr',
  EMPLOYEE: 'employee',
};

const PRIVILEGED_ROLES = [ROLES.ADMIN, ROLES.HR];

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
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
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
const isPrivilegedRole = (role) => PRIVILEGED_ROLES.includes(role);

module.exports = {
  ROLES,
  PRIVILEGED_ROLES,
  PERMISSIONS,
  rolePermissions,
  getPermissionsForRole,
  isPrivilegedRole,
};
