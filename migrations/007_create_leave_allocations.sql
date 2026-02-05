-- Migration: 007_create_leave_allocations
-- Create leave allocations table

CREATE TABLE leave_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES leave_types(id),
    year INTEGER NOT NULL,

    -- Leave balance
    allocated_days DECIMAL(5, 1) NOT NULL DEFAULT 0,
    used_days DECIMAL(5, 1) NOT NULL DEFAULT 0,
    carried_forward_days DECIMAL(5, 1) NOT NULL DEFAULT 0,

    -- Calculated field
    remaining_days DECIMAL(5, 1) GENERATED ALWAYS AS (
        allocated_days + carried_forward_days - used_days
    ) STORED,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_leave_alloc_employee ON leave_allocations(employee_id);
CREATE INDEX idx_leave_alloc_year ON leave_allocations(year);
CREATE INDEX idx_leave_alloc_type ON leave_allocations(leave_type_id);

-- Unique constraint: one allocation per employee per leave type per year
CREATE UNIQUE INDEX idx_leave_alloc_unique
    ON leave_allocations(employee_id, leave_type_id, year);

-- Trigger for updated_at
CREATE TRIGGER update_leave_allocations_updated_at
    BEFORE UPDATE ON leave_allocations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update leave allocation when leave is approved
CREATE OR REPLACE FUNCTION update_leave_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- When leave is approved, update the used_days
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        UPDATE leave_allocations
        SET used_days = used_days + NEW.total_days
        WHERE employee_id = NEW.employee_id
          AND leave_type_id = NEW.leave_type_id
          AND year = EXTRACT(YEAR FROM NEW.start_date);
    END IF;

    -- When approved leave is cancelled, restore the days
    IF NEW.status = 'cancelled' AND OLD.status = 'approved' THEN
        UPDATE leave_allocations
        SET used_days = used_days - OLD.total_days
        WHERE employee_id = OLD.employee_id
          AND leave_type_id = OLD.leave_type_id
          AND year = EXTRACT(YEAR FROM OLD.start_date);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_leave_balance
    AFTER UPDATE ON leave_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_leave_balance();
