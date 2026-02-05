/**
 * Database Seed Script
 * Creates initial data for development and testing
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'payrollx',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

const SALT_ROUNDS = 12;

async function seed() {
  const client = await pool.connect();

  try {
    console.log('\n========================================');
    console.log('  PayrollX Database Seeder');
    console.log('========================================\n');

    await client.query('BEGIN');

    // 1. Create admin user
    console.log('→ Creating admin user...');
    const adminPassword = await bcrypt.hash('Admin@123', SALT_ROUNDS);
    const adminResult = await client.query(`
      INSERT INTO users (email, password_hash, role)
      VALUES ('admin@payrollx.com', $1, 'admin')
      ON CONFLICT (email) DO UPDATE SET password_hash = $1
      RETURNING id
    `, [adminPassword]);
    const adminId = adminResult.rows[0].id;
    console.log('  ✓ Admin user created (admin@payrollx.com / Admin@123)');

    // 2. Create HR user
    console.log('→ Creating HR user...');
    const hrPassword = await bcrypt.hash('Hr@123456', SALT_ROUNDS);
    const hrResult = await client.query(`
      INSERT INTO users (email, password_hash, role)
      VALUES ('hr@payrollx.com', $1, 'hr')
      ON CONFLICT (email) DO UPDATE SET password_hash = $1
      RETURNING id
    `, [hrPassword]);
    const hrId = hrResult.rows[0].id;
    console.log('  ✓ HR user created (hr@payrollx.com / Hr@123456)');

    // 3. Get departments
    console.log('→ Fetching departments...');
    const deptResult = await client.query('SELECT id, code FROM departments');
    const departments = {};
    for (const row of deptResult.rows) {
      departments[row.code] = row.id;
    }
    console.log(`  ✓ Found ${Object.keys(departments).length} departments`);

    // 4. Create sample employees
    console.log('→ Creating sample employees...');
    const employees = [
      { firstName: 'Ahmad', lastName: 'Khan', email: 'ahmad.khan@payrollx.com', dept: 'ENG', designation: 'Senior Software Engineer', salary: 250000 },
      { firstName: 'Fatima', lastName: 'Ali', email: 'fatima.ali@payrollx.com', dept: 'ENG', designation: 'Software Engineer', salary: 150000 },
      { firstName: 'Muhammad', lastName: 'Hassan', email: 'm.hassan@payrollx.com', dept: 'ENG', designation: 'Tech Lead', salary: 350000 },
      { firstName: 'Ayesha', lastName: 'Bibi', email: 'ayesha.bibi@payrollx.com', dept: 'HR', designation: 'HR Manager', salary: 180000 },
      { firstName: 'Usman', lastName: 'Malik', email: 'usman.malik@payrollx.com', dept: 'FIN', designation: 'Finance Manager', salary: 220000 },
      { firstName: 'Sara', lastName: 'Ahmed', email: 'sara.ahmed@payrollx.com', dept: 'MKT', designation: 'Marketing Manager', salary: 200000 },
      { firstName: 'Ali', lastName: 'Raza', email: 'ali.raza@payrollx.com', dept: 'QA', designation: 'QA Engineer', salary: 120000 },
      { firstName: 'Zainab', lastName: 'Hussain', email: 'zainab.h@payrollx.com', dept: 'ENG', designation: 'UI/UX Designer', salary: 140000 },
    ];

    const employeeIds = [];
    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      const empCode = `EMP${String(i + 1).padStart(4, '0')}`;
      const joiningDate = new Date(2023, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);

      // Create employee user
      const userPassword = await bcrypt.hash('Employee@123', SALT_ROUNDS);
      const userResult = await client.query(`
        INSERT INTO users (email, password_hash, role)
        VALUES ($1, $2, 'employee')
        ON CONFLICT (email) DO UPDATE SET password_hash = $2
        RETURNING id
      `, [emp.email, userPassword]);

      // Create employee
      const empResult = await client.query(`
        INSERT INTO employees (
          user_id, employee_id, first_name, last_name, email, department_id,
          designation, employment_type, joining_date, tax_filing_status, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'full_time', $8, $9, 'active')
        ON CONFLICT (employee_id) DO UPDATE SET
          first_name = $3, last_name = $4
        RETURNING id
      `, [
        userResult.rows[0].id,
        empCode,
        emp.firstName,
        emp.lastName,
        emp.email,
        departments[emp.dept],
        emp.designation,
        joiningDate.toISOString().split('T')[0],
        Math.random() > 0.5 ? 'filer' : 'non_filer',
      ]);

      const employeeId = empResult.rows[0].id;
      employeeIds.push(employeeId);

      // Create salary structure
      const basicSalary = emp.salary * 0.6;
      const housingAllowance = emp.salary * 0.2;
      const transportAllowance = emp.salary * 0.1;
      const medicalAllowance = emp.salary * 0.1;

      await client.query(`
        INSERT INTO salary_structures (
          employee_id, basic_salary, housing_allowance, transport_allowance,
          medical_allowance, effective_from
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
      `, [employeeId, basicSalary, housingAllowance, transportAllowance, medicalAllowance, joiningDate.toISOString().split('T')[0]]);
    }
    console.log(`  ✓ Created ${employees.length} employees`);

    // 5. Create leave allocations
    console.log('→ Creating leave allocations...');
    const leaveTypesResult = await client.query('SELECT id, days_per_year FROM leave_types');
    const currentYear = new Date().getFullYear();

    for (const employeeId of employeeIds) {
      for (const leaveType of leaveTypesResult.rows) {
        await client.query(`
          INSERT INTO leave_allocations (employee_id, leave_type_id, year, allocated_days)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT DO NOTHING
        `, [employeeId, leaveType.id, currentYear, leaveType.days_per_year]);
      }
    }
    console.log(`  ✓ Leave allocations created for ${currentYear}`);

    // 6. Create sample attendance for current month
    console.log('→ Creating sample attendance...');
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    for (const employeeId of employeeIds) {
      let current = new Date(startOfMonth);
      while (current <= today) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip weekends
          const status = Math.random() > 0.1 ? (Math.random() > 0.2 ? 'present' : 'late') : 'absent';
          const checkIn = status !== 'absent' ? `0${8 + Math.floor(Math.random() * 2)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00` : null;
          const checkOut = status !== 'absent' ? `${17 + Math.floor(Math.random() * 3)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00` : null;

          await client.query(`
            INSERT INTO attendance (employee_id, date, check_in, check_out, status)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT DO NOTHING
          `, [employeeId, current.toISOString().split('T')[0], checkIn, checkOut, status]);
        }
        current.setDate(current.getDate() + 1);
      }
    }
    console.log('  ✓ Sample attendance created');

    await client.query('COMMIT');

    console.log('\n========================================');
    console.log('  ✓ Database seeded successfully!');
    console.log('========================================');
    console.log('\n  Test Accounts:');
    console.log('  ─────────────────────────────────────');
    console.log('  Admin:    admin@payrollx.com / Admin@123');
    console.log('  HR:       hr@payrollx.com / Hr@123456');
    console.log('  Employee: ahmad.khan@payrollx.com / Employee@123');
    console.log('\n========================================\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n✗ Seeding failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
