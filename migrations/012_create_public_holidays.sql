-- Migration: 012_create_public_holidays
-- Create public holidays table

CREATE TABLE public_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    year INTEGER NOT NULL,
    description TEXT,
    is_optional BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_public_holidays_date ON public_holidays(date);
CREATE INDEX idx_public_holidays_year ON public_holidays(year);

-- Unique constraint: one holiday per date
CREATE UNIQUE INDEX idx_public_holidays_unique ON public_holidays(date);

-- Trigger for updated_at
CREATE TRIGGER update_public_holidays_updated_at
    BEFORE UPDATE ON public_holidays
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Seed Pakistani public holidays for 2024
INSERT INTO public_holidays (name, date, year, description) VALUES
    ('Kashmir Day', '2024-02-05', 2024, 'Kashmir Solidarity Day'),
    ('Pakistan Day', '2024-03-23', 2024, 'Pakistan Resolution Day'),
    ('Labour Day', '2024-05-01', 2024, 'International Labour Day'),
    ('Independence Day', '2024-08-14', 2024, 'Pakistan Independence Day'),
    ('Iqbal Day', '2024-11-09', 2024, 'Birth Anniversary of Allama Iqbal'),
    ('Quaid-e-Azam Day', '2024-12-25', 2024, 'Birth Anniversary of Quaid-e-Azam');

-- Seed Pakistani public holidays for 2025
INSERT INTO public_holidays (name, date, year, description) VALUES
    ('Kashmir Day', '2025-02-05', 2025, 'Kashmir Solidarity Day'),
    ('Pakistan Day', '2025-03-23', 2025, 'Pakistan Resolution Day'),
    ('Labour Day', '2025-05-01', 2025, 'International Labour Day'),
    ('Independence Day', '2025-08-14', 2025, 'Pakistan Independence Day'),
    ('Iqbal Day', '2025-11-09', 2025, 'Birth Anniversary of Allama Iqbal'),
    ('Quaid-e-Azam Day', '2025-12-25', 2025, 'Birth Anniversary of Quaid-e-Azam');
