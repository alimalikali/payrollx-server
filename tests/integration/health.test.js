/**
 * Health Check Integration Tests
 */

const request = require('supertest');
const app = require('../../src/app');

describe('Health Check API', () => {
  describe('GET /health', () => {
    it('should return 200 OK', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return status ok', async () => {
      const response = await request(app).get('/health');

      expect(response.body.data.status).toBe('ok');
    });

    it('should return timestamp', async () => {
      const response = await request(app).get('/health');

      expect(response.body.data.timestamp).toBeDefined();
      expect(new Date(response.body.data.timestamp)).toBeInstanceOf(Date);
    });

    it('should return environment', async () => {
      const response = await request(app).get('/health');

      expect(response.body.data.environment).toBeDefined();
    });
  });

  describe('GET /api/v1', () => {
    it('should return API info', async () => {
      const response = await request(app).get('/api/v1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('PayrollX API');
      expect(response.body.data.version).toBe('1.0.0');
    });

    it('should list available endpoints', async () => {
      const response = await request(app).get('/api/v1');

      expect(response.body.data.endpoints).toBeDefined();
      expect(response.body.data.endpoints.auth).toBe('/api/v1/auth');
      expect(response.body.data.endpoints.employees).toBe('/api/v1/employees');
      expect(response.body.data.endpoints.attendance).toBe('/api/v1/attendance');
      expect(response.body.data.endpoints.leaves).toBe('/api/v1/leaves');
      expect(response.body.data.endpoints.payroll).toBe('/api/v1/payroll');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/api/v1/unknown-route');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return proper error message', async () => {
      const response = await request(app).get('/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });
  });
});
