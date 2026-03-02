/**
 * Employee Service Tests
 */

jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
}));

jest.mock('../../src/utils/transformers', () => ({
  transformEmployee: jest.fn(),
  transformEmployeeList: jest.fn((rows) => rows),
}));

const db = require('../../src/config/database');
const bcrypt = require('bcryptjs');
const { transformEmployee } = require('../../src/utils/transformers');
const employeeService = require('../../src/services/employee.service');

describe('Employee Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createEmployee', () => {
    it('creates linked employee login account with the HR-provided password', async () => {
      const client = {
        query: jest.fn(),
        release: jest.fn(),
      };

      db.getClient.mockResolvedValue(client);
      bcrypt.hash.mockResolvedValue('hashed-created-password');

      client.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // employee count
        .mockResolvedValueOnce({ rows: [] }) // existing user check
        .mockResolvedValueOnce({ rows: [{ id: 'user-123', email: 'new.employee@payrollx.com' }] }) // insert user
        .mockResolvedValueOnce({ rows: [{ id: 'emp-123' }] }) // insert employee
        .mockResolvedValueOnce({}) // insert salary
        .mockResolvedValueOnce({ rows: [{ id: 'leave-type-1', days_per_year: 14 }] }) // active leave types
        .mockResolvedValueOnce({}) // insert leave allocation
        .mockResolvedValueOnce({}); // COMMIT

      db.query.mockResolvedValueOnce({
        rows: [{ id: 'emp-123', first_name: 'New', last_name: 'Employee' }],
      });
      transformEmployee.mockReturnValue({
        id: 'emp-123',
        firstName: 'New',
        lastName: 'Employee',
      });

      const result = await employeeService.createEmployee({
        firstName: 'New',
        lastName: 'Employee',
        email: 'New.Employee@PayrollX.com',
        phone: '+1-555-0202',
        dateOfBirth: '1998-02-25',
        gender: 'male',
        maritalStatus: 'single',
        nationality: 'Pakistani',
        profileImage: '/uploads/profiles/new-employee.png',
        residentialAddress: '123 Main Street',
        departmentId: '879f188f-d4c0-4c2a-9fdd-f6382f6bc18c',
        jobTitle: 'Software Engineer',
        employmentType: 'full_time',
        probationPeriodMonths: 3,
        workLocation: 'Lahore Office',
        reportingTo: '2def08ce-a414-4ad6-9ad5-d4b4a2461460',
        joiningDate: '2026-02-25',
        basicSalary: 120000,
        housingAllowance: 10000,
        transportAllowance: 5000,
        medicalAllowance: 3000,
        utilityAllowance: 2000,
        otherAllowances: 1000,
        bonus: 0,
        overtimeRate: 1200,
        taxInformation: 'Filer',
        providentFundEmployee: 4000,
        providentFundEmployer: 4000,
        bankAccountNumber: 'PK12ABCD123456789',
        bankName: 'HBL',
        bankRoutingCode: 'HBLPKKAXXX',
        paymentMethod: 'bank_transfer',
        legalIdType: 'cnic',
        legalIdNumber: '12345-1234567-1',
        taxIdentifier: 'NTN-12345',
        password: 'CreatedPass123',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('CreatedPass123', 12);
      expect(result.id).toBe('emp-123');
      expect(result.loginCredentials).toBeDefined();
      expect(result.loginCredentials.email).toBe('new.employee@payrollx.com');
      expect(result.loginCredentials.password).toBe('CreatedPass123');

      const insertEmployeeCall = client.query.mock.calls.find(([query]) =>
        typeof query === 'string' && query.includes('INSERT INTO employees')
      );
      expect(insertEmployeeCall).toBeDefined();
      expect(insertEmployeeCall[1][0]).toBe('user-123');
      expect(insertEmployeeCall[1][5]).toBe('new.employee@payrollx.com');

      const leaveTypeQueryCall = client.query.mock.calls.find(([query]) =>
        typeof query === 'string' && query.includes('FROM leave_types')
      );
      expect(leaveTypeQueryCall).toBeDefined();

      const insertLeaveAllocationCall = client.query.mock.calls.find(([query]) =>
        typeof query === 'string' && query.includes('INSERT INTO leave_allocations')
      );
      expect(insertLeaveAllocationCall).toBeDefined();
      expect(insertLeaveAllocationCall[1]).toEqual([
        'emp-123',
        'leave-type-1',
        new Date().getFullYear(),
        14,
        0,
      ]);

      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it('rolls back employee creation when leave allocation creation fails', async () => {
      const client = {
        query: jest.fn(),
        release: jest.fn(),
      };

      db.getClient.mockResolvedValue(client);
      bcrypt.hash.mockResolvedValue('hashed-created-password');

      client.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // employee count
        .mockResolvedValueOnce({ rows: [] }) // existing user check
        .mockResolvedValueOnce({ rows: [{ id: 'user-123', email: 'new.employee@payrollx.com' }] }) // insert user
        .mockResolvedValueOnce({ rows: [{ id: 'emp-123' }] }) // insert employee
        .mockResolvedValueOnce({}) // insert salary
        .mockResolvedValueOnce({ rows: [{ id: 'leave-type-1', days_per_year: 14 }] }) // active leave types
        .mockRejectedValueOnce(new Error('leave allocation failed'))
        .mockResolvedValueOnce({}); // ROLLBACK

      await expect(employeeService.createEmployee({
        firstName: 'New',
        lastName: 'Employee',
        email: 'new.employee@payrollx.com',
        phone: '+1-555-0202',
        dateOfBirth: '1998-02-25',
        gender: 'male',
        maritalStatus: 'single',
        nationality: 'Pakistani',
        profileImage: '/uploads/profiles/new-employee.png',
        residentialAddress: '123 Main Street',
        departmentId: '879f188f-d4c0-4c2a-9fdd-f6382f6bc18c',
        jobTitle: 'Software Engineer',
        employmentType: 'full_time',
        probationPeriodMonths: 3,
        workLocation: 'Lahore Office',
        reportingTo: '2def08ce-a414-4ad6-9ad5-d4b4a2461460',
        joiningDate: '2026-02-25',
        basicSalary: 120000,
        housingAllowance: 10000,
        transportAllowance: 5000,
        medicalAllowance: 3000,
        utilityAllowance: 2000,
        otherAllowances: 1000,
        bonus: 0,
        overtimeRate: 1200,
        taxInformation: 'Filer',
        providentFundEmployee: 4000,
        providentFundEmployer: 4000,
        bankAccountNumber: 'PK12ABCD123456789',
        bankName: 'HBL',
        bankRoutingCode: 'HBLPKKAXXX',
        paymentMethod: 'bank_transfer',
        legalIdType: 'cnic',
        legalIdNumber: '12345-1234567-1',
        taxIdentifier: 'NTN-12345',
        password: 'CreatedPass123',
      })).rejects.toThrow('leave allocation failed');

      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it('rolls back when a user with email already exists', async () => {
      const client = {
        query: jest.fn(),
        release: jest.fn(),
      };

      db.getClient.mockResolvedValue(client);
      client.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ count: '3' }] }) // employee count
        .mockResolvedValueOnce({ rows: [{ id: 'existing-user' }] }) // existing user check
        .mockResolvedValueOnce({}); // ROLLBACK

      await expect(employeeService.createEmployee({
        firstName: 'Duplicate',
        lastName: 'User',
        email: 'duplicate@payrollx.com',
        phone: '+1-555-9090',
        dateOfBirth: '1995-01-01',
        gender: 'female',
        maritalStatus: 'single',
        nationality: 'Pakistani',
        profileImage: '/uploads/profiles/duplicate.png',
        residentialAddress: '14 Test Street',
        departmentId: '879f188f-d4c0-4c2a-9fdd-f6382f6bc18c',
        jobTitle: 'QA Engineer',
        employmentType: 'full_time',
        probationPeriodMonths: 3,
        workLocation: 'Lahore Office',
        reportingTo: '2def08ce-a414-4ad6-9ad5-d4b4a2461460',
        joiningDate: '2026-02-25',
        basicSalary: 90000,
        bonus: 0,
        overtimeRate: 500,
        taxInformation: 'Non-filer',
        providentFundEmployee: 3000,
        providentFundEmployer: 3000,
        bankAccountNumber: 'PK00XXXX',
        bankName: 'Meezan',
        bankRoutingCode: 'MEZNPKKA',
        paymentMethod: 'bank_transfer',
        legalIdType: 'cnic',
        legalIdNumber: '12345-7654321-1',
        taxIdentifier: 'NTN-55667',
        password: 'CreatedPass123',
      })).rejects.toThrow('A login account with this email already exists');

      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
      expect(client.release).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateEmployee', () => {
    it('keeps the login email in sync when an employee email changes', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 'emp-123', user_id: 'user-123' }],
        })
        .mockResolvedValueOnce({
          rows: [],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'emp-123' }],
        })
        .mockResolvedValueOnce({
          rows: [],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'emp-123', email: 'updated.employee@payrollx.com' }],
        });

      transformEmployee.mockReturnValue({
        id: 'emp-123',
        email: 'updated.employee@payrollx.com',
      });

      const result = await employeeService.updateEmployee('emp-123', {
        email: ' Updated.Employee@PayrollX.com ',
      });

      expect(db.query).toHaveBeenNthCalledWith(
        2,
        'SELECT id FROM users WHERE email = $1 AND id <> $2',
        ['updated.employee@payrollx.com', 'user-123']
      );
      expect(db.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('UPDATE employees'),
        ['updated.employee@payrollx.com', 'emp-123']
      );
      expect(db.query).toHaveBeenNthCalledWith(
        4,
        'UPDATE users SET email = $1 WHERE id = $2',
        ['updated.employee@payrollx.com', 'user-123']
      );
      expect(result.email).toBe('updated.employee@payrollx.com');
    });
  });
});
