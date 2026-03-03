const { Pool } = require('pg');
const config = require('./index');

// Create connection pool
const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  max: config.db.max,
  idleTimeoutMillis: config.db.idleTimeoutMillis,
  connectionTimeoutMillis: config.db.connectionTimeoutMillis,
});

let schemaCompatibilityPromise = null;

const ensureSchemaCompatibility = async () => {
  if (!schemaCompatibilityPromise) {
    schemaCompatibilityPromise = (async () => {
      // Keep legacy databases compatible with auth queries that require this column.
      await pool.query(`
        ALTER TABLE IF EXISTS users
        ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false
      `);

      // Keep notifications queries stable when an older database is missing table/schema.
      await pool.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(50) NOT NULL CHECK (
            type IN (
              'leave_request_submitted',
              'leave_request_approved',
              'leave_request_rejected',
              'leave_request_cancelled',
              'salary_credited',
              'company_notice'
            )
          ),
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          entity_type VARCHAR(50),
          entity_id UUID,
          is_read BOOLEAN DEFAULT false,
          read_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pool.query(`
        ALTER TABLE IF EXISTS notifications
        ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false
      `);

      await pool.query(`
        ALTER TABLE IF EXISTS notifications
        ADD COLUMN IF NOT EXISTS read_at TIMESTAMP
      `);

      await pool.query(`
        ALTER TABLE IF EXISTS notifications
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);

      await pool.query(`
        ALTER TABLE IF EXISTS notifications
        DROP CONSTRAINT IF EXISTS notifications_type_check
      `);

      await pool.query(`
        ALTER TABLE IF EXISTS notifications
        ADD CONSTRAINT notifications_type_check CHECK (
          type IN (
            'leave_request_submitted',
            'leave_request_approved',
            'leave_request_rejected',
            'leave_request_cancelled',
            'salary_credited',
            'company_notice'
          )
        )
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_notifications_user
        ON notifications(user_id)
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
        ON notifications(user_id, is_read)
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_notifications_created
        ON notifications(created_at)
      `);

      await pool.query(`
        ALTER TABLE IF EXISTS employees
        ADD COLUMN IF NOT EXISTS full_name_display VARCHAR(255),
        ADD COLUMN IF NOT EXISTS nationality VARCHAR(100),
        ADD COLUMN IF NOT EXISTS residential_address TEXT,
        ADD COLUMN IF NOT EXISTS probation_period_months INTEGER,
        ADD COLUMN IF NOT EXISTS work_location VARCHAR(120),
        ADD COLUMN IF NOT EXISTS job_title VARCHAR(120),
        ADD COLUMN IF NOT EXISTS legal_id_type VARCHAR(30),
        ADD COLUMN IF NOT EXISTS legal_id_number VARCHAR(50),
        ADD COLUMN IF NOT EXISTS tax_identifier VARCHAR(30),
        ADD COLUMN IF NOT EXISTS tax_information TEXT,
        ADD COLUMN IF NOT EXISTS bank_routing_code VARCHAR(50)
      `);

      await pool.query(`
        ALTER TABLE IF EXISTS salary_structures
        ADD COLUMN IF NOT EXISTS bonus DECIMAL(15, 2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS overtime_rate DECIMAL(15, 2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS provident_fund_employee DECIMAL(15, 2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS provident_fund_employer DECIMAL(15, 2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'bank_transfer'
      `);
    })().catch((error) => {
      schemaCompatibilityPromise = null;
      throw error;
    });
  }

  return schemaCompatibilityPromise;
};

// Pool error handling
pool.on('error', (err) => {
  console.error('Unexpected error on idle client:', err);
  process.exit(-1);
});

// Test database connection
const testConnection = async () => {
  try {
    await ensureSchemaCompatibility();
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('Database connected successfully at:', result.rows[0].now);
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
};

// Query helper with automatic client management
const query = async (text, params) => {
  const start = Date.now();
  try {
    await ensureSchemaCompatibility();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    if (config.nodeEnv === 'development') {
      console.log('Executed query:', { text: text.substring(0, 100), duration: `${duration}ms`, rows: result.rowCount });
    }

    return result;
  } catch (error) {
    console.error('Query error:', { text: text.substring(0, 100), error: error.message });
    throw error;
  }
};

// Get a client from the pool (for transactions)
const getClient = async () => {
  await ensureSchemaCompatibility();
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  const originalRelease = client.release.bind(client);

  // Track if client has been released
  let released = false;

  // Override release to track state
  client.release = () => {
    if (released) {
      console.warn('Client already released');
      return;
    }
    released = true;
    return originalRelease();
  };

  // Override query for logging in development
  if (config.nodeEnv === 'development') {
    client.query = async (...args) => {
      const start = Date.now();
      const result = await originalQuery(...args);
      const duration = Date.now() - start;
      console.log('Transaction query:', { text: args[0]?.substring?.(0, 100) || args[0], duration: `${duration}ms` });
      return result;
    };
  }

  return client;
};

// Transaction helper
const transaction = async (callback) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  query,
  getClient,
  transaction,
  testConnection,
};
