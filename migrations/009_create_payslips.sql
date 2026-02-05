-- Migration: 009_create_payslips
-- Create payslips table

CREATE TABLE payslips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- Period info
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,

    -- Attendance summary
    working_days INTEGER DEFAULT 0,
    present_days INTEGER DEFAULT 0,
    absent_days INTEGER DEFAULT 0,
    leave_days DECIMAL(4, 1) DEFAULT 0,
    overtime_hours DECIMAL(6, 2) DEFAULT 0,

    -- Earnings
    basic_salary DECIMAL(15, 2) NOT NULL,
    housing_allowance DECIMAL(15, 2) DEFAULT 0,
    transport_allowance DECIMAL(15, 2) DEFAULT 0,
    medical_allowance DECIMAL(15, 2) DEFAULT 0,
    utility_allowance DECIMAL(15, 2) DEFAULT 0,
    other_allowances DECIMAL(15, 2) DEFAULT 0,
    overtime_pay DECIMAL(15, 2) DEFAULT 0,
    bonus DECIMAL(15, 2) DEFAULT 0,

    -- Gross salary
    gross_salary DECIMAL(15, 2) NOT NULL,

    -- Deductions
    income_tax DECIMAL(15, 2) DEFAULT 0,
    eobi_contribution DECIMAL(15, 2) DEFAULT 0,
    sessi_contribution DECIMAL(15, 2) DEFAULT 0,
    loan_deduction DECIMAL(15, 2) DEFAULT 0,
    other_deductions DECIMAL(15, 2) DEFAULT 0,

    -- Total deductions
    total_deductions DECIMAL(15, 2) DEFAULT 0,

    -- Net salary
    net_salary DECIMAL(15, 2) NOT NULL,

    -- Tax details
    taxable_income DECIMAL(15, 2) DEFAULT 0,
    tax_slab VARCHAR(50),
    is_filer BOOLEAN DEFAULT false,

    -- Status
    status VARCHAR(20) DEFAULT 'generated' CHECK (
        status IN ('generated', 'approved', 'paid', 'cancelled')
    ),
    paid_at TIMESTAMP,
    payment_method VARCHAR(50),
    payment_reference VARCHAR(100),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_payslips_payroll_run ON payslips(payroll_run_id);
CREATE INDEX idx_payslips_employee ON payslips(employee_id);
CREATE INDEX idx_payslips_period ON payslips(month, year);
CREATE INDEX idx_payslips_status ON payslips(status);

-- Unique constraint: one payslip per employee per payroll run
CREATE UNIQUE INDEX idx_payslips_unique ON payslips(payroll_run_id, employee_id);

-- Trigger for updated_at
CREATE TRIGGER update_payslips_updated_at
    BEFORE UPDATE ON payslips
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
