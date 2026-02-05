/**
 * Data Transformer Tests
 */

const {
  transformEmployee,
  transformEmployeeList,
  transformAttendance,
  transformLeaveRequest,
  snakeToCamel,
  camelToSnake,
} = require('../../src/utils/transformers');

describe('Data Transformers', () => {
  describe('snakeToCamel', () => {
    it('should convert snake_case to camelCase', () => {
      expect(snakeToCamel('first_name')).toBe('firstName');
      expect(snakeToCamel('created_at')).toBe('createdAt');
      expect(snakeToCamel('is_active')).toBe('isActive');
    });

    it('should handle single word', () => {
      expect(snakeToCamel('name')).toBe('name');
    });

    it('should handle multiple underscores', () => {
      expect(snakeToCamel('user_profile_image')).toBe('userProfileImage');
    });
  });

  describe('camelToSnake', () => {
    it('should convert camelCase to snake_case', () => {
      expect(camelToSnake('firstName')).toBe('first_name');
      expect(camelToSnake('createdAt')).toBe('created_at');
      expect(camelToSnake('isActive')).toBe('is_active');
    });

    it('should handle single word', () => {
      expect(camelToSnake('name')).toBe('name');
    });

    it('should handle consecutive capitals', () => {
      expect(camelToSnake('userID')).toBe('user_id');
    });
  });

  describe('transformEmployee', () => {
    it('should transform employee from DB format to API format', () => {
      const dbEmployee = {
        id: '123',
        employee_id: 'EMP001',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        department_id: 'dept-123',
        department_name: 'Engineering',
        department_code: 'ENG',
        designation: 'Developer',
        employment_type: 'full_time',
        joining_date: '2023-01-15',
        status: 'active',
        tax_filing_status: 'filer',
        basic_salary: '100000',
        gross_salary: '150000',
        created_at: '2023-01-15T00:00:00Z',
      };

      const result = transformEmployee(dbEmployee);

      expect(result.id).toBe('123');
      expect(result.employeeId).toBe('EMP001');
      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
      expect(result.departmentName).toBe('Engineering');
      expect(result.employmentType).toBe('full_time');
      expect(result.taxFilingStatus).toBe('filer');
      expect(result.basicSalary).toBe(100000);
      expect(result.grossSalary).toBe(150000);
    });

    it('should handle null values', () => {
      const dbEmployee = {
        id: '123',
        employee_id: 'EMP001',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: null,
        department_id: null,
        department_name: null,
      };

      const result = transformEmployee(dbEmployee);

      expect(result.phone).toBeNull();
      expect(result.departmentId).toBeNull();
    });
  });

  describe('transformEmployeeList', () => {
    it('should transform array of employees', () => {
      const employees = [
        { id: '1', first_name: 'John', last_name: 'Doe' },
        { id: '2', first_name: 'Jane', last_name: 'Doe' },
      ];

      const result = transformEmployeeList(employees);

      expect(result).toHaveLength(2);
      expect(result[0].firstName).toBe('John');
      expect(result[1].firstName).toBe('Jane');
    });

    it('should handle empty array', () => {
      const result = transformEmployeeList([]);
      expect(result).toEqual([]);
    });
  });

  describe('transformAttendance', () => {
    it('should transform attendance record', () => {
      const dbAttendance = {
        id: '123',
        employee_id: 'emp-123',
        first_name: 'John',
        last_name: 'Doe',
        emp_code: 'EMP001',
        date: '2024-01-15',
        check_in: '09:00:00',
        check_out: '18:00:00',
        working_hours: '8.5',
        overtime_hours: '0.5',
        status: 'present',
      };

      const result = transformAttendance(dbAttendance);

      expect(result.employeeId).toBe('emp-123');
      expect(result.employeeName).toBe('John Doe');
      expect(result.employeeCode).toBe('EMP001');
      expect(result.checkIn).toBe('09:00:00');
      expect(result.workingHours).toBe(8.5);
      expect(result.overtimeHours).toBe(0.5);
    });
  });

  describe('transformLeaveRequest', () => {
    it('should transform leave request', () => {
      const dbLeave = {
        id: '123',
        employee_id: 'emp-123',
        first_name: 'John',
        last_name: 'Doe',
        leave_type_name: 'Annual Leave',
        leave_type_code: 'AL',
        is_paid: true,
        start_date: '2024-01-15',
        end_date: '2024-01-17',
        total_days: '3',
        status: 'pending',
        reason: 'Vacation',
      };

      const result = transformLeaveRequest(dbLeave);

      expect(result.employeeName).toBe('John Doe');
      expect(result.leaveTypeName).toBe('Annual Leave');
      expect(result.leaveTypeCode).toBe('AL');
      expect(result.isPaid).toBe(true);
      expect(result.totalDays).toBe(3);
      expect(result.status).toBe('pending');
    });
  });
});
