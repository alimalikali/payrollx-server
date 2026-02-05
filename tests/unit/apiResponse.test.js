/**
 * API Response Utility Tests
 */

const { success, error, paginated } = require('../../src/utils/apiResponse');

describe('API Response Utilities', () => {
  describe('success', () => {
    it('should create success response with data', () => {
      const data = { id: 1, name: 'Test' };
      const response = success(data);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
    });

    it('should include message if provided', () => {
      const response = success({ id: 1 }, 'Created successfully');

      expect(response.message).toBe('Created successfully');
    });

    it('should include meta if provided', () => {
      const meta = { page: 1, total: 100 };
      const response = success([1, 2, 3], null, meta);

      expect(response.meta).toEqual(meta);
    });

    it('should handle null data', () => {
      const response = success(null, 'Deleted');

      expect(response.success).toBe(true);
      expect(response.data).toBeNull();
    });

    it('should handle array data', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const response = success(data);

      expect(response.data).toEqual(data);
      expect(Array.isArray(response.data)).toBe(true);
    });
  });

  describe('error', () => {
    it('should create error response with message', () => {
      const response = error('Something went wrong');

      expect(response.success).toBe(false);
      expect(response.error.message).toBe('Something went wrong');
    });

    it('should include error code if provided', () => {
      const response = error('Not found', 'NOT_FOUND');

      expect(response.error.code).toBe('NOT_FOUND');
    });

    it('should include details if provided', () => {
      const details = [{ field: 'email', message: 'Invalid' }];
      const response = error('Validation failed', 'VALIDATION_ERROR', details);

      expect(response.error.details).toEqual(details);
    });
  });

  describe('paginated', () => {
    it('should create paginated response', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const response = paginated(data, 1, 10, 100);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.meta.page).toBe(1);
      expect(response.meta.limit).toBe(10);
      expect(response.meta.total).toBe(100);
      expect(response.meta.totalPages).toBe(10);
    });

    it('should calculate total pages correctly', () => {
      const response = paginated([], 1, 10, 25);
      expect(response.meta.totalPages).toBe(3); // ceil(25/10)
    });

    it('should handle zero total', () => {
      const response = paginated([], 1, 10, 0);
      expect(response.meta.totalPages).toBe(0);
    });

    it('should handle single page', () => {
      const response = paginated([1, 2, 3], 1, 10, 3);
      expect(response.meta.totalPages).toBe(1);
    });
  });
});
