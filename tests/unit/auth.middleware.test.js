jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../src/utils/jwt', () => ({
  verifyAccessToken: jest.fn(),
}));

const db = require('../../src/config/database');
const { verifyAccessToken } = require('../../src/utils/jwt');
const { protect, hrOnly, ownerOrHR } = require('../../src/middleware/auth');
const { ForbiddenError } = require('../../src/utils/errors');

const buildRequest = ({ method = 'GET', originalUrl = '/api/v1/employees' } = {}) => ({
  method,
  originalUrl,
  headers: {
    authorization: 'Bearer test-token',
  },
});

describe('Auth Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifyAccessToken.mockReturnValue({
      userId: 'user-1',
      email: 'employee@payrollx.com',
      role: 'employee',
    });
  });

  it('attaches user context when password change is not required', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'user-1',
          email: 'employee@payrollx.com',
          role: 'employee',
          is_active: true,
          must_change_password: false,
          employee_row_id: 'emp-1',
          employee_code: 'EMP0001',
        },
      ],
    });

    const req = buildRequest();
    const next = jest.fn();

    await protect(req, {}, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual({
      id: 'user-1',
      email: 'employee@payrollx.com',
      role: 'employee',
      employeeId: 'emp-1',
      employeeCode: 'EMP0001',
      mustChangePassword: false,
    });
  });

  it('blocks protected routes until password is changed', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'user-1',
          email: 'employee@payrollx.com',
          role: 'employee',
          is_active: true,
          must_change_password: true,
          employee_row_id: 'emp-1',
          employee_code: 'EMP0001',
        },
      ],
    });

    const req = buildRequest({ method: 'GET', originalUrl: '/api/v1/employees' });
    const next = jest.fn();

    await protect(req, {}, next);

    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.message).toBe('You must change your password before continuing');
  });

  it('allows password-change endpoints while password reset is required', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'user-1',
          email: 'employee@payrollx.com',
          role: 'employee',
          is_active: true,
          must_change_password: true,
          employee_row_id: 'emp-1',
          employee_code: 'EMP0001',
        },
      ],
    });

    const req = buildRequest({ method: 'POST', originalUrl: '/api/v1/auth/change-password' });
    const next = jest.fn();

    await protect(req, {}, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user.mustChangePassword).toBe(true);
  });

  it('allows admin users through hrOnly middleware', () => {
    const req = { user: { role: 'admin' } };
    const next = jest.fn();

    hrOnly(req, {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('still blocks employee users from hrOnly middleware', () => {
    const req = { user: { role: 'employee' } };
    const next = jest.fn();

    hrOnly(req, {}, next);

    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.message).toBe('You do not have permission to perform this action');
  });

  it('allows admin users to access ownerOrHR protected resources', () => {
    const req = {
      user: { id: 'admin-1', role: 'admin', employeeId: null },
      params: { employeeId: 'emp-99' },
    };
    const next = jest.fn();

    ownerOrHR('employeeId')(req, {}, next);

    expect(next).toHaveBeenCalledWith();
  });
});
