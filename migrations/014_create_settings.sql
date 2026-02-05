-- Migration: 014_create_settings
-- Create settings table

CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_settings_key ON settings(key);

CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Seed default settings
INSERT INTO settings (key, value) VALUES
    ('company.name', '"PayrollX Demo Company"'),
    ('company.address', '"Lahore, Pakistan"'),
    ('payroll.paymentDay', '28'),
    ('payroll.workingHoursPerDay', '8'),
    ('payroll.overtimeMultiplier', '1.5'),
    ('attendance.workStartTime', '"09:00"'),
    ('attendance.workEndTime', '"18:00"'),
    ('attendance.gracePeriodMinutes', '15')
ON CONFLICT (key) DO NOTHING;
