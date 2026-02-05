-- Migration: 004_create_salary_structures
-- Create salary structures table

CREATE TABLE salary_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- Basic salary
    basic_salary DECIMAL(15, 2) NOT NULL,

    -- Allowances
    housing_allowance DECIMAL(15, 2) DEFAULT 0,
    transport_allowance DECIMAL(15, 2) DEFAULT 0,
    medical_allowance DECIMAL(15, 2) DEFAULT 0,
    utility_allowance DECIMAL(15, 2) DEFAULT 0,
    other_allowances DECIMAL(15, 2) DEFAULT 0,

    -- Deductions
    eobi_contribution DECIMAL(15, 2) DEFAULT 0,
    sessi_contribution DECIMAL(15, 2) DEFAULT 0,
    loan_deduction DECIMAL(15, 2) DEFAULT 0,
    other_deductions DECIMAL(15, 2) DEFAULT 0,

    -- Calculated fields
    gross_salary DECIMAL(15, 2) GENERATED ALWAYS AS (
        basic_salary + housing_allowance + transport_allowance +
        medical_allowance + utility_allowance + other_allowances
    ) STORED,

    -- Effective dates
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    is_current BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_salary_employee ON salary_structures(employee_id);
CREATE INDEX idx_salary_current ON salary_structures(is_current);
CREATE INDEX idx_salary_effective ON salary_structures(effective_from, effective_to);

-- Trigger for updated_at
CREATE TRIGGER update_salary_structures_updated_at
    BEFORE UPDATE ON salary_structures
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Ensure only one current salary structure per employee
CREATE UNIQUE INDEX idx_salary_unique_current
    ON salary_structures(employee_id)
    WHERE is_current = true;
