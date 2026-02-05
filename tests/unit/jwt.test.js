/**
 * JWT Utility Unit Tests
 */

const {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  verifyAccessToken,
  decodeToken,
  generateTokenPair,
  getRefreshTokenExpiry,
} = require('../../src/utils/jwt');

describe('JWT Utilities', () => {
  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    role: 'employee',
  };

  describe('generateAccessToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateAccessToken({
        userId: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
    });

    it('should include user data in token payload', () => {
      const token = generateAccessToken({
        userId: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });

      const decoded = decodeToken(token);
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.role).toBe(mockUser.role);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a random hex string', () => {
      const token = generateRefreshToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token).toHaveLength(128); // 64 bytes = 128 hex chars
    });

    it('should generate unique tokens', () => {
      const token1 = generateRefreshToken();
      const token2 = generateRefreshToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('hashToken', () => {
    it('should hash token consistently', () => {
      const token = 'test-token-123';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different tokens', () => {
      const hash1 = hashToken('token1');
      const hash2 = hashToken('token2');

      expect(hash1).not.toBe(hash2);
    });

    it('should return a 64 character hex string (SHA-256)', () => {
      const hash = hashToken('test');
      expect(hash).toHaveLength(64);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid token', () => {
      const token = generateAccessToken({
        userId: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });

      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe(mockUser.id);
    });

    it('should throw error for invalid token', () => {
      expect(() => verifyAccessToken('invalid-token')).toThrow();
    });

    it('should throw error with TOKEN_INVALID code for malformed token', () => {
      try {
        verifyAccessToken('invalid.token.here');
      } catch (error) {
        expect(error.code).toBe('TOKEN_INVALID');
      }
    });
  });

  describe('decodeToken', () => {
    it('should decode token without verification', () => {
      const token = generateAccessToken({
        userId: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });

      const decoded = decodeToken(token);
      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(mockUser.id);
    });

    it('should return null for invalid token', () => {
      const decoded = decodeToken('not-a-valid-token');
      expect(decoded).toBeNull();
    });
  });

  describe('generateTokenPair', () => {
    it('should generate both access and refresh tokens', () => {
      const tokens = generateTokenPair(mockUser);

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.accessTokenExpiresIn).toBeDefined();
      expect(tokens.refreshTokenExpiresIn).toBeDefined();
    });

    it('should generate valid access token', () => {
      const tokens = generateTokenPair(mockUser);
      const decoded = verifyAccessToken(tokens.accessToken);

      expect(decoded.userId).toBe(mockUser.id);
    });
  });

  describe('getRefreshTokenExpiry', () => {
    it('should return a future date', () => {
      const expiry = getRefreshTokenExpiry();
      const now = new Date();

      expect(expiry).toBeInstanceOf(Date);
      expect(expiry.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should be approximately 7 days in the future', () => {
      const expiry = getRefreshTokenExpiry();
      const now = new Date();
      const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

      expect(diffDays).toBeCloseTo(7, 0);
    });
  });
});
