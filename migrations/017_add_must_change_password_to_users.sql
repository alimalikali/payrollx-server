-- Migration: 017_add_must_change_password_to_users
-- Force first-login password reset for accounts created with temporary passwords

ALTER TABLE users
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

