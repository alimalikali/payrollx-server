-- Migration: 019_create_notices
-- Create notices table for company notice board + expand notification types

CREATE TABLE IF NOT EXISTS notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    priority VARCHAR(10) NOT NULL DEFAULT 'low',
    category VARCHAR(20) NOT NULL DEFAULT 'general',
    is_pinned BOOLEAN DEFAULT false,
    expires_at TIMESTAMP,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_notice_priority CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    CONSTRAINT chk_notice_category CHECK (category IN ('general', 'policy', 'event', 'holiday', 'payroll'))
);

CREATE INDEX IF NOT EXISTS idx_notices_priority ON notices(priority);
CREATE INDEX IF NOT EXISTS idx_notices_category ON notices(category);
CREATE INDEX IF NOT EXISTS idx_notices_pinned ON notices(is_pinned);
CREATE INDEX IF NOT EXISTS idx_notices_expires_at ON notices(expires_at);
CREATE INDEX IF NOT EXISTS idx_notices_created_at ON notices(created_at DESC);

-- Expand notification type CHECK constraint to include new types
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'notifications_type_check' AND table_name = 'notifications'
  ) THEN
    ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
  END IF;
END $$;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
        'leave_request_submitted',
        'leave_request_approved',
        'leave_request_rejected',
        'leave_request_cancelled',
        'salary_credited',
        'company_notice',
        'new_notice',
        'welcome'
    )
);
