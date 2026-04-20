/**
 * Comprehensive Seed Script
 * Seeds: notices, public holidays, payroll runs+payslips, attendance for today,
 * leave requests (variety of statuses), settings, notifications
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'payrollx',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

async function seed() {
  const client = await pool.connect();

  try {
    console.log('\n========================================');
    console.log('  PayrollX Comprehensive Seeder');
    console.log('========================================\n');

    await client.query('BEGIN');

    // Get existing data
    const employeesResult = await client.query(`
      SELECT e.id, e.user_id, e.first_name, e.last_name, e.email
      FROM employees e
      WHERE e.employee_id LIKE 'EMP%'
      ORDER BY e.employee_id
    `);
    const employees = employeesResult.rows;

    const hrResult = await client.query(`SELECT id FROM users WHERE email = 'hr@payrollx.com'`);
    const hrUserId = hrResult.rows[0].id;

    const leaveTypesResult = await client.query('SELECT id, code FROM leave_types');
    const leaveTypes = {};
    for (const lt of leaveTypesResult.rows) {
      leaveTypes[lt.code] = lt.id;
    }

    // ─── 1. Public Holidays ───────────────────────────────────────────────────
    console.log('→ Seeding public holidays...');
    const holidays = [
      { name: 'Pakistan Day', date: '2026-03-23', description: 'National holiday celebrating the Lahore Resolution' },
      { name: 'Labour Day', date: '2026-05-01', description: 'International Workers Day' },
      { name: 'Independence Day', date: '2026-08-14', description: 'Pakistan Independence Day' },
      { name: 'Iqbal Day', date: '2026-11-09', description: "Allama Iqbal's birthday" },
      { name: 'Quaid-e-Azam Day', date: '2026-12-25', description: "Muhammad Ali Jinnah's birthday" },
      { name: 'New Year Day', date: '2026-01-01', description: 'New Year celebration' },
      { name: 'Kashmir Day', date: '2026-02-05', description: 'Solidarity Day with Kashmir' },
      { name: 'Eid ul Fitr', date: '2026-03-30', description: 'Eid ul Fitr (estimated)', is_optional: false },
      { name: 'Eid ul Fitr Holiday', date: '2026-03-31', description: 'Eid ul Fitr holiday', is_optional: false },
      { name: 'Eid ul Adha', date: '2026-06-07', description: 'Eid ul Adha (estimated)', is_optional: false },
      { name: 'Eid ul Adha Holiday', date: '2026-06-08', description: 'Eid ul Adha holiday', is_optional: false },
      { name: 'Ashura', date: '2026-07-06', description: 'Ashura holiday', is_optional: false },
    ];

    for (const h of holidays) {
      const hYear = parseInt(h.date.split('-')[0]);
      await client.query(`
        INSERT INTO public_holidays (name, date, year, description, is_optional)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (date) DO NOTHING
      `, [h.name, h.date, hYear, h.description, h.is_optional || false]);
    }
    console.log(`  ✓ ${holidays.length} public holidays seeded`);

    // ─── 2. Notices ───────────────────────────────────────────────────────────
    console.log('→ Seeding notices...');
    const notices = [
      {
        title: 'Q1 2026 Payroll Processed Successfully',
        content: 'We are pleased to inform all employees that the Q1 2026 payroll has been processed successfully. Salaries have been credited to your registered bank accounts. Please check your payslips in the system for detailed breakdown.',
        priority: 'high',
        category: 'payroll',
        is_pinned: true,
        expires_at: null,
      },
      {
        title: 'Eid ul Fitr 2026 Office Closure',
        content: 'The office will remain closed from March 30 to April 1, 2026 on the occasion of Eid ul Fitr. Wishing all employees and their families a blessed Eid Mubarak!',
        priority: 'urgent',
        category: 'holiday',
        is_pinned: true,
        expires_at: '2026-04-01',
      },
      {
        title: 'Updated Leave Policy - Effective April 2026',
        content: `Dear Team,\n\nPlease be informed that the company leave policy has been updated effective April 1, 2026. Key changes include:\n\n1. Casual leave increased from 10 to 12 days per year\n2. Medical leave now requires a medical certificate for absences exceeding 3 consecutive days\n3. Leave carry-forward limit remains at 7 days\n\nPlease review the full policy document on the HR portal.`,
        priority: 'high',
        category: 'policy',
        is_pinned: false,
        expires_at: null,
      },
      {
        title: 'New Employee Onboarding - April 2026',
        content: 'Please join us in welcoming our new team members joining in April 2026. An orientation session will be held on April 21, 2026 at 10:00 AM in the main conference room. All department heads are requested to introduce their new team members.',
        priority: 'medium',
        category: 'general',
        is_pinned: false,
        expires_at: '2026-04-25',
      },
      {
        title: 'Annual Performance Review Cycle - April 2026',
        content: 'The annual performance review cycle for FY 2025-2026 is now open. All employees should complete their self-assessments by April 30, 2026. Managers are required to complete performance evaluations by May 15, 2026. Please log in to the HR system to begin your self-assessment.',
        priority: 'high',
        category: 'general',
        is_pinned: false,
        expires_at: '2026-05-15',
      },
      {
        title: 'Q2 2026 Company Town Hall Meeting',
        content: 'The Q2 2026 Town Hall meeting is scheduled for April 25, 2026 at 3:00 PM. All employees are encouraged to attend. The CEO will share company updates, Q1 performance results, and strategic plans for the rest of the year. Submit your questions in advance via the HR portal.',
        priority: 'medium',
        category: 'event',
        is_pinned: false,
        expires_at: '2026-04-25',
      },
      {
        title: 'IT Security Reminder - Password Policy',
        content: 'As part of our security compliance, all employees are reminded to update their passwords every 90 days. Passwords must be at least 8 characters long and include uppercase, lowercase, numbers, and special characters. Please update your system passwords if not done recently.',
        priority: 'medium',
        category: 'policy',
        is_pinned: false,
        expires_at: null,
      },
      {
        title: 'Remote Work Policy Update',
        content: 'Effective May 1, 2026, the company is implementing a hybrid work policy. Employees may work remotely up to 2 days per week, subject to manager approval and departmental requirements. Please coordinate with your respective managers to schedule remote work days.',
        priority: 'low',
        category: 'policy',
        is_pinned: false,
        expires_at: null,
      },
    ];

    for (const notice of notices) {
      await client.query(`
        INSERT INTO notices (title, content, priority, category, is_pinned, expires_at, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT DO NOTHING
      `, [notice.title, notice.content, notice.priority, notice.category, notice.is_pinned, notice.expires_at, hrUserId]);
    }
    console.log(`  ✓ ${notices.length} notices seeded`);

    // ─── 3. Payroll Runs + Payslips ───────────────────────────────────────────
    console.log('→ Seeding payroll runs and payslips...');
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    // Process last 3 months + current month
    const months = [];
    for (let i = 3; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - 1 - i, 1);
      months.push({ month: d.getMonth() + 1, year: d.getFullYear() });
    }

    // Get salary structures
    const salaryResult = await client.query(`
      SELECT ss.employee_id, ss.basic_salary, ss.housing_allowance, ss.transport_allowance, ss.medical_allowance
      FROM salary_structures ss
      INNER JOIN employees e ON ss.employee_id = e.id
      WHERE e.employee_id LIKE 'EMP%'
      ORDER BY ss.effective_from DESC
    `);

    const salaryMap = {};
    for (const row of salaryResult.rows) {
      if (!salaryMap[row.employee_id]) {
        salaryMap[row.employee_id] = row;
      }
    }

    for (const { month, year } of months) {
      const periodStart = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const periodEnd = new Date(year, month, 0).toISOString().split('T')[0];
      const isCurrentMonth = month === currentMonth && year === currentYear;
      const status = isCurrentMonth ? 'approved' : 'paid';

      // Check if payroll run exists
      const existingRun = await client.query(
        'SELECT id FROM payroll_runs WHERE month = $1 AND year = $2',
        [month, year]
      );

      let payrollRunId;
      if (existingRun.rows.length > 0) {
        payrollRunId = existingRun.rows[0].id;
      } else {
        let totalGross = 0;
        let totalDeductions = 0;
        let totalTax = 0;
        let totalNet = 0;

        for (const emp of employees) {
          const salary = salaryMap[emp.id];
          if (!salary) continue;

          const gross = parseFloat(salary.basic_salary) + parseFloat(salary.housing_allowance) +
            parseFloat(salary.transport_allowance) + parseFloat(salary.medical_allowance);
          const tax = gross * 0.1;
          const deductions = tax;
          const net = gross - deductions;

          totalGross += gross;
          totalDeductions += deductions;
          totalTax += tax;
          totalNet += net;
        }

        const runResult = await client.query(`
          INSERT INTO payroll_runs (month, year, period_start, period_end, status, total_employees,
            total_gross_salary, total_deductions, total_tax, total_net_salary, processed_by, processed_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
          RETURNING id
        `, [month, year, periodStart, periodEnd, status, employees.length,
          totalGross, totalDeductions, totalTax, totalNet, hrUserId]);

        payrollRunId = runResult.rows[0].id;
      }

      // Create payslips for all EMP employees
      for (const emp of employees) {
        const salary = salaryMap[emp.id];
        if (!salary) continue;

        const existing = await client.query(
          'SELECT id FROM payslips WHERE employee_id = $1 AND month = $2 AND year = $3',
          [emp.id, month, year]
        );
        if (existing.rows.length > 0) continue;

        const basicSalary = parseFloat(salary.basic_salary);
        const housingAllowance = parseFloat(salary.housing_allowance);
        const transportAllowance = parseFloat(salary.transport_allowance);
        const medicalAllowance = parseFloat(salary.medical_allowance);
        const grossSalary = basicSalary + housingAllowance + transportAllowance + medicalAllowance;
        const incomeTax = grossSalary * 0.1;
        const totalDeductions = incomeTax;
        const netSalary = grossSalary - totalDeductions;

        await client.query(`
          INSERT INTO payslips (payroll_run_id, employee_id, month, year,
            basic_salary, housing_allowance, transport_allowance, medical_allowance,
            gross_salary, income_tax, total_deductions, net_salary,
            working_days, present_days, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT DO NOTHING
        `, [payrollRunId, emp.id, month, year,
          basicSalary, housingAllowance, transportAllowance, medicalAllowance,
          grossSalary, incomeTax, totalDeductions, netSalary,
          22, 20, 'paid']);
      }
    }
    console.log(`  ✓ Payroll runs and payslips seeded for ${months.length} months`);

    // ─── 4. Today's Attendance ────────────────────────────────────────────────
    console.log("→ Seeding today's attendance...");
    const todayStr = today.toISOString().split('T')[0];

    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      // ~80% present, ~10% late, ~10% absent
      const rand = Math.random();
      let status, checkIn, checkOut;

      if (rand < 0.1) {
        status = 'absent';
        checkIn = null;
        checkOut = null;
      } else if (rand < 0.25) {
        status = 'late';
        checkIn = `09:${String(10 + Math.floor(Math.random() * 50)).padStart(2, '0')}:00`;
        checkOut = null; // Still in office
      } else {
        status = 'present';
        checkIn = `0${8 + Math.floor(Math.random() * 2)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00`;
        checkOut = null; // Still in office
      }

      await client.query(`
        INSERT INTO attendance (employee_id, date, check_in, check_out, status)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (employee_id, date) DO UPDATE SET
          check_in = EXCLUDED.check_in,
          check_out = EXCLUDED.check_out,
          status = EXCLUDED.status
      `, [emp.id, todayStr, checkIn, checkOut, status]);
    }
    console.log(`  ✓ Today's attendance seeded for ${employees.length} employees`);

    // ─── 5. Leave Requests (variety of statuses) ─────────────────────────────
    console.log('→ Seeding leave requests...');
    const leaveScenarios = [
      { empIdx: 0, typeCode: 'AL', start: '2026-04-21', end: '2026-04-23', status: 'pending', reason: 'Family function' },
      { empIdx: 1, typeCode: 'CL', start: '2026-04-22', end: '2026-04-22', status: 'pending', reason: 'Personal work' },
      { empIdx: 2, typeCode: 'ML', start: '2026-04-14', end: '2026-04-16', status: 'approved', reason: 'Dental procedure', approvedBy: hrUserId },
      { empIdx: 3, typeCode: 'AL', start: '2026-04-07', end: '2026-04-11', status: 'approved', reason: 'Annual vacation', approvedBy: hrUserId },
      { empIdx: 4, typeCode: 'CL', start: '2026-03-25', end: '2026-03-25', status: 'rejected', reason: 'Personal errand', rejectedBy: hrUserId, rejectionReason: 'Critical project deadline' },
      { empIdx: 5, typeCode: 'AL', start: '2026-05-05', end: '2026-05-09', status: 'pending', reason: 'Travel plans' },
      { empIdx: 6, typeCode: 'ML', start: '2026-04-17', end: '2026-04-17', status: 'approved', reason: 'Flu', approvedBy: hrUserId },
      { empIdx: 7, typeCode: 'CL', start: '2026-04-28', end: '2026-04-29', status: 'pending', reason: 'Personal matter' },
      { empIdx: 0, typeCode: 'CL', start: '2026-03-10', end: '2026-03-10', status: 'approved', reason: 'Bank appointment', approvedBy: hrUserId },
      { empIdx: 2, typeCode: 'AL', start: '2026-02-17', end: '2026-02-21', status: 'approved', reason: 'Winter vacation', approvedBy: hrUserId },
    ];

    for (const scenario of leaveScenarios) {
      if (scenario.empIdx >= employees.length) continue;
      const emp = employees[scenario.empIdx];
      const leaveTypeId = leaveTypes[scenario.typeCode];
      if (!leaveTypeId) continue;

      const start = new Date(scenario.start);
      const end = new Date(scenario.end);
      const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;

      await client.query(`
        INSERT INTO leave_requests (
          employee_id, leave_type_id, start_date, end_date, total_days,
          reason, status, approved_by, rejection_reason
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT DO NOTHING
      `, [
        emp.id, leaveTypeId, scenario.start, scenario.end, days,
        scenario.reason, scenario.status,
        scenario.approvedBy || null,
        scenario.rejectionReason || null,
      ]);
    }
    console.log(`  ✓ ${leaveScenarios.length} leave requests seeded`);

    // ─── 6. Notifications ─────────────────────────────────────────────────────
    console.log('→ Seeding notifications...');
    const pendingLeaves = await client.query(`
      SELECT lr.id as leave_id, e.user_id
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      WHERE lr.status = 'pending'
      LIMIT 5
    `);

    for (const row of pendingLeaves.rows) {
      await client.query(`
        INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id, is_read)
        VALUES ($1, 'leave_request_submitted', 'New Leave Request', 'An employee has submitted a leave request pending your approval.', 'leave_request', $2, false)
        ON CONFLICT DO NOTHING
      `, [hrUserId, row.leave_id]);
    }

    // Salary credited notifications for employees
    for (let i = 0; i < Math.min(employees.length, 5); i++) {
      const emp = employees[i];
      await client.query(`
        INSERT INTO notifications (user_id, type, title, message, entity_type, is_read)
        VALUES ($1, 'salary_credited', 'Salary Credited', 'Your salary for March 2026 has been credited to your bank account.', 'payslip', false)
        ON CONFLICT DO NOTHING
      `, [emp.user_id]);
    }
    console.log('  ✓ Notifications seeded');

    await client.query('COMMIT');

    console.log('\n========================================');
    console.log('  ✓ Comprehensive seed complete!');
    console.log('========================================');
    console.log('  Seeded:');
    console.log('  • Public holidays');
    console.log('  • Notices (8 announcements)');
    console.log('  • Payroll runs + payslips (4 months)');
    console.log("  • Today's attendance");
    console.log('  • Leave requests (various statuses)');
    console.log('  • Notifications');
    console.log('========================================\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n✗ Seed failed:', error.message);
    console.error(error.stack);
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
