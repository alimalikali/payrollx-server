-- Migration: 008_create_payroll_runs
-- Create payroll runs table

CREATE TABLE payroll_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Period
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (
        status IN ('draft', 'processing', 'completed', 'approved', 'paid', 'cancelled')
    ),

    -- Summary totals
    total_employees INTEGER DEFAULT 0,
    total_gross_salary DECIMAL(18, 2) DEFAULT 0,
    total_deductions DECIMAL(18, 2) DEFAULT 0,
    total_tax DECIMAL(18, 2) DEFAULT 0,
    total_net_salary DECIMAL(18, 2) DEFAULT 0,

    -- Processing info
    processed_by UUID REFERENCES users(id),
    processed_at TIMESTAMP,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,

    -- Notes
    notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_payroll_runs_period ON payroll_runs(month, year);
CREATE INDEX idx_payroll_runs_status ON payroll_runs(status);

-- Unique constraint: one payroll run per month per year
CREATE UNIQUE INDEX idx_payroll_runs_unique_period ON payroll_runs(month, year);

-- Trigger for updated_at
CREATE TRIGGER update_payroll_runs_updated_at
    BEFORE UPDATE ON payroll_runs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
