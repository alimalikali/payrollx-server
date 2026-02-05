-- Migration: 003_create_employees
-- Create employees table

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    employee_id VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    cnic VARCHAR(15) UNIQUE,
    date_of_birth DATE,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    marital_status VARCHAR(20) CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed')),
    address TEXT,
    city VARCHAR(100),

    -- Employment details
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    designation VARCHAR(100),
    employment_type VARCHAR(20) DEFAULT 'full_time' CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'intern')),
    joining_date DATE NOT NULL,
    end_date DATE,
    reporting_to UUID REFERENCES employees(id) ON DELETE SET NULL,

    -- Bank details
    bank_name VARCHAR(100),
    bank_account_number VARCHAR(50),
    bank_branch VARCHAR(100),

    -- Tax details
    ntn_number VARCHAR(20),
    tax_filing_status VARCHAR(20) DEFAULT 'non_filer' CHECK (tax_filing_status IN ('filer', 'non_filer')),

    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated', 'on_leave')),
    profile_image VARCHAR(500),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_employees_employee_id ON employees(employee_id);
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_employees_department ON employees(department_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_user_id ON employees(user_id);
CREATE INDEX idx_employees_cnic ON employees(cnic);

-- Trigger for updated_at
CREATE TRIGGER update_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
