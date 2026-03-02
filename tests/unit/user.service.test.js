jest.mock('../../src/config/database', () => ({
  getClient: jest.fn(),
}));

const db = require('../../src/config/database');
const userService = require('../../src/services/user.service');

describe('User Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts admin as a valid target role', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn(),
    };
    db.getClient.mockResolvedValue(client);

    client.query
      .mockResolvedValueOnce()
      .mockResolvedValueOnce({
        rows: [{
          id: 'user-1',
          email: 'person@payrollx.com',
          role: 'employee',
          is_active: true,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 'user-1',
          email: 'person@payrollx.com',
          role: 'admin',
          is_active: true,
        }],
      })
      .mockResolvedValueOnce()
      .mockResolvedValueOnce();

    const result = await userService.assignRole({
      targetUserId: 'user-1',
      newRole: 'admin',
      changedBy: 'admin-1',
      reason: 'Promotion',
    });

    expect(result.role).toBe('admin');
    expect(client.release).toHaveBeenCalled();
  });
});
