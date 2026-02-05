require('dotenv').config();

const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'payrollx',
    user: process.env.DB_USER || 'payrollx_user',
    password: process.env.DB_PASSWORD || '',
    max: 10, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },

  // JWT
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'default_access_secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default_refresh_secret',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    refreshExpiryDays: 7,
  },

  // CORS
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000, // 1 minute
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    authMaxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS, 10) || 10,
  },

  // Bcrypt
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,

  // Payroll Constants
  payroll: {
    overtimeThreshold: 8, // hours per day
    overtimeMultiplier: 1.5,
    standardHoursPerDay: 8,
    eobiRate: 0.0075, // 0.75%
    eobiMaxCap: 16.25, // PKR per month
    sessiRate: 0.0075, // 0.75%
    providentFundRate: 0.08, // 8%
    workingDaysPerWeek: 6, // Mon-Sat for Pakistan
  },

  // Leave Allocations (default days per year)
  leave: {
    annual: 15,
    sick: 12,
    casual: 7,
  },
};

// Validate required configuration
const requiredEnvVars = ['DB_PASSWORD', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

if (config.nodeEnv === 'production') {
  requiredEnvVars.forEach((envVar) => {
    if (!process.env[envVar]) {
      console.error(`Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  });
}

module.exports = config;
