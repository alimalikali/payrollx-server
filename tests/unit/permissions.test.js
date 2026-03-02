const { getPermissionsForRole } = require('../../src/domain/permissions');

describe('Permissions', () => {
  it('gives admin the full privileged permission set', () => {
    const adminPermissions = getPermissionsForRole('admin');
    const hrPermissions = getPermissionsForRole('hr');

    expect(adminPermissions).toEqual(hrPermissions);
    expect(adminPermissions).toContain('employee:create');
    expect(adminPermissions).toContain('leave:approve');
  });
});
