/**
 * Error Classes Unit Tests
 */

const {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
} = require('../../src/utils/errors');

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create error with message and status code', () => {
      const error = new AppError('Test error', 400);

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.status).toBe('fail');
      expect(error.isOperational).toBe(true);
    });

    it('should set status to "error" for 5xx codes', () => {
      const error = new AppError('Server error', 500);
      expect(error.status).toBe('error');
    });

    it('should capture stack trace', () => {
      const error = new AppError('Test', 400);
      expect(error.stack).toBeDefined();
    });
  });

  describe('BadRequestError', () => {
    it('should create 400 error', () => {
      const error = new BadRequestError('Bad request');

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Bad request');
    });

    it('should use default message if none provided', () => {
      const error = new BadRequestError();
      expect(error.message).toBe('Bad request');
    });

    it('should include validation details if provided', () => {
      const details = [{ field: 'email', message: 'Invalid email' }];
      const error = new BadRequestError('Validation failed', details);

      expect(error.details).toEqual(details);
    });
  });

  describe('UnauthorizedError', () => {
    it('should create 401 error', () => {
      const error = new UnauthorizedError('Unauthorized');

      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Unauthorized');
    });

    it('should use default message', () => {
      const error = new UnauthorizedError();
      expect(error.message).toBe('Unauthorized');
    });
  });

  describe('ForbiddenError', () => {
    it('should create 403 error', () => {
      const error = new ForbiddenError('Forbidden');

      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Forbidden');
    });
  });

  describe('NotFoundError', () => {
    it('should create 404 error', () => {
      const error = new NotFoundError('Not found');

      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Not found');
    });

    it('should use default message', () => {
      const error = new NotFoundError();
      expect(error.message).toBe('Resource not found');
    });
  });

  describe('ValidationError', () => {
    it('should create 422 error', () => {
      const error = new ValidationError('Validation error');

      expect(error.statusCode).toBe(422);
      expect(error.message).toBe('Validation error');
    });

    it('should include validation errors array', () => {
      const errors = [
        { field: 'email', message: 'Required' },
        { field: 'password', message: 'Too short' },
      ];
      const error = new ValidationError('Validation failed', errors);

      expect(error.errors).toEqual(errors);
    });
  });

  describe('ConflictError', () => {
    it('should create 409 error', () => {
      const error = new ConflictError('Conflict');

      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('Conflict');
    });
  });

  describe('Error inheritance', () => {
    it('all custom errors should be instances of AppError', () => {
      expect(new BadRequestError()).toBeInstanceOf(AppError);
      expect(new UnauthorizedError()).toBeInstanceOf(AppError);
      expect(new ForbiddenError()).toBeInstanceOf(AppError);
      expect(new NotFoundError()).toBeInstanceOf(AppError);
      expect(new ValidationError()).toBeInstanceOf(AppError);
      expect(new ConflictError()).toBeInstanceOf(AppError);
    });

    it('all custom errors should be instances of Error', () => {
      expect(new BadRequestError()).toBeInstanceOf(Error);
      expect(new AppError('test', 500)).toBeInstanceOf(Error);
    });
  });
});
