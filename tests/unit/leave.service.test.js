jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../src/utils/transformers', () => ({
  transformLeaveRequest: jest.fn((row) => row),
  transformLeaveRequestList: jest.fn((rows) => rows),
}));

jest.mock('../../src/services/notification.service', () => ({
  createBulkNotifications: jest.fn(),
  createNotification: jest.fn(),
}));

const db = require('../../src/config/database');
const notificationService = require('../../src/services/notification.service');
const leaveService = require('../../src/services/leave.service');

describe('Leave Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('notifies all privileged users when an employee submits a leave request', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ remaining_days: '10' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'leave-1' }] })
      .mockResolvedValueOnce({
        rows: [{
          first_name: 'Jane',
          last_name: 'Doe',
          leave_type_name: 'Annual Leave',
        }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'hr-1' }, { id: 'admin-1' }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 'leave-1',
          employee_id: 'emp-1',
          leave_type_name: 'Annual Leave',
        }],
      });

    await leaveService.createLeaveRequest({
      employeeId: 'emp-1',
      leaveTypeId: 'type-1',
      startDate: '2026-03-10',
      endDate: '2026-03-10',
      reason: 'Medical appointment',
      requestedByRole: 'employee',
    });

    expect(notificationService.createBulkNotifications).toHaveBeenCalledWith([
      {
        userId: 'hr-1',
        type: 'leave_request_submitted',
        title: 'New leave request',
        message: 'Jane Doe applied for Annual Leave (1 day).',
        entityType: 'leave_request',
        entityId: 'leave-1',
      },
      {
        userId: 'admin-1',
        type: 'leave_request_submitted',
        title: 'New leave request',
        message: 'Jane Doe applied for Annual Leave (1 day).',
        entityType: 'leave_request',
        entityId: 'leave-1',
      },
    ]);
    expect(db.query.mock.calls[4][0]).toContain('WHERE role = ANY($1::text[]) AND is_active = true');
    expect(db.query.mock.calls[4][1]).toEqual([['admin', 'hr']]);
  });

  it('notifies the employee and privileged users when a leave request is approved', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{
          id: 'leave-1',
          status: 'pending',
          user_id: 'user-1',
          first_name: 'Jane',
          last_name: 'Doe',
          leave_type_name: 'Annual Leave',
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'hr-1' }, { id: 'admin-1' }] })
      .mockResolvedValueOnce({
        rows: [{
          id: 'leave-1',
          employee_id: 'emp-1',
          leave_type_name: 'Annual Leave',
          status: 'approved',
        }],
      });

    await leaveService.approveLeaveRequest('leave-1', 'hr-actor');

    expect(notificationService.createNotification).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'leave_request_approved',
      title: 'Leave request approved',
      message: 'Your Annual Leave request has been approved.',
      entityType: 'leave_request',
      entityId: 'leave-1',
    });
    expect(notificationService.createBulkNotifications).toHaveBeenCalledWith([
      {
        userId: 'hr-1',
        type: 'leave_request_approved',
        title: 'Leave request approved',
        message: "Jane Doe's Annual Leave request was approved.",
        entityType: 'leave_request',
        entityId: 'leave-1',
      },
      {
        userId: 'admin-1',
        type: 'leave_request_approved',
        title: 'Leave request approved',
        message: "Jane Doe's Annual Leave request was approved.",
        entityType: 'leave_request',
        entityId: 'leave-1',
      },
    ]);
  });

  it('notifies the employee and privileged users when a leave request is rejected', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{
          id: 'leave-1',
          status: 'pending',
          user_id: 'user-1',
          first_name: 'Jane',
          last_name: 'Doe',
          leave_type_name: 'Annual Leave',
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'hr-1' }, { id: 'admin-1' }] })
      .mockResolvedValueOnce({
        rows: [{
          id: 'leave-1',
          employee_id: 'emp-1',
          leave_type_name: 'Annual Leave',
          status: 'rejected',
        }],
      });

    await leaveService.rejectLeaveRequest('leave-1', 'hr-actor', 'Project deadline');

    expect(notificationService.createNotification).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'leave_request_rejected',
      title: 'Leave request rejected',
      message: 'Your Annual Leave request was rejected. Reason: Project deadline',
      entityType: 'leave_request',
      entityId: 'leave-1',
    });
    expect(notificationService.createBulkNotifications).toHaveBeenCalledWith([
      {
        userId: 'hr-1',
        type: 'leave_request_rejected',
        title: 'Leave request rejected',
        message: "Jane Doe's Annual Leave request was rejected. Reason: Project deadline",
        entityType: 'leave_request',
        entityId: 'leave-1',
      },
      {
        userId: 'admin-1',
        type: 'leave_request_rejected',
        title: 'Leave request rejected',
        message: "Jane Doe's Annual Leave request was rejected. Reason: Project deadline",
        entityType: 'leave_request',
        entityId: 'leave-1',
      },
    ]);
  });

  it('notifies the employee and privileged users when hr cancels a leave request', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{
          id: 'leave-1',
          employee_id: 'emp-1',
          status: 'approved',
          user_id: 'user-1',
          first_name: 'Jane',
          last_name: 'Doe',
          leave_type_name: 'Annual Leave',
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'hr-1' }, { id: 'admin-1' }] })
      .mockResolvedValueOnce({
        rows: [{
          id: 'leave-1',
          employee_id: 'emp-1',
          leave_type_name: 'Annual Leave',
          status: 'cancelled',
        }],
      });

    await leaveService.cancelLeaveRequest('leave-1', 'hr-actor', {
      isEmployee: false,
      employeeId: null,
    });

    expect(notificationService.createNotification).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'leave_request_cancelled',
      title: 'Leave request cancelled',
      message: 'Your Annual Leave request was cancelled.',
      entityType: 'leave_request',
      entityId: 'leave-1',
    });
    expect(notificationService.createBulkNotifications).toHaveBeenCalledWith([
      {
        userId: 'hr-1',
        type: 'leave_request_cancelled',
        title: 'Leave request cancelled',
        message: "Jane Doe's Annual Leave request was cancelled.",
        entityType: 'leave_request',
        entityId: 'leave-1',
      },
      {
        userId: 'admin-1',
        type: 'leave_request_cancelled',
        title: 'Leave request cancelled',
        message: "Jane Doe's Annual Leave request was cancelled.",
        entityType: 'leave_request',
        entityId: 'leave-1',
      },
    ]);
  });
});
