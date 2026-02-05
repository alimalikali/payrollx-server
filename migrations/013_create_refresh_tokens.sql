-- Migration: 013_create_refresh_tokens
-- Create refresh tokens table for JWT authentication

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,

    -- Token metadata
    device_info VARCHAR(500),
    ip_address VARCHAR(45),
    user_agent TEXT,

    -- Expiry and revocation
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    revoked_reason VARCHAR(100),

    -- Token family for rotation tracking
    family_id UUID NOT NULL,
    generation INTEGER DEFAULT 1,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- Function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM refresh_tokens
    WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '7 days'
       OR revoked_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Audit log for security events
CREATE TABLE security_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL CHECK (
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
            'account_unlocked'
        )
    ),
    ip_address VARCHAR(45),
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for audit log
CREATE INDEX idx_audit_log_user ON security_audit_log(user_id);
CREATE INDEX idx_audit_log_event ON security_audit_log(event_type);
CREATE INDEX idx_audit_log_created ON security_audit_log(created_at);
