-- Migration: 002_create_departments
-- Create departments table

CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(10) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_departments_code ON departments(code);
CREATE INDEX idx_departments_active ON departments(is_active);

-- Trigger for updated_at
CREATE TRIGGER update_departments_updated_at
    BEFORE UPDATE ON departments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Seed default departments
INSERT INTO departments (name, code, description) VALUES
    ('Engineering', 'ENG', 'Software Development and Engineering'),
    ('Human Resources', 'HR', 'Human Resources and People Operations'),
    ('Finance', 'FIN', 'Finance and Accounting'),
    ('Marketing', 'MKT', 'Marketing and Brand Management'),
    ('Quality Assurance', 'QA', 'Quality Assurance and Testing');
