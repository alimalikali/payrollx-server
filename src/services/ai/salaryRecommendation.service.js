/**
 * Salary Recommendation Service
 * Provides AI-powered salary recommendations based on market data and internal equity
 */

const db = require('../../config/database');

/**
 * Market salary data (simulated - would be replaced with real market data API)
 * Based on Pakistani market averages for 2024
 */
const MARKET_DATA = {
  'Software Engineer': { min: 80000, median: 150000, max: 300000 },
  'Senior Software Engineer': { min: 150000, median: 250000, max: 450000 },
  'Tech Lead': { min: 200000, median: 350000, max: 600000 },
  'Product Manager': { min: 120000, median: 200000, max: 400000 },
  'HR Manager': { min: 100000, median: 180000, max: 300000 },
  'HR Executive': { min: 50000, median: 80000, max: 150000 },
  'Accountant': { min: 60000, median: 100000, max: 180000 },
  'Finance Manager': { min: 150000, median: 250000, max: 400000 },
  'Marketing Manager': { min: 120000, median: 200000, max: 350000 },
  'QA Engineer': { min: 70000, median: 120000, max: 220000 },
  'DevOps Engineer': { min: 100000, median: 180000, max: 350000 },
  'UI/UX Designer': { min: 80000, median: 140000, max: 280000 },
  'Data Analyst': { min: 80000, median: 140000, max: 250000 },
  'Project Manager': { min: 100000, median: 180000, max: 320000 },
  'Business Analyst': { min: 90000, median: 160000, max: 280000 },
  'default': { min: 50000, median: 100000, max: 200000 },
};

/**
 * Get salary recommendation for an employee
 */
const getSalaryRecommendation = async (employeeId) => {
  // Get employee details
  const empResult = await db.query(`
    SELECT
      e.id,
      e.first_name || ' ' || e.last_name as name,
      e.designation,
      e.joining_date,
      e.department_id,
      d.name as department,
      ss.gross_salary as current_salary,
      ss.basic_salary
    FROM employees e
    JOIN departments d ON e.department_id = d.id
    LEFT JOIN salary_structures ss ON e.id = ss.employee_id AND ss.is_current = true
    WHERE e.id = $1
  `, [employeeId]);

  if (empResult.rows.length === 0) {
    return { success: false, message: 'Employee not found' };
  }

  const employee = empResult.rows[0];
  const currentSalary = parseFloat(employee.current_salary) || 0;

  // Get market data for designation
  const marketData = MARKET_DATA[employee.designation] || MARKET_DATA.default;

  // Get internal comparisons
  const internalData = await getInternalComparison(employee.designation, employee.department_id);

  // Calculate experience factor
  const yearsOfService = calculateYearsOfService(employee.joining_date);
  const experienceFactor = Math.min(1.5, 1 + (yearsOfService * 0.05));

  // Get performance factor (would come from performance reviews)
  const performanceFactor = await getPerformanceFactor(employeeId);

  // Calculate recommended salary range
  const baseRecommendation = marketData.median * experienceFactor * performanceFactor;

  const recommendation = {
    employeeId: employee.id,
    employeeName: employee.name,
    designation: employee.designation,
    department: employee.department,
    yearsOfService: yearsOfService.toFixed(1),

    currentSalary,
    currentPosition: getSalaryPosition(currentSalary, marketData),

    marketData: {
      minimum: marketData.min,
      median: marketData.median,
      maximum: marketData.max,
    },

    internalData: {
      departmentAverage: internalData.deptAvg,
      designationAverage: internalData.designationAvg,
      percentile: internalData.percentile,
    },

    factors: {
      experience: experienceFactor.toFixed(2),
      performance: performanceFactor.toFixed(2),
    },

    recommendation: {
      minimum: Math.round(baseRecommendation * 0.9),
      optimal: Math.round(baseRecommendation),
      maximum: Math.round(baseRecommendation * 1.15),
      suggestedIncrease: currentSalary > 0
        ? Math.round(((baseRecommendation - currentSalary) / currentSalary) * 100)
        : null,
    },

    analysis: generateAnalysis(currentSalary, baseRecommendation, marketData, internalData),
    confidenceScore: 75,
  };

  return { success: true, data: recommendation };
};

/**
 * Get bulk salary recommendations for all employees
 */
