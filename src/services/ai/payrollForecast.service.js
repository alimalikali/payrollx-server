/**
 * Payroll Forecasting Service
 * Predicts future payroll costs using time-series analysis
 */

const db = require('../../config/database');

/**
 * Generate payroll forecast for upcoming months
 */
const generateForecast = async (months = 6) => {
  // Get historical payroll data
  const historicalData = await getHistoricalPayroll(12);

  if (historicalData.length < 3) {
    return {
      success: false,
      message: 'Insufficient historical data for forecasting (minimum 3 months required)',
      data: null,
    };
  }

  // Calculate growth trends
  const trends = calculateTrends(historicalData);

  // Generate forecasts
  const forecasts = [];
  const lastRecord = historicalData[0];
  let baseGross = parseFloat(lastRecord.total_gross);
  let baseEmployees = parseInt(lastRecord.employee_count);

  for (let i = 1; i <= months; i++) {
    const forecastDate = new Date(lastRecord.year, lastRecord.month - 1 + i, 1);
    const month = forecastDate.getMonth() + 1;
    const year = forecastDate.getFullYear();

    // Apply trends with seasonal adjustments
    const seasonalFactor = getSeasonalFactor(month);
    const projectedGross = baseGross * (1 + trends.grossGrowthRate) * seasonalFactor;
    const projectedEmployees = Math.round(baseEmployees * (1 + trends.employeeGrowthRate));

    // Estimate deductions (typically 15-25% of gross)
    const estimatedDeductions = projectedGross * 0.18;
    const projectedNet = projectedGross - estimatedDeductions;

    forecasts.push({
      month,
      year,
      period: `${year}-${String(month).padStart(2, '0')}`,
      projectedEmployees,
      projectedGrossSalary: Math.round(projectedGross),
      projectedDeductions: Math.round(estimatedDeductions),
      projectedNetSalary: Math.round(projectedNet),
      confidenceLevel: Math.max(50, 95 - (i * 5)), // Confidence decreases over time
      seasonalFactor: seasonalFactor.toFixed(2),
    });

    baseGross = projectedGross;
    baseEmployees = projectedEmployees;
  }

  // Calculate summary
  const totalProjectedCost = forecasts.reduce((sum, f) => sum + f.projectedGrossSalary, 0);
  const avgMonthlyProjection = totalProjectedCost / months;

  return {
    success: true,
    summary: {
      forecastPeriod: `${months} months`,
      totalProjectedCost: Math.round(totalProjectedCost),
      averageMonthlyProjection: Math.round(avgMonthlyProjection),
      growthRate: `${(trends.grossGrowthRate * 100).toFixed(1)}% per month`,
      employeeGrowthRate: `${(trends.employeeGrowthRate * 100).toFixed(1)}% per month`,
    },
    trends,
    forecasts,
    historicalData: historicalData.slice(0, 6).map(h => ({
      period: `${h.year}-${String(h.month).padStart(2, '0')}`,
      grossSalary: parseFloat(h.total_gross),
      employeeCount: parseInt(h.employee_count),
    })),
  };
};

/**
 * Get historical payroll data
 */
const getHistoricalPayroll = async (months = 12) => {
  const result = await db.query(`
    SELECT
      month,
      year,
      total_gross_salary as total_gross,
      total_net_salary as total_net,
      total_employees as employee_count,
      total_deductions
    FROM payroll_runs
    WHERE status IN ('completed', 'approved', 'paid')
    ORDER BY year DESC, month DESC
    LIMIT $1
  `, [months]);

  return result.rows;
};

/**
 * Calculate trends from historical data
 */
const calculateTrends = (data) => {
  if (data.length < 2) {
    return {
      grossGrowthRate: 0.02, // Default 2% growth
      employeeGrowthRate: 0.01,
      avgGross: parseFloat(data[0]?.total_gross) || 0,
    };
  }

  // Calculate month-over-month growth rates
  const grossGrowthRates = [];
  const employeeGrowthRates = [];

  for (let i = 0; i < data.length - 1; i++) {
    const current = data[i];
    const previous = data[i + 1];

    const grossCurrent = parseFloat(current.total_gross);
    const grossPrevious = parseFloat(previous.total_gross);
    const empCurrent = parseInt(current.employee_count);
    const empPrevious = parseInt(previous.employee_count);

    if (grossPrevious > 0) {
      grossGrowthRates.push((grossCurrent - grossPrevious) / grossPrevious);
    }
    if (empPrevious > 0) {
      employeeGrowthRates.push((empCurrent - empPrevious) / empPrevious);
    }
  }

  // Calculate average growth rates
  const avgGrossGrowth = grossGrowthRates.length > 0
    ? grossGrowthRates.reduce((a, b) => a + b, 0) / grossGrowthRates.length
    : 0.02;

  const avgEmployeeGrowth = employeeGrowthRates.length > 0
    ? employeeGrowthRates.reduce((a, b) => a + b, 0) / employeeGrowthRates.length
    : 0.01;

  // Calculate average gross salary
  const avgGross = data.reduce((sum, d) => sum + parseFloat(d.total_gross), 0) / data.length;

  return {
    grossGrowthRate: Math.max(-0.1, Math.min(0.2, avgGrossGrowth)), // Cap between -10% and 20%
    employeeGrowthRate: Math.max(-0.05, Math.min(0.1, avgEmployeeGrowth)),
    avgGross,
    dataPoints: data.length,
  };
};

/**
 * Get seasonal adjustment factor
 * Accounts for bonuses, increments, etc.
 */
const getSeasonalFactor = (month) => {
  const seasonalFactors = {
    1: 1.05,  // January - New year adjustments
    2: 1.0,
    3: 1.0,
    4: 1.0,
    5: 1.0,
    6: 1.02,  // Mid-year reviews
    7: 1.15,  // Eid bonuses (approximate)
    8: 1.0,
    9: 1.0,
    10: 1.0,
    11: 1.0,
    12: 1.1,  // Year-end bonuses
  };

  return seasonalFactors[month] || 1.0;
};

/**
 * Get budget vs actual comparison
 */
const getBudgetComparison = async (year) => {
  const result = await db.query(`
    SELECT
      month,
      total_gross_salary as actual_gross,
      total_net_salary as actual_net,
      total_employees
    FROM payroll_runs
    WHERE year = $1
      AND status IN ('completed', 'approved', 'paid')
    ORDER BY month
  `, [year]);

  // Generate a simple budget (could be enhanced with actual budget data)
  const monthlyBudget = result.rows.length > 0
    ? result.rows.reduce((sum, r) => sum + parseFloat(r.actual_gross), 0) / result.rows.length
    : 0;

  return result.rows.map(row => ({
    month: row.month,
    actualGross: parseFloat(row.actual_gross),
    budgetedGross: Math.round(monthlyBudget),
    variance: Math.round(parseFloat(row.actual_gross) - monthlyBudget),
    variancePercent: monthlyBudget > 0
      ? ((parseFloat(row.actual_gross) - monthlyBudget) / monthlyBudget * 100).toFixed(1)
      : 0,
    employees: parseInt(row.total_employees),
  }));
};

module.exports = {
  generateForecast,
  getHistoricalPayroll,
  calculateTrends,
  getBudgetComparison,
};
