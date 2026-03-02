-- Migration: 018_expand_employee_onboarding
-- Expand employee and salary schema to support full HR onboarding flow

ALTER TABLE employees
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
ADD COLUMN IF NOT EXISTS bank_routing_code VARCHAR(50);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'employees_probation_period_months_check'
  ) THEN
    ALTER TABLE employees
      ADD CONSTRAINT employees_probation_period_months_check
      CHECK (probation_period_months IS NULL OR probation_period_months BETWEEN 0 AND 24);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_legal_id_number
  ON employees(legal_id_number)
  WHERE legal_id_number IS NOT NULL;

ALTER TABLE salary_structures
ADD COLUMN IF NOT EXISTS bonus DECIMAL(15, 2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS overtime_rate DECIMAL(15, 2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS provident_fund_employee DECIMAL(15, 2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS provident_fund_employer DECIMAL(15, 2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'bank_transfer';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'salary_structures_payment_method_check'
  ) THEN
    ALTER TABLE salary_structures
      ADD CONSTRAINT salary_structures_payment_method_check
      CHECK (payment_method IN ('bank_transfer', 'check'));
  END IF;
END $$;
