-- Migration: 020_add_email_tracking
-- Add email tracking columns to notifications table

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_error TEXT;
