jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../src/utils/jwt', () => ({
  verifyAccessToken: jest.fn(),
}));

const db = require('../../src/config/database');
const { verifyAccessToken } = require('../../src/utils/jwt');
const { protect } = require('../../src/middleware/auth');
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
});
