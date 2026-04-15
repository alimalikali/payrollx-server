/**
 * Fraud Detection Test Seed
 * Inserts targeted data to trigger all 10 fraud detection algorithms.
 * Safe to re-run — uses ON CONFLICT DO NOTHING / DO UPDATE.
 *
 * Run: node seeds/fraud-test-seed.js
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

// ─── helpers ──────────────────────────────────────────────────────────────────

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

const TODAY = new Date().toISOString().split('T')[0];
const YEAR  = new Date().getFullYear();
const MONTH = new Date().getMonth() + 1; // 1-12

// "3 months ago" month/year (for payroll-on-leave scenario)
const threeMonthsAgo = new Date();
threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 2);
const PREV_MONTH = threeMonthsAgo.getMonth() + 1;
const PREV_YEAR  = threeMonthsAgo.getFullYear();

// Last month (for duplicate-payment and payroll scenarios)
const lastMonthDate = new Date();
lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
const LAST_MONTH = lastMonthDate.getMonth() + 1;
const LAST_YEAR  = lastMonthDate.getFullYear();

async function seed() {
  const client = await pool.connect();
  console.log('\n====================================================');
  console.log('  PayrollX — Fraud Detection Test Seeder');
  console.log('====================================================\n');

  try {
    await client.query('BEGIN');

    // ── 0. Resolve dependencies ──────────────────────────────────────────────

    // Get HR user id (for approvals / payroll runs)
    const hrRow = await client.query(
      `SELECT id FROM users WHERE email = 'hr@payrollx.com' LIMIT 1`
    );
    if (hrRow.rows.length === 0) {
      throw new Error('HR user not found. Run main seed first: npm run db:seed');
    }
    const hrUserId = hrRow.rows[0].id;

    // Get department IDs
    const deptRows = await client.query('SELECT id, code FROM departments');
    if (deptRows.rows.length === 0) {
      throw new Error('No departments found. Run main seed / migrations first.');
    }
    const depts = {};
    for (const r of deptRows.rows) depts[r.code] = r.id;
    const engDeptId = depts['ENG'] || deptRows.rows[0].id;
    const finDeptId = depts['FIN'] || deptRows.rows[0].id;

    // Get Sick Leave type id
    const sickLeaveRow = await client.query(
      `SELECT id FROM leave_types WHERE code = 'SL' LIMIT 1`
    );
    if (sickLeaveRow.rows.length === 0) {
      throw new Error('Sick Leave type not found. Run migrations first.');
    }
    const sickLeaveTypeId = sickLeaveRow.rows[0].id;

    const empPassword = await bcrypt.hash('Employee@123', 10);

    // ── helper: upsert a test employee ──────────────────────────────────────
    async function createEmployee({ code, firstName, lastName, email, deptId, designation, joiningDate, bankAccount, bankName }) {
      const userRow = await client.query(`
        INSERT INTO users (email, password_hash, role, must_change_password)
        VALUES ($1, $2, 'employee', false)
        ON CONFLICT (email) DO UPDATE SET password_hash = $2
        RETURNING id
      `, [email, empPassword]);
      const userId = userRow.rows[0].id;

      const empRow = await client.query(`
        INSERT INTO employees (
          user_id, employee_id, first_name, last_name, email,
          department_id, designation, employment_type,
          joining_date, tax_filing_status, status,
          bank_name, bank_account_number
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,'full_time',$8,'non_filer','active',$9,$10)
        ON CONFLICT (employee_id) DO UPDATE SET
          first_name = $3, last_name = $4,
          bank_name = $9, bank_account_number = $10,
          joining_date = $8
        RETURNING id
      `, [userId, code, firstName, lastName, email, deptId, designation, joiningDate, bankName || null, bankAccount || null]);

      return empRow.rows[0].id;
    }

    // ── helper: create salary structure ─────────────────────────────────────
    async function createSalaryStructure(empId, basic, effectiveFrom, effectiveTo = null) {
      await client.query(`
        INSERT INTO salary_structures (
          employee_id, basic_salary, housing_allowance, transport_allowance,
          medical_allowance, effective_from, effective_to, is_current
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        ON CONFLICT DO NOTHING
      `, [empId, basic, basic * 0.2, basic * 0.1, basic * 0.05, effectiveFrom, effectiveTo]);
    }

    // ── helper: create payroll run (ignores duplicate month/year) ────────────
    async function getOrCreatePayrollRun(month, year, status = 'completed') {
      const periodStart = `${year}-${String(month).padStart(2,'0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const periodEnd = `${year}-${String(month).padStart(2,'0')}-${lastDay}`;

      const existing = await client.query(
        `SELECT id FROM payroll_runs WHERE month=$1 AND year=$2`, [month, year]
      );
      if (existing.rows.length > 0) return existing.rows[0].id;

      const row = await client.query(`
        INSERT INTO payroll_runs (month, year, period_start, period_end, status, processed_by, processed_at)
        VALUES ($1,$2,$3,$4,$5,$6,NOW())
        RETURNING id
      `, [month, year, periodStart, periodEnd, status, hrUserId]);
      return row.rows[0].id;
    }

    // ── helper: insert payslip (ignores unique-key conflicts) ────────────────
    async function insertPayslip(payrollRunId, empId, month, year, gross, net) {
      await client.query(`
        INSERT INTO payslips (
          payroll_run_id, employee_id, month, year,
          working_days, present_days, absent_days,
          basic_salary, gross_salary, net_salary,
          income_tax, total_deductions, status
        ) VALUES ($1,$2,$3,$4,22,20,2,$5,$6,$7,$8,$8,'paid')
        ON CONFLICT (payroll_run_id, employee_id) DO UPDATE SET
          net_salary = $7, gross_salary = $6, month = $3, year = $4
      `, [payrollRunId, empId, month, year, gross * 0.6, gross, net, gross - net]);
    }

    // ════════════════════════════════════════════════════════════════════════
    // SCENARIO 1 — Duplicate Bank Account (Algorithm 1)
    // Two employees share the same bank account number → severity: CRITICAL
    // ════════════════════════════════════════════════════════════════════════
    console.log('→ Scenario 1: Duplicate Bank Account...');
    const sharedAccount = 'PK36HABB0000000013010139';
    await createEmployee({
      code: 'FRD0001', firstName: 'Omar', lastName: 'Shaikh',
      email: 'omar.shaikh.test@payrollx.com', deptId: finDeptId,
      designation: 'Accountant', joiningDate: '2024-01-15',
      bankAccount: sharedAccount, bankName: 'HBL',
    });
    await createEmployee({
      code: 'FRD0002', firstName: 'Hamza', lastName: 'Shaikh',
      email: 'hamza.shaikh.test@payrollx.com', deptId: finDeptId,
      designation: 'Finance Executive', joiningDate: '2024-03-01',
      bankAccount: sharedAccount, bankName: 'HBL',
    });
    console.log('  ✓ Two employees with shared bank account: ' + sharedAccount);

    // ════════════════════════════════════════════════════════════════════════
    // SCENARIO 2 — Salary Spike > 50% (Algorithm 2)
    // Employee salary jumped from 100k to 220k gross (120% spike)
    // ════════════════════════════════════════════════════════════════════════
    console.log('→ Scenario 2: Salary Spike...');
    const spikEmpId = await createEmployee({
      code: 'FRD0003', firstName: 'Rana', lastName: 'Imtiaz',
      email: 'rana.imtiaz.test@payrollx.com', deptId: engDeptId,
      designation: 'Developer', joiningDate: '2023-06-01',
    });
    // First (lower) salary — 6 months ago
    await client.query(`
      INSERT INTO salary_structures (employee_id, basic_salary, housing_allowance, transport_allowance, medical_allowance, effective_from, is_current)
      VALUES ($1, 60000, 20000, 10000, 10000, $2, false)
      ON CONFLICT DO NOTHING
    `, [spikEmpId, addDays(TODAY, -180)]);
    // Spiked salary — 1 month ago (gross ≈ 240,000 — 140% jump)
    await client.query(`
      INSERT INTO salary_structures (employee_id, basic_salary, housing_allowance, transport_allowance, medical_allowance, effective_from, is_current)
      VALUES ($1, 140000, 46667, 23333, 23333, $2, true)
      ON CONFLICT DO NOTHING
    `, [spikEmpId, addDays(TODAY, -30)]);
    console.log('  ✓ Salary spike: PKR 100,000 → PKR 233,333 gross');

    // ════════════════════════════════════════════════════════════════════════
    // SCENARIO 3 — Ghost Employee (Algorithm 3)
    // Active employee with NO attendance records at all
    // ════════════════════════════════════════════════════════════════════════
    console.log('→ Scenario 3: Ghost Employee...');
    const ghostEmpId = await createEmployee({
      code: 'FRD0004', firstName: 'Sameer', lastName: 'Ghous',
      email: 'sameer.ghous.test@payrollx.com', deptId: finDeptId,
      designation: 'Analyst', joiningDate: '2024-06-01',
    });
    await createSalaryStructure(ghostEmpId, 80000, '2024-06-01');
    // Intentionally NO attendance inserted
    console.log('  ✓ Ghost employee created with zero attendance records');

    // ════════════════════════════════════════════════════════════════════════
    // SCENARIO 4 — Excessive Overtime (Algorithm 4)
    // Employee logs 100+ overtime hours in current month
    // ════════════════════════════════════════════════════════════════════════
    console.log('→ Scenario 4: Excessive Overtime...');
    const otEmpId = await createEmployee({
      code: 'FRD0005', firstName: 'Nabeel', lastName: 'Qureshi',
      email: 'nabeel.qureshi.test@payrollx.com', deptId: engDeptId,
      designation: 'Senior Developer', joiningDate: '2023-09-01',
    });
    await createSalaryStructure(otEmpId, 90000, '2023-09-01');
    // Insert current-month attendance with 5 OT hours/day for ~22 working days = ~110 hours
    const otStart = new Date(YEAR, MONTH - 1, 1);
    const otEnd   = new Date();
    for (let d = new Date(otStart); d <= otEnd; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue;
      const dateStr = d.toISOString().split('T')[0];
      await client.query(`
        INSERT INTO attendance (employee_id, date, check_in, check_out, status, overtime_hours)
        VALUES ($1,$2,'08:00:00','22:00:00','present',5)
        ON CONFLICT (employee_id, date) DO UPDATE SET overtime_hours = 5
      `, [otEmpId, dateStr]);
    }
    console.log('  ✓ Excessive overtime: ~5 OT hrs/day across current month');

    // ════════════════════════════════════════════════════════════════════════
    // SCENARIO 5 — Duplicate Payment (Algorithm 5)
    // Same employee has payslips with identical month/year in 2 different payroll runs
    // ════════════════════════════════════════════════════════════════════════
    console.log('→ Scenario 5: Duplicate Payment...');
    const dupEmpId = await createEmployee({
      code: 'FRD0006', firstName: 'Dawood', lastName: 'Baig',
      email: 'dawood.baig.test@payrollx.com', deptId: finDeptId,
      designation: 'Finance Executive', joiningDate: '2023-11-01',
    });
    await createSalaryStructure(dupEmpId, 70000, '2023-11-01');
    // Create two payroll runs for different actual months
    const dupRunA = await getOrCreatePayrollRun(LAST_MONTH, LAST_YEAR, 'paid');
    const dupRunB = await getOrCreatePayrollRun(MONTH, YEAR, 'completed');
    // Both payslips say month=LAST_MONTH, year=LAST_YEAR (duplicate!)
    await insertPayslip(dupRunA, dupEmpId, LAST_MONTH, LAST_YEAR, 140000, 120000);
    // Force second payslip with same month/year in second run
    await client.query(`
      INSERT INTO payslips (
        payroll_run_id, employee_id, month, year,
        working_days, present_days, absent_days,
        basic_salary, gross_salary, net_salary,
        income_tax, total_deductions, status
      ) VALUES ($1,$2,$3,$4,22,22,0,$5,$6,$7,$8,$8,'paid')
      ON CONFLICT (payroll_run_id, employee_id) DO UPDATE SET
        month = $3, year = $4, net_salary = $7
    `, [dupRunB, dupEmpId, LAST_MONTH, LAST_YEAR, 84000, 140000, 120000, 20000]);
    console.log(`  ✓ Duplicate payment: Dawood paid twice for ${LAST_MONTH}/${LAST_YEAR}`);

    // ════════════════════════════════════════════════════════════════════════
    // SCENARIO 6 — Round-Trip Salary Manipulation (Algorithm 6)
    // Salary spiked 35% then quietly reverted to near original
    // ════════════════════════════════════════════════════════════════════════
    console.log('→ Scenario 6: Round-Trip Salary...');
    const rtEmpId = await createEmployee({
      code: 'FRD0007', firstName: 'Khalid', lastName: 'Mehmood',
      email: 'khalid.mehmood.test@payrollx.com', deptId: engDeptId,
      designation: 'Backend Developer', joiningDate: '2023-04-01',
    });
    // Original: gross = 150,000
    await client.query(`
      INSERT INTO salary_structures (employee_id, basic_salary, housing_allowance, transport_allowance, medical_allowance, effective_from, is_current)
      VALUES ($1, 90000, 30000, 15000, 15000, $2, false)
      ON CONFLICT DO NOTHING
    `, [rtEmpId, addDays(TODAY, -270)]);
    // Spike: gross ≈ 202,500 (+35%)
    await client.query(`
      INSERT INTO salary_structures (employee_id, basic_salary, housing_allowance, transport_allowance, medical_allowance, effective_from, is_current)
      VALUES ($1, 121500, 40500, 20250, 20250, $2, false)
      ON CONFLICT DO NOTHING
    `, [rtEmpId, addDays(TODAY, -180)]);
    // Revert: gross ≈ 153,000 (back to within 2% of original 150k)
    await client.query(`
      INSERT INTO salary_structures (employee_id, basic_salary, housing_allowance, transport_allowance, medical_allowance, effective_from, is_current)
      VALUES ($1, 91800, 30600, 15300, 15300, $2, true)
      ON CONFLICT DO NOTHING
    `, [rtEmpId, addDays(TODAY, -90)]);
    console.log('  ✓ Round-trip: 150k → 202.5k → 153k (reverted within 2%)');

    // ════════════════════════════════════════════════════════════════════════
    // SCENARIO 7 — Payroll on Full-Leave Month (Algorithm 7)
    // Employee on approved leave entire month but received full salary
    // ════════════════════════════════════════════════════════════════════════
    console.log('→ Scenario 7: Payroll on Full-Leave Month...');
    const leaveEmpId = await createEmployee({
      code: 'FRD0008', firstName: 'Nadia', lastName: 'Farooq',
      email: 'nadia.farooq.test@payrollx.com', deptId: finDeptId,
      designation: 'Finance Manager', joiningDate: '2023-02-01',
    });
    await createSalaryStructure(leaveEmpId, 100000, '2023-02-01');
    // Create approved leave covering all of PREV_MONTH
    const prevMonthStart = `${PREV_YEAR}-${String(PREV_MONTH).padStart(2,'0')}-01`;
    const prevMonthLastDay = new Date(PREV_YEAR, PREV_MONTH, 0).getDate();
    const prevMonthEnd = `${PREV_YEAR}-${String(PREV_MONTH).padStart(2,'0')}-${prevMonthLastDay}`;
    const totalDays = prevMonthLastDay;
    await client.query(`
      INSERT INTO leave_requests (
        employee_id, leave_type_id, start_date, end_date, total_days,
        status, approved_by, approved_at, reason
      ) VALUES ($1,$2,$3,$4,$5,'approved',$6,NOW(),'Extended medical treatment')
      ON CONFLICT DO NOTHING
    `, [leaveEmpId, sickLeaveTypeId, prevMonthStart, prevMonthEnd, totalDays, hrUserId]);
    // Create payroll run for PREV_MONTH (if not exists) and payslip
    const prevRunId = await getOrCreatePayrollRun(PREV_MONTH, PREV_YEAR, 'paid');
    await insertPayslip(prevRunId, leaveEmpId, PREV_MONTH, PREV_YEAR, 165000, 140000);
    console.log(`  ✓ Nadia on full approved leave for ${PREV_MONTH}/${PREV_YEAR} but paid PKR 140,000`);

    // ════════════════════════════════════════════════════════════════════════
    // SCENARIO 8 — Suspicious Hire + Immediate Payroll (Algorithm 8)
    // Employee hired 5 days ago, already has a payslip, no attendance
    // ════════════════════════════════════════════════════════════════════════
    console.log('→ Scenario 8: Suspicious Hire...');
    const recentHireDate = addDays(TODAY, -5);
    const newHireEmpId = await createEmployee({
      code: 'FRD0009', firstName: 'Jawad', lastName: 'Abbasi',
      email: 'jawad.abbasi.test@payrollx.com', deptId: engDeptId,
      designation: 'Junior Developer', joiningDate: recentHireDate,
    });
    await createSalaryStructure(newHireEmpId, 60000, recentHireDate);
    const currentRunId = await getOrCreatePayrollRun(MONTH, YEAR, 'completed');
    await insertPayslip(currentRunId, newHireEmpId, MONTH, YEAR, 100000, 85000);
    // No attendance records for this employee (intentional)
    console.log(`  ✓ Jawad hired ${recentHireDate} (5 days ago), already paid, zero attendance`);

    // ════════════════════════════════════════════════════════════════════════
    // SCENARIO 9 — Sick Leave Abuse / Z-score > 3 (Algorithm 9)
    // One ENG employee took 28 sick days vs dept average of ~2
    // ════════════════════════════════════════════════════════════════════════
    console.log('→ Scenario 9: Sick Leave Abuse...');

    // Create 4 ENG employees for department baseline (including the abuser)
    const sick1Id = await createEmployee({
      code: 'FRD0010', firstName: 'Bilal', lastName: 'Siddiqui',
      email: 'bilal.siddiqui.test@payrollx.com', deptId: engDeptId,
      designation: 'Software Engineer', joiningDate: '2023-07-01',
    });
    const sick2Id = await createEmployee({
      code: 'FRD0011', firstName: 'Hira', lastName: 'Noor',
      email: 'hira.noor.test@payrollx.com', deptId: engDeptId,
      designation: 'Software Engineer', joiningDate: '2023-08-01',
    });
    const sick3Id = await createEmployee({
      code: 'FRD0012', firstName: 'Zafar', lastName: 'Iqbal',
      email: 'zafar.iqbal.test@payrollx.com', deptId: engDeptId,
      designation: 'Software Engineer', joiningDate: '2023-09-15',
    });
    const sickAbuseId = await createEmployee({
      code: 'FRD0013', firstName: 'Tariq', lastName: 'Pervez',
      email: 'tariq.pervez.test@payrollx.com', deptId: engDeptId,
      designation: 'Software Engineer', joiningDate: '2023-10-01',
    });

    // Helper: create sick leave
    async function createSickLeave(empId, startDate, days) {
      const endDate = addDays(startDate, days - 1);
      await client.query(`
        INSERT INTO leave_requests (
          employee_id, leave_type_id, start_date, end_date, total_days,
          status, approved_by, approved_at, reason
        ) VALUES ($1,$2,$3,$4,$5,'approved',$6,NOW(),'Medical reason')
        ON CONFLICT DO NOTHING
      `, [empId, sickLeaveTypeId, startDate, endDate, days, hrUserId]);
    }

    const sixMonthsAgo = addDays(TODAY, -180);
    // Normal sick leave for baseline employees
    await createSickLeave(sick1Id, addDays(sixMonthsAgo, 10), 2);
    await createSickLeave(sick2Id, addDays(sixMonthsAgo, 20), 3);
    await createSickLeave(sick3Id, addDays(sixMonthsAgo, 30), 2);
    // Abuser: 28 sick days in 6 months (vs avg ~2.3)
    await createSickLeave(sickAbuseId, addDays(sixMonthsAgo, 5),  7);
    await createSickLeave(sickAbuseId, addDays(sixMonthsAgo, 40), 7);
    await createSickLeave(sickAbuseId, addDays(sixMonthsAgo, 80), 7);
    await createSickLeave(sickAbuseId, addDays(sixMonthsAgo, 120), 7);
    console.log('  ✓ Sick leave: dept avg ~2 days, Tariq Pervez took 28 days (Z > 3)');

    // ════════════════════════════════════════════════════════════════════════
    // SCENARIO 10 — Overtime on Absent Days (Algorithm 10)
    // Attendance rows with status='absent' but overtime_hours > 0
    // ════════════════════════════════════════════════════════════════════════
    console.log('→ Scenario 10: Overtime on Absent Days...');
    const otAbsEmpId = await createEmployee({
      code: 'FRD0014', firstName: 'Waseem', lastName: 'Aktar',
      email: 'waseem.aktar.test@payrollx.com', deptId: finDeptId,
      designation: 'Auditor', joiningDate: '2023-05-01',
    });
    await createSalaryStructure(otAbsEmpId, 75000, '2023-05-01');
    // 8 absent days with overtime hours in the past 90 days
    const absenceDates = [-5, -12, -18, -25, -31, -38, -44, -50];
    for (const offset of absenceDates) {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      if (d.getDay() === 0 || d.getDay() === 6) continue; // skip weekends
      const dateStr = d.toISOString().split('T')[0];
      await client.query(`
        INSERT INTO attendance (employee_id, date, check_in, check_out, status, overtime_hours)
        VALUES ($1,$2,NULL,NULL,'absent',4)
        ON CONFLICT (employee_id, date) DO UPDATE SET status='absent', overtime_hours=4, check_in=NULL, check_out=NULL
      `, [otAbsEmpId, dateStr]);
    }
    console.log('  ✓ Waseem: 8 absent days with 4 OT hours each = 32 false OT hours');

    // ────────────────────────────────────────────────────────────────────────
    // Add normal attendance for scenario employees so dashboard doesn't crash
    // ────────────────────────────────────────────────────────────────────────
    console.log('→ Adding normal attendance records for other test employees...');
    const normalEmpIds = [spikEmpId, dupEmpId, rtEmpId, leaveEmpId,
                          sick1Id, sick2Id, sick3Id, sickAbuseId];
    const attendStart = new Date(YEAR, MONTH - 1, 1);
    const attendEnd   = new Date();
    for (const empId of normalEmpIds) {
      for (let d = new Date(attendStart); d <= attendEnd; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === 0 || d.getDay() === 6) continue;
        const dateStr = d.toISOString().split('T')[0];
        await client.query(`
          INSERT INTO attendance (employee_id, date, check_in, check_out, status, overtime_hours)
          VALUES ($1,$2,'09:00:00','18:00:00','present',0)
          ON CONFLICT (employee_id, date) DO NOTHING
        `, [empId, dateStr]);
      }
    }
    console.log('  ✓ Normal attendance added');

    // ─── leave allocations for all test employees ────────────────────────────
    const allTestEmpIds = [
      spikEmpId, ghostEmpId, otEmpId, dupEmpId, rtEmpId,
      leaveEmpId, newHireEmpId, sick1Id, sick2Id, sick3Id,
      sickAbuseId, otAbsEmpId,
    ];
    const leaveTypesResult = await client.query('SELECT id, days_per_year FROM leave_types');
    for (const empId of allTestEmpIds) {
      for (const lt of leaveTypesResult.rows) {
        await client.query(`
          INSERT INTO leave_allocations (employee_id, leave_type_id, year, allocated_days)
          VALUES ($1,$2,$3,$4)
          ON CONFLICT DO NOTHING
        `, [empId, lt.id, YEAR, lt.days_per_year]);
      }
    }
    console.log('  ✓ Leave allocations set for all test employees');


    await client.query('COMMIT');

    console.log('\n====================================================');
    console.log('  ✓ Fraud test data seeded successfully!');
    console.log('====================================================');
    console.log('\n  Scenarios ready to detect:');
    console.log('  ─────────────────────────────────────────────────');
    console.log('  1. Duplicate Bank Account   → Omar & Hamza Shaikh (HBL shared account)');
    console.log('  2. Salary Spike             → Rana Imtiaz (100k → 233k gross, +133%)');
    console.log('  3. Ghost Employee           → Sameer Ghous (zero attendance)');
    console.log('  4. Excessive Overtime       → Nabeel Qureshi (5 OT hrs/day, ~110 hrs/month)');
    console.log('  5. Duplicate Payment        → Dawood Baig (paid twice for same month)');
    console.log('  6. Round-Trip Salary        → Khalid Mehmood (150k→202k→153k)');
    console.log(`  7. Payroll on Full Leave    → Nadia Farooq (full leave ${PREV_MONTH}/${PREV_YEAR}, got PKR 140k)`);
    console.log(`  8. Suspicious Hire          → Jawad Abbasi (hired ${addDays(TODAY,-5)}, already paid)`);
    console.log('  9. Sick Leave Abuse         → Tariq Pervez (28 sick days vs dept avg 2)');
    console.log('  10. OT on Absent Days       → Waseem Aktar (32 false OT hours on absent days)');
    console.log('\n  Now go to /hr/ai-insights and click "Run Fraud Detection"');
    console.log('====================================================\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n✗ Fraud seed failed:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
