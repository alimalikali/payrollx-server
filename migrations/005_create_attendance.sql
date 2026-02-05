-- Migration: 005_create_attendance
-- Create attendance table

CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,

    -- Time tracking
    check_in TIME,
    check_out TIME,
    working_hours DECIMAL(4, 2),
    overtime_hours DECIMAL(4, 2) DEFAULT 0,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'present' CHECK (
        status IN ('present', 'absent', 'half_day', 'late', 'on_leave', 'holiday', 'weekend')
    ),

    -- Location tracking (optional)
    check_in_location VARCHAR(255),
    check_out_location VARCHAR(255),

    -- Notes
    notes TEXT,

    -- Audit
    marked_by UUID REFERENCES users(id),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_attendance_employee ON attendance(employee_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_status ON attendance(status);
CREATE INDEX idx_attendance_employee_date ON attendance(employee_id, date);

-- Unique constraint: one attendance record per employee per day
CREATE UNIQUE INDEX idx_attendance_unique_day ON attendance(employee_id, date);

-- Trigger for updated_at
CREATE TRIGGER update_attendance_updated_at
    BEFORE UPDATE ON attendance
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate working hours
CREATE OR REPLACE FUNCTION calculate_working_hours()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.check_in IS NOT NULL AND NEW.check_out IS NOT NULL THEN
        NEW.working_hours = EXTRACT(EPOCH FROM (NEW.check_out - NEW.check_in)) / 3600;
        -- Calculate overtime (anything over 8 hours)
        IF NEW.working_hours > 8 THEN
            NEW.overtime_hours = NEW.working_hours - 8;
        ELSE
            NEW.overtime_hours = 0;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_attendance_hours
    BEFORE INSERT OR UPDATE ON attendance
    FOR EACH ROW
    EXECUTE FUNCTION calculate_working_hours();
