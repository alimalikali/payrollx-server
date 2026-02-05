/**
 * Migration Runner Script
 * Runs SQL migrations in order
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'payrollx',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

// Migration tracking table
const CREATE_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

async function runMigrations() {
  const client = await pool.connect();

  try {
    console.log('\n========================================');
    console.log('  PayrollX Database Migration Runner');
    console.log('========================================\n');

    // Create migrations tracking table
    await client.query(CREATE_MIGRATIONS_TABLE);
    console.log('✓ Migration tracking table ready\n');

    // Get list of executed migrations
    const { rows: executed } = await client.query(
      'SELECT name FROM migrations ORDER BY id'
    );
    const executedNames = new Set(executed.map((r) => r.name));

    // Get all migration files
    const migrationsDir = __dirname;
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migration files\n`);

    let newMigrations = 0;

    for (const file of files) {
      if (executedNames.has(file)) {
        console.log(`⊘ ${file} (already executed)`);
        continue;
      }

      console.log(`→ Running ${file}...`);

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`  ✓ ${file} completed`);
        newMigrations++;
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`  ✗ ${file} failed:`, error.message);
        throw error;
      }
    }

    console.log('\n========================================');
    if (newMigrations > 0) {
      console.log(`  ✓ ${newMigrations} new migration(s) executed`);
    } else {
      console.log('  ✓ Database is up to date');
    }
    console.log('========================================\n');
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migrations
runMigrations().catch((error) => {
  console.error('\nMigration failed:', error.message);
  process.exit(1);
});
