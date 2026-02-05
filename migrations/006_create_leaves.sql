-- Migration: 006_create_leaves
-- Create leave types and leave requests tables

-- Leave types table
CREATE TABLE leave_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    code VARCHAR(10) NOT NULL UNIQUE,
    description TEXT,
    days_per_year INTEGER NOT NULL DEFAULT 0,
    is_paid BOOLEAN DEFAULT true,
    is_carry_forward BOOLEAN DEFAULT false,
    max_carry_forward_days INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default leave types
INSERT INTO leave_types (name, code, description, days_per_year, is_paid, is_carry_forward, max_carry_forward_days) VALUES
    ('Annual Leave', 'AL', 'Annual paid leave', 14, true, true, 7),
    ('Sick Leave', 'SL', 'Sick leave with medical certificate', 10, true, false, 0),
    ('Casual Leave', 'CL', 'Casual or emergency leave', 10, true, false, 0),
    ('Maternity Leave', 'ML', 'Maternity leave for female employees', 90, true, false, 0),
    ('Paternity Leave', 'PL', 'Paternity leave for male employees', 7, true, false, 0),
    ('Unpaid Leave', 'UL', 'Leave without pay', 0, false, false, 0),
    ('Compensatory Off', 'CO', 'Compensatory leave for extra work', 0, true, false, 0);

-- Leave requests table
CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES leave_types(id),

    -- Leave period
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days DECIMAL(4, 1) NOT NULL,
    is_half_day BOOLEAN DEFAULT false,
    half_day_type VARCHAR(10) CHECK (half_day_type IN ('first_half', 'second_half')),

    -- Request details
    reason TEXT NOT NULL,
    attachment_url VARCHAR(500),

    -- Approval workflow
    status VARCHAR(20) DEFAULT 'pending' CHECK (
        status IN ('pending', 'approved', 'rejected', 'cancelled')
    ),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    rejection_reason TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_type ON leave_requests(leave_type_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_requests_dates ON leave_requests(start_date, end_date);

-- Triggers
CREATE TRIGGER update_leave_types_updated_at
    BEFORE UPDATE ON leave_types
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leave_requests_updated_at
    BEFORE UPDATE ON leave_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
