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

// Pool error handling
pool.on('error', (err) => {
  console.error('Unexpected error on idle client:', err);
  process.exit(-1);
});

// Test database connection
const testConnection = async () => {
  try {
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
