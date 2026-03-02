-- Migration: 015_harden_roles_and_audit
-- Enforce hr/employee roles and extend audit metadata

BEGIN;

-- Migrate legacy admin users to hr.
UPDATE users
SET role = 'hr'
WHERE role = 'admin';

-- Replace users role check constraint dynamically.
DO $$
DECLARE
  role_constraint_name TEXT;
BEGIN
  SELECT c.conname
  INTO role_constraint_name
  FROM pg_constraint c
  WHERE c.conrelid = 'users'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%role%';

  IF role_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', role_constraint_name);
  END IF;
END $$;

ALTER TABLE users
  ADD CONSTRAINT users_role_check CHECK (role IN ('hr', 'employee'));

-- Extend security audit event taxonomy.
DO $$
DECLARE
  audit_constraint_name TEXT;
BEGIN
  IF to_regclass('public.security_audit_log') IS NOT NULL THEN
    SELECT c.conname
    INTO audit_constraint_name
    FROM pg_constraint c
    WHERE c.conrelid = 'security_audit_log'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%event_type%';

    IF audit_constraint_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE security_audit_log DROP CONSTRAINT %I', audit_constraint_name);
    END IF;

    ALTER TABLE security_audit_log
      ADD CONSTRAINT security_audit_log_event_type_check CHECK (
        event_type IN (
          'login_success',
          'login_failed',
          'logout',
          'token_refresh',
          'token_revoked',
          'password_change',
          'password_reset_request',
          'password_reset_complete',
          'account_locked',
          'account_unlocked',
          'authz_denied',
          'role_changed',
          'employee_record_updated',
          'payslip_generated'
        )
      );
  END IF;
END $$;

-- Track explicit role changes.
CREATE TABLE IF NOT EXISTS role_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_role VARCHAR(20) NOT NULL CHECK (old_role IN ('hr', 'employee')),
  new_role VARCHAR(20) NOT NULL CHECK (new_role IN ('hr', 'employee')),
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_role_change_history_user ON role_change_history(user_id);
CREATE INDEX IF NOT EXISTS idx_role_change_history_changed_at ON role_change_history(changed_at);

COMMIT;
