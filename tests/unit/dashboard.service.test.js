jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
}));

const db = require('../../src/config/database');
const dashboardService = require('../../src/services/dashboard.service');

describe('dashboard.service getHrDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns expanded HR dashboard metrics and action panels', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ total: '48', active: '46' }],
      })
      .mockResolvedValueOnce({
        rows: [{ present: '38', absent: '5', late: '3', total_employees: '46' }],
      })
      .mockResolvedValueOnce({
        rows: [{ pending: '4', approved_this_month: '9' }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'run-last',
            month: 2,
            year: 2026,
            status: 'approved',
            total_employees: 44,
            total_gross_salary: '2800000',
            total_net_salary: '2520000',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ new_alerts: '1', high_risk_alerts: '0', salary_anomalies: '0' }],
      })
      .mockResolvedValueOnce({
        rows: [{ net_salary: '2500000' }],
      })
      .mockResolvedValueOnce({
        rows: [
          { date: '2026-03-01', present: '36', absent: '6', late: '2' },
          { date: '2026-03-02', present: '38', absent: '5', late: '3' },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { department_id: 'dep-1', department_name: 'Engineering', present: '15', absent: '2', late: '1' },
          { department_id: 'dep-2', department_name: 'HR', present: '6', absent: '1', late: '0' },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            total_salary_current_month: '3000000',
            total_deductions: '250000',
            total_bonuses: '80000',
            total_tax: '150000',
            paid_employee_count: '38',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'run-current', month: 3, year: 2026, status: 'draft' }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'leave-1',
            employee_id: 'emp-1',
            employee_name: 'Jane Doe',
            leave_type_name: 'Annual Leave',
            start_date: '2026-03-05',
            end_date: '2026-03-06',
            total_days: '2',
            reason: 'Family trip',
            status: 'pending',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { leave_type_id: 'annual', leave_type_name: 'Annual Leave', request_count: '6' },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            new_employees_this_month: '3',
            employees_on_probation: '5',
            recently_resigned_employees: '1',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            employee_id: 'emp-3',
            employee_name: 'Alex Smith',
            end_date: '2026-03-20',
          },
        ],
      });

    const result = await dashboardService.getHrDashboard();

    expect(result.kpis.totalEmployees).toBe(48);
    expect(result.kpis.presentToday).toBe(38);
    expect(result.attendanceSummary.today.late).toBe(3);
    expect(result.attendanceSummary.lateArrivalsCount).toBe(5);
    expect(result.payrollSummary.currentMonthTotalPayrollCost).toBe(3000000);
    expect(result.payrollSummary.pendingSalaryProcessing).toBe(8);
    expect(result.payrollSummary.currentMonthPayroll).toEqual({
      id: 'run-current',
      month: 3,
      year: 2026,
      status: 'draft',
    });
    expect(result.leaveSummary.approvedThisMonth).toBe(9);
    expect(result.pendingLeaveRequests[0]).toEqual({
      id: 'leave-1',
      employeeId: 'emp-1',
      employeeName: 'Jane Doe',
      leaveTypeName: 'Annual Leave',
      startDate: '2026-03-05',
      endDate: '2026-03-06',
      totalDays: 2,
      reason: 'Family trip',
      status: 'pending',
    });
    expect(result.workforceAlerts).toEqual({
      newEmployeesThisMonth: 3,
      employeesOnProbation: 5,
      recentlyResignedEmployees: 1,
      contractExpiryAlerts: [
        {
          employeeId: 'emp-3',
          employeeName: 'Alex Smith',
          endDate: '2026-03-20',
        },
      ],
    });
  });
});
