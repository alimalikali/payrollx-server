/**
 * Auth Integration Tests
 * Note: These tests require a test database connection
 * Run with: npm test -- --testPathPattern=auth.test.js
 */

const request = require('supertest');
const app = require('../../src/app');

// Mock database for integration tests
jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(() => ({
    query: jest.fn(),
    release: jest.fn(),
  })),
  testConnection: jest.fn(() => Promise.resolve(true)),
}));

const db = require('../../src/config/database');

describe('Auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/auth/login', () => {
    it('should return 400 for missing email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for missing password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'invalid-email', password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 for non-existent user', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // No user found
      db.query.mockResolvedValueOnce({ rows: [] }); // Security log

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'password123' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('should return 400 for weak password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'weak', // Too short, no uppercase, no number
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid-email',
          password: 'ValidPass123',
        });

      expect(response.status).toBe(400);
    });

    it('should validate password requirements', async () => {
      // No uppercase
      let response = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'test@example.com', password: 'password123' });
      expect(response.status).toBe(400);

      // No lowercase
      response = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'test@example.com', password: 'PASSWORD123' });
      expect(response.status).toBe(400);

      // No number
      response = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'test@example.com', password: 'Passworddd' });
      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return 401 without auth token', async () => {
      const response = await request(app).get('/api/v1/auth/me');

      expect(response.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .send({
          currentPassword: 'OldPass123',
          newPassword: 'NewPass123',
        });

      expect(response.status).toBe(401);
    });

    it('should return 400 for weak new password', async () => {
      // Generate a valid token for this test
      const { generateAccessToken } = require('../../src/utils/jwt');
      const token = generateAccessToken({
        userId: 'test-user-id',
        email: 'test@example.com',
        role: 'employee',
      });

      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'OldPass123',
          newPassword: 'weak',
        });

      expect(response.status).toBe(400);
    });
  });
});
