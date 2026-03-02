jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../src/utils/dateTime', () => ({
  formatLocalDate: jest.fn(() => '2026-03-03'),
  formatLocalTime: jest.fn(() => '00:30:15'),
}));

jest.mock('../../src/utils/transformers', () => ({
  transformAttendance: jest.fn((row) => row),
  transformAttendanceList: jest.fn((rows) => rows),
}));

const db = require('../../src/config/database');
const attendanceService = require('../../src/services/attendance.service');
const { formatLocalDate, formatLocalTime } = require('../../src/utils/dateTime');

describe('Attendance Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the local date and time helpers when checking in', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'attendance-1' }] })
      .mockResolvedValueOnce({
        rows: [{
          id: 'attendance-1',
          employee_id: 'employee-1',
          date: '2026-03-03',
          check_in: '00:30:15',
          status: 'present',
        }],
      });

    const result = await attendanceService.checkIn({
      employeeId: 'employee-1',
      checkInLocation: 'HQ',
      markedBy: 'user-1',
    });

    expect(formatLocalDate).toHaveBeenCalled();
    expect(formatLocalTime).toHaveBeenCalled();
    expect(db.query).toHaveBeenNthCalledWith(
      1,
      'SELECT id, check_in FROM attendance WHERE employee_id = $1 AND date = $2',
      ['employee-1', '2026-03-03']
    );
    expect(db.query).toHaveBeenNthCalledWith(
      2,
      `INSERT INTO attendance (employee_id, date, check_in, status, check_in_location, marked_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
      ['employee-1', '2026-03-03', '00:30:15', 'present', 'HQ', 'user-1']
    );
    expect(result.check_in).toBe('00:30:15');
  });
});