const getBulkRecommendations = async (filters = {}) => {
  const { departmentId, designations } = filters;

  let query = `
    SELECT
      e.id,
      e.first_name || ' ' || e.last_name as name,
      e.designation,
      e.joining_date,
      d.name as department,
      ss.gross_salary as current_salary
    FROM employees e
    JOIN departments d ON e.department_id = d.id
    LEFT JOIN salary_structures ss ON e.id = ss.employee_id AND ss.is_current = true
    WHERE e.status = 'active'
  `;

  const params = [];
  if (departmentId) {
    params.push(departmentId);
    query += ` AND e.department_id = $${params.length}`;
  }

  query += ' ORDER BY d.name, e.designation';

  const result = await db.query(query, params);

  const recommendations = [];
  let totalCurrentCost = 0;
  let totalRecommendedCost = 0;

  for (const emp of result.rows) {
    const currentSalary = parseFloat(emp.current_salary) || 0;
    const marketData = MARKET_DATA[emp.designation] || MARKET_DATA.default;
    const yearsOfService = calculateYearsOfService(emp.joining_date);
    const experienceFactor = Math.min(1.5, 1 + (yearsOfService * 0.05));
    const recommendedSalary = Math.round(marketData.median * experienceFactor);

    totalCurrentCost += currentSalary;
    totalRecommendedCost += Math.max(currentSalary, recommendedSalary);

    const status = getRecommendationStatus(currentSalary, recommendedSalary, marketData);

    recommendations.push({
      employeeId: emp.id,
      name: emp.name,
      designation: emp.designation,
      department: emp.department,
      currentSalary,
      recommendedSalary,
      marketMedian: marketData.median,
      difference: recommendedSalary - currentSalary,
      percentDifference: currentSalary > 0
        ? Math.round(((recommendedSalary - currentSalary) / currentSalary) * 100)
        : null,
      status,
      priority: status === 'underpaid' ? 'high' : status === 'below_market' ? 'medium' : 'low',
    });
  }

  // Sort by priority
  recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return {
    summary: {
      totalEmployees: recommendations.length,
      totalCurrentCost,
      totalRecommendedCost,
      additionalBudgetNeeded: totalRecommendedCost - totalCurrentCost,
      underpaidCount: recommendations.filter(r => r.status === 'underpaid').length,
      belowMarketCount: recommendations.filter(r => r.status === 'below_market').length,
      competitiveCount: recommendations.filter(r => r.status === 'competitive').length,
      aboveMarketCount: recommendations.filter(r => r.status === 'above_market').length,
    },
    recommendations,
  };
};

// Helper functions

const calculateYearsOfService = (joiningDate) => {
  if (!joiningDate) return 0;
  const joining = new Date(joiningDate);
  const now = new Date();
  return (now - joining) / (365.25 * 24 * 60 * 60 * 1000);
};

const getPerformanceFactor = async (employeeId) => {
  // Would be replaced with actual performance data
  // For now, return a random factor between 0.9 and 1.2
  return 1.0; // Default average performance
};

const getInternalComparison = async (designation, departmentId) => {
  const result = await db.query(`
    SELECT
      AVG(ss.gross_salary) FILTER (WHERE e.department_id = $1) as dept_avg,
      AVG(ss.gross_salary) FILTER (WHERE e.designation = $2) as designation_avg,
      COUNT(*) FILTER (WHERE e.designation = $2) as same_designation_count
    FROM employees e
    JOIN salary_structures ss ON e.id = ss.employee_id AND ss.is_current = true
    WHERE e.status = 'active'
  `, [departmentId, designation]);

  const row = result.rows[0];
  return {
    deptAvg: Math.round(parseFloat(row.dept_avg) || 0),
    designationAvg: Math.round(parseFloat(row.designation_avg) || 0),
    percentile: 50, // Would calculate actual percentile
  };
};

const getSalaryPosition = (salary, marketData) => {
  if (salary < marketData.min) return 'below_minimum';
  if (salary < marketData.median * 0.9) return 'below_market';
  if (salary > marketData.max) return 'above_maximum';
  if (salary > marketData.median * 1.1) return 'above_market';
  return 'competitive';
};

const getRecommendationStatus = (current, recommended, marketData) => {
  if (current < marketData.min) return 'underpaid';
  if (current < marketData.median * 0.85) return 'below_market';
  if (current > marketData.max) return 'above_market';
  return 'competitive';
};

const generateAnalysis = (currentSalary, recommendation, marketData, internalData) => {
  const points = [];

  if (currentSalary < marketData.min) {
    points.push('Current salary is below market minimum. Immediate adjustment recommended.');
  } else if (currentSalary < marketData.median * 0.9) {
    points.push('Salary is below market median. Consider adjustment to retain talent.');
  } else if (currentSalary > marketData.max) {
    points.push('Salary exceeds market maximum. Review total compensation structure.');
  } else {
    points.push('Salary is within competitive market range.');
  }

  if (internalData.deptAvg > 0 && currentSalary < internalData.deptAvg * 0.85) {
    points.push('Salary is significantly below department average. May indicate internal equity issues.');
  }

  return points;
};

module.exports = {
  getSalaryRecommendation,
  getBulkRecommendations,
  MARKET_DATA,
};
