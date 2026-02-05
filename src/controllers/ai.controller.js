/**
 * AI Controller
 * Handles HTTP requests for AI features
 */

const fraudDetectionService = require('../services/ai/fraudDetection.service');
const salaryAnomalyService = require('../services/ai/salaryAnomaly.service');
const payrollForecastService = require('../services/ai/payrollForecast.service');
const salaryRecommendationService = require('../services/ai/salaryRecommendation.service');
const chatbotService = require('../services/ai/chatbot.service');
const db = require('../config/database');
const { success } = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');

// Fraud Detection

const runFraudDetection = asyncHandler(async (req, res) => {
  const result = await fraudDetectionService.runFraudDetection();

  res.json(success(result, 'Fraud detection completed'));
});

const getFraudStats = asyncHandler(async (req, res) => {
  const stats = await fraudDetectionService.getFraudStats();

  res.json(success(stats));
});

// Salary Anomaly

const detectSalaryAnomalies = asyncHandler(async (req, res) => {
  const result = await salaryAnomalyService.detectSalaryAnomalies();

  res.json(success(result, 'Salary anomaly detection completed'));
});

const getSalaryDistribution = asyncHandler(async (req, res) => {
  const distribution = await salaryAnomalyService.getSalaryDistribution();

  res.json(success(distribution));
});

// Payroll Forecast

const generateForecast = asyncHandler(async (req, res) => {
  const { months } = req.query;
  const result = await payrollForecastService.generateForecast(parseInt(months) || 6);

  res.json(success(result));
});

const getBudgetComparison = asyncHandler(async (req, res) => {
  const { year } = req.query;
  const result = await payrollForecastService.getBudgetComparison(
    parseInt(year) || new Date().getFullYear()
  );

  res.json(success(result));
});

// Salary Recommendations

const getSalaryRecommendation = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const result = await salaryRecommendationService.getSalaryRecommendation(employeeId);

  if (!result.success) {
    return res.status(404).json({ success: false, error: { message: result.message } });
  }

  res.json(success(result.data));
});

const getBulkRecommendations = asyncHandler(async (req, res) => {
  const { departmentId } = req.query;
  const result = await salaryRecommendationService.getBulkRecommendations({ departmentId });

  res.json(success(result));
});

// Chatbot

const sendChatMessage = asyncHandler(async (req, res) => {
  const { sessionId, message } = req.body;

  const result = await chatbotService.processMessage({
    userId: req.user.id,
    sessionId,
    message,
  });

  res.json(success(result));
});

const getChatHistory = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const history = await chatbotService.getChatHistory(sessionId);

  res.json(success(history));
});

// AI Alerts

const getAlerts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, type, severity, status } = req.query;
  const offset = (page - 1) * limit;

  const params = [];
  const conditions = [];
  let paramIndex = 1;

  if (type) {
    conditions.push(`alert_type = $${paramIndex}`);
    params.push(type);
    paramIndex++;
  }

  if (severity) {
    conditions.push(`severity = $${paramIndex}`);
    params.push(severity);
    paramIndex++;
  }

  if (status) {
    conditions.push(`status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await db.query(
    `SELECT COUNT(*) FROM ai_alerts ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  const query = `
    SELECT a.*,
           e.first_name || ' ' || e.last_name as employee_name,
           e.employee_id as emp_code
    FROM ai_alerts a
    LEFT JOIN employees e ON a.employee_id = e.id
    ${whereClause}
    ORDER BY
      CASE severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        ELSE 4
      END,
      a.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  params.push(limit, offset);
  const result = await db.query(query, params);

  res.json(success(result.rows.map(row => ({
    id: row.id,
    alertType: row.alert_type,
    severity: row.severity,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    employeeCode: row.emp_code,
    title: row.title,
    description: row.description,
    details: row.details,
    confidenceScore: row.confidence_score,
    status: row.status,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    resolutionNotes: row.resolution_notes,
    createdAt: row.created_at,
  })), null, { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) }));
});

const updateAlertStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, resolutionNotes } = req.body;

  const query = status === 'resolved'
    ? `UPDATE ai_alerts SET status = $1, resolved_by = $2, resolved_at = CURRENT_TIMESTAMP, resolution_notes = $3 WHERE id = $4 RETURNING *`
    : `UPDATE ai_alerts SET status = $1 WHERE id = $2 RETURNING *`;

  const params = status === 'resolved'
    ? [status, req.user.id, resolutionNotes, id]
    : [status, id];

  const result = await db.query(query, params);

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: { message: 'Alert not found' } });
  }

  res.json(success(result.rows[0], 'Alert status updated'));
});

// Dashboard Stats

const getDashboardStats = asyncHandler(async (req, res) => {
  const [fraudStats, anomalyStats, alertStats] = await Promise.all([
    fraudDetectionService.getFraudStats(),
    db.query(`
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE severity = 'high') as high_severity
      FROM ai_alerts
      WHERE alert_type = 'salary_anomaly'
        AND status = 'new'
    `),
    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'new') as new_alerts,
        COUNT(*) FILTER (WHERE status = 'investigating') as investigating,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as last_7_days
      FROM ai_alerts
    `),
  ]);

  res.json(success({
    fraudDetection: fraudStats,
    salaryAnomalies: {
      total: parseInt(anomalyStats.rows[0].total),
      highSeverity: parseInt(anomalyStats.rows[0].high_severity),
    },
    alerts: alertStats.rows[0],
  }));
});

module.exports = {
  runFraudDetection,
  getFraudStats,
  detectSalaryAnomalies,
  getSalaryDistribution,
  generateForecast,
  getBudgetComparison,
  getSalaryRecommendation,
  getBulkRecommendations,
  sendChatMessage,
  getChatHistory,
  getAlerts,
  updateAlertStatus,
  getDashboardStats,
};
