-- Migration: 010_create_ai_alerts
-- Create AI alerts table for fraud detection and anomaly alerts

CREATE TABLE ai_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Alert type
    alert_type VARCHAR(50) NOT NULL CHECK (
        alert_type IN (
            'fraud_detection',
            'salary_anomaly',
            'attendance_anomaly',
            'payroll_forecast',
            'salary_recommendation'
        )
    ),

    -- Severity
    severity VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (
        severity IN ('low', 'medium', 'high', 'critical')
    ),

    -- Related entities
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE SET NULL,

    -- Alert details
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    details JSONB,

    -- Confidence score (0-100)
    confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),

    -- Status
    status VARCHAR(20) DEFAULT 'new' CHECK (
        status IN ('new', 'acknowledged', 'investigating', 'resolved', 'dismissed')
    ),

    -- Resolution
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP,
    resolution_notes TEXT,

    -- Metadata
    model_version VARCHAR(50),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_ai_alerts_type ON ai_alerts(alert_type);
CREATE INDEX idx_ai_alerts_severity ON ai_alerts(severity);
CREATE INDEX idx_ai_alerts_status ON ai_alerts(status);
CREATE INDEX idx_ai_alerts_employee ON ai_alerts(employee_id);
CREATE INDEX idx_ai_alerts_payroll ON ai_alerts(payroll_run_id);
CREATE INDEX idx_ai_alerts_created ON ai_alerts(created_at);

-- Trigger for updated_at
CREATE TRIGGER update_ai_alerts_updated_at
    BEFORE UPDATE ON ai_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
