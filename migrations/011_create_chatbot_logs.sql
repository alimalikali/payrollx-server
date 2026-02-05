-- Migration: 011_create_chatbot_logs
-- Create chatbot logs table for HR assistant

CREATE TABLE chatbot_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    total_messages INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chatbot_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chatbot_sessions(id) ON DELETE CASCADE,

    -- Message details
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,

    -- Intent classification
    intent VARCHAR(100),
    confidence DECIMAL(5, 4),

    -- Entities extracted
    entities JSONB,

    -- Response metadata
    response_time_ms INTEGER,
    tokens_used INTEGER,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_chatbot_sessions_user ON chatbot_sessions(user_id);
CREATE INDEX idx_chatbot_sessions_started ON chatbot_sessions(started_at);
CREATE INDEX idx_chatbot_messages_session ON chatbot_messages(session_id);
CREATE INDEX idx_chatbot_messages_intent ON chatbot_messages(intent);
CREATE INDEX idx_chatbot_messages_created ON chatbot_messages(created_at);

-- Trigger for session message count
CREATE OR REPLACE FUNCTION update_session_message_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chatbot_sessions
    SET total_messages = total_messages + 1
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_session_count
    AFTER INSERT ON chatbot_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_session_message_count();
