jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'family-123'),
}));

jest.mock('../../src/utils/jwt', () => ({
  hashToken: jest.fn(() => 'hashed-refresh-token'),
  generateTokenPair: jest.fn(() => ({
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    accessTokenExpiresIn: '15m',
    refreshTokenExpiresIn: '7d',
  })),
  getRefreshTokenExpiry: jest.fn(() => new Date('2026-03-07T00:00:00.000Z')),
}));

jest.mock('../../src/domain/permissions', () => ({
  getPermissionsForRole: jest.fn(() => ['employee:self']),
}));

const db = require('../../src/config/database');
const bcrypt = require('bcryptjs');
const authService = require('../../src/services/auth.service');

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('accepts a valid password when the login form submits accidental outer spaces', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'user-123',
            email: 'new.employee@payrollx.com',
            password_hash: 'stored-hash',
            role: 'employee',
            is_active: true,
            must_change_password: false,
          }],
        })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      bcrypt.compare
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const result = await authService.login({
        email: 'New.Employee@PayrollX.com',
        password: '  Password123  ',
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      });

      expect(result.user.email).toBe('new.employee@payrollx.com');
      expect(result.tokens.accessToken).toBe('access-token');
      expect(bcrypt.compare).toHaveBeenNthCalledWith(1, '  Password123  ', 'stored-hash');
      expect(bcrypt.compare).toHaveBeenNthCalledWith(2, 'Password123', 'stored-hash');
      expect(db.query).toHaveBeenNthCalledWith(
        1,
        'SELECT id, email, password_hash, role, is_active, must_change_password FROM users WHERE email = $1',
        ['new.employee@payrollx.com']
      );
    });
  });

  describe('changePassword', () => {
    it('stores the trimmed new password hash to avoid invisible whitespace login issues', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ password_hash: 'stored-hash' }],
        })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      bcrypt.compare.mockResolvedValueOnce(true);
      bcrypt.hash.mockResolvedValueOnce('new-password-hash');

      await authService.changePassword({
        userId: 'user-123',
        currentPassword: 'CurrentPass123',
        newPassword: '  NewPass123  ',
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('NewPass123', 12);
      expect(db.query).toHaveBeenNthCalledWith(
        2,
        'UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2',
        ['new-password-hash', 'user-123']
      );
    });
  });
});
