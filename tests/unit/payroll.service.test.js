jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

const db = require('../../src/config/database');
const payrollService = require('../../src/services/payroll.service');

describe('payroll.service approvePayroll', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('marks payslips as paid and notifies employees when payroll is approved', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn(),
    };

    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce()
      .mockResolvedValueOnce({
        rows: [{ status: 'completed', month: 3, year: 2026 }],
      })
      .mockResolvedValueOnce()
      .mockResolvedValueOnce()
      .mockResolvedValueOnce({
        rows: [
          { user_id: 'user-1', payslip_id: 'payslip-1' },
          { user_id: 'user-2', payslip_id: 'payslip-2' },
        ],
      })
      .mockResolvedValueOnce()
      .mockResolvedValueOnce();
    db.query.mockResolvedValue({
      rows: [
        {
          id: 'run-1',
          month: 3,
          year: 2026,
          status: 'approved',
          total_employees: 2,
          total_gross_salary: 200000,
          total_deductions: 10000,
          total_tax: 7000,
          total_net_salary: 190000,
          processed_by_email: 'hr@payrollx.com',
          processed_at: '2026-03-01T00:00:00.000Z',
          approved_by_email: 'hr@payrollx.com',
          approved_at: '2026-03-02T00:00:00.000Z',
          notes: null,
          created_at: '2026-03-01T00:00:00.000Z',
        },
      ],
    });

    const result = await payrollService.approvePayroll('run-1', 'hr-user-1');

    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      'SELECT status, month, year FROM payroll_runs WHERE id = $1',
      ['run-1']
    );
    expect(client.query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('UPDATE payslips'),
      ['paid', 'run-1']
    );
    expect(client.query).toHaveBeenNthCalledWith(
      6,
      expect.stringContaining('INSERT INTO notifications'),
      [
        'user-1',
        'salary_credited',
        'Salary credited',
        'Your salary for 3/2026 has been credited.',
        'payslip',
        'payslip-1',
        'user-2',
        'salary_credited',
        'Salary credited',
        'Your salary for 3/2026 has been credited.',
        'payslip',
        'payslip-2',
      ]
    );
    expect(client.release).toHaveBeenCalled();
    expect(result.status).toBe('approved');
  });
});
