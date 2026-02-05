/**
 * HR Chatbot Service
 * Handles natural language queries about HR and payroll
 */

const db = require('../../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * Intent patterns and responses
 */
const INTENTS = {
  SALARY_QUERY: {
    patterns: ['salary', 'pay', 'wage', 'earning', 'income', 'compensation'],
    handler: handleSalaryQuery,
  },
  LEAVE_BALANCE: {
    patterns: ['leave', 'vacation', 'holiday', 'time off', 'pto', 'absence'],
    handler: handleLeaveQuery,
  },
  ATTENDANCE: {
    patterns: ['attendance', 'present', 'absent', 'working hours', 'overtime'],
    handler: handleAttendanceQuery,
  },
  TAX_INFO: {
    patterns: ['tax', 'deduction', 'income tax', 'fbr', 'filer'],
    handler: handleTaxQuery,
  },
  PAYSLIP: {
    patterns: ['payslip', 'pay stub', 'salary slip', 'earning statement'],
    handler: handlePayslipQuery,
  },
  POLICY: {
    patterns: ['policy', 'rule', 'guideline', 'procedure', 'process'],
    handler: handlePolicyQuery,
  },
  GREETING: {
    patterns: ['hello', 'hi', 'hey', 'good morning', 'good afternoon'],
    handler: handleGreeting,
  },
  HELP: {
    patterns: ['help', 'assist', 'support', 'what can you do', 'capabilities'],
    handler: handleHelp,
  },
};

/**
 * Process chat message
 */
const processMessage = async ({ userId, sessionId, message }) => {
  const startTime = Date.now();

  // Get or create session
  let session = sessionId;
  if (!session) {
    const result = await db.query(
      'INSERT INTO chatbot_sessions (id, user_id) VALUES ($1, $2) RETURNING id',
      [uuidv4(), userId]
    );
    session = result.rows[0].id;
  }

  // Classify intent
  const intent = classifyIntent(message);

  // Get user context (employee info)
  const userContext = await getUserContext(userId);

  // Generate response
  const response = await intent.handler(message, userContext);

  // Save messages
  await saveMessage(session, 'user', message, intent.name);
  await saveMessage(session, 'assistant', response.message, intent.name);

  return {
    sessionId: session,
    message: response.message,
    data: response.data || null,
    intent: intent.name,
    confidence: intent.confidence,
    suggestions: response.suggestions || getDefaultSuggestions(),
    responseTime: Date.now() - startTime,
  };
};

/**
 * Classify message intent
 */
const classifyIntent = (message) => {
  const lowerMessage = message.toLowerCase();

  for (const [intentName, config] of Object.entries(INTENTS)) {
    const matchedPatterns = config.patterns.filter(p => lowerMessage.includes(p));
    if (matchedPatterns.length > 0) {
      return {
        name: intentName,
        handler: config.handler,
        confidence: Math.min(0.95, 0.5 + matchedPatterns.length * 0.15),
      };
    }
  }

  return {
    name: 'UNKNOWN',
    handler: handleUnknown,
    confidence: 0.3,
  };
};

/**
 * Get user context
 */
const getUserContext = async (userId) => {
  const result = await db.query(`
    SELECT
      u.id as user_id,
      u.email,
      u.role,
      e.id as employee_id,
      e.first_name,
      e.last_name,
      e.designation,
      d.name as department,
      ss.gross_salary
    FROM users u
    LEFT JOIN employees e ON e.user_id = u.id
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN salary_structures ss ON e.id = ss.employee_id AND ss.is_current = true
    WHERE u.id = $1
  `, [userId]);

  return result.rows[0] || null;
};

// Intent handlers

async function handleSalaryQuery(message, context) {
  if (!context?.employee_id) {
    return {
      message: "I couldn't find your employee profile. Please contact HR for salary information.",
    };
  }

  const salary = parseFloat(context.gross_salary) || 0;

  return {
    message: `Hi ${context.first_name}! Your current gross salary is PKR ${salary.toLocaleString()}. Would you like to see your latest payslip or breakdown of your salary components?`,
    data: { grossSalary: salary },
    suggestions: ['Show my payslip', 'Explain deductions', 'Tax information'],
  };
}

async function handleLeaveQuery(message, context) {
  if (!context?.employee_id) {
    return { message: "I couldn't find your employee profile. Please contact HR." };
  }

  const result = await db.query(`
    SELECT
      lt.name,
      lt.code,
      COALESCE(la.allocated_days, 0) as allocated,
      COALESCE(la.used_days, 0) as used,
      COALESCE(la.remaining_days, 0) as remaining
    FROM leave_types lt
    LEFT JOIN leave_allocations la ON lt.id = la.leave_type_id
      AND la.employee_id = $1
      AND la.year = $2
    WHERE lt.is_active = true
    ORDER BY lt.name
  `, [context.employee_id, new Date().getFullYear()]);

  const leaveInfo = result.rows.map(r =>
    `• ${r.name} (${r.code}): ${r.remaining} days remaining (${r.used}/${r.allocated} used)`
  ).join('\n');

  return {
    message: `Hi ${context.first_name}! Here's your leave balance for ${new Date().getFullYear()}:\n\n${leaveInfo}\n\nWould you like to apply for leave?`,
    data: result.rows,
    suggestions: ['Apply for leave', 'View leave history', 'Leave policies'],
  };
}

async function handleAttendanceQuery(message, context) {
  if (!context?.employee_id) {
    return { message: "I couldn't find your employee profile. Please contact HR." };
  }

  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();

  const result = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('present', 'late')) as present,
      COUNT(*) FILTER (WHERE status = 'absent') as absent,
      COUNT(*) FILTER (WHERE status = 'late') as late,
      SUM(COALESCE(overtime_hours, 0)) as overtime
    FROM attendance
    WHERE employee_id = $1
      AND EXTRACT(MONTH FROM date) = $2
      AND EXTRACT(YEAR FROM date) = $3
  `, [context.employee_id, month, year]);

  const stats = result.rows[0];

  return {
    message: `Hi ${context.first_name}! Here's your attendance summary for this month:\n\n• Present days: ${stats.present || 0}\n• Absent days: ${stats.absent || 0}\n• Late arrivals: ${stats.late || 0}\n• Overtime hours: ${parseFloat(stats.overtime || 0).toFixed(1)}`,
    data: stats,
    suggestions: ['Mark attendance', 'View attendance history', 'Overtime details'],
  };
}

async function handleTaxQuery(message, context) {
  const taxInfo = `**Pakistani Income Tax Information (Tax Year 2024-25)**\n\nFor Salaried Individuals (Filers):\n• Up to PKR 600,000: 0%\n• PKR 600,001 - 1,200,000: 2.5%\n• PKR 1,200,001 - 2,200,000: 12.5% (+ PKR 15,000)\n• PKR 2,200,001 - 3,200,000: 22.5% (+ PKR 140,000)\n• PKR 3,200,001 - 4,100,000: 27.5% (+ PKR 365,000)\n• Above PKR 4,100,000: 35% (+ PKR 612,500)\n\n💡 Non-filers pay approximately 10% higher tax rates.`;

  return {
    message: taxInfo,
    suggestions: ['Calculate my tax', 'Am I a filer?', 'How to become a filer'],
  };
}

async function handlePayslipQuery(message, context) {
  if (!context?.employee_id) {
    return { message: "I couldn't find your employee profile. Please contact HR." };
  }

  const result = await db.query(`
    SELECT month, year, gross_salary, total_deductions, net_salary
    FROM payslips
    WHERE employee_id = $1
    ORDER BY year DESC, month DESC
    LIMIT 1
  `, [context.employee_id]);

  if (result.rows.length === 0) {
    return { message: 'No payslips found. Your first payslip will be generated at the end of the payroll cycle.' };
  }

  const slip = result.rows[0];
  return {
    message: `Hi ${context.first_name}! Here's your latest payslip (${slip.month}/${slip.year}):\n\n• Gross Salary: PKR ${parseFloat(slip.gross_salary).toLocaleString()}\n• Deductions: PKR ${parseFloat(slip.total_deductions).toLocaleString()}\n• Net Salary: PKR ${parseFloat(slip.net_salary).toLocaleString()}`,
    data: slip,
    suggestions: ['Download payslip', 'Explain deductions', 'View all payslips'],
  };
}

async function handlePolicyQuery(message, context) {
  return {
    message: `Here are some common HR policies I can help you with:\n\n• **Leave Policy**: Annual leave (14 days), Sick leave (10 days), Casual leave (10 days)\n• **Attendance**: Work hours 9 AM - 6 PM, Grace period 15 minutes\n• **Overtime**: 1.5x hourly rate after 8 hours\n• **Tax Filing**: Employees encouraged to become filers for lower tax rates\n\nWhich policy would you like more details on?`,
    suggestions: ['Leave policy', 'Attendance rules', 'Tax benefits'],
  };
}

async function handleGreeting(message, context) {
  const name = context?.first_name || 'there';
  const greeting = getTimeBasedGreeting();

  return {
    message: `${greeting}, ${name}! I'm your PayrollX HR Assistant. I can help you with:\n\n• Salary and payslip inquiries\n• Leave balance and applications\n• Attendance information\n• Tax calculations\n• HR policies\n\nWhat would you like to know?`,
    suggestions: ['Check my salary', 'Leave balance', 'Tax information'],
  };
}

async function handleHelp(message, context) {
  return {
    message: `I'm PayrollX HR Assistant! Here's what I can help you with:\n\n🔹 **Salary**: Check your salary, view payslips, understand deductions\n🔹 **Leave**: View balance, apply for leave, check leave policies\n🔹 **Attendance**: Check attendance records, overtime hours\n🔹 **Tax**: Understand tax slabs, calculate tax, filer benefits\n🔹 **Policies**: HR policies, procedures, guidelines\n\nJust type your question naturally, and I'll do my best to help!`,
    suggestions: ['Check salary', 'Leave balance', 'Tax info', 'Policies'],
  };
}

async function handleUnknown(message, context) {
  return {
    message: "I'm not sure I understood that. Could you please rephrase your question? You can ask me about:\n\n• Salary and payslips\n• Leave balance\n• Attendance\n• Tax information\n• HR policies",
    suggestions: ['Check my salary', 'Leave balance', 'Help'],
  };
}

// Helper functions

function getTimeBasedGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getDefaultSuggestions() {
  return ['Check salary', 'Leave balance', 'Attendance', 'Help'];
}

async function saveMessage(sessionId, role, content, intent) {
  await db.query(`
    INSERT INTO chatbot_messages (session_id, role, content, intent)
    VALUES ($1, $2, $3, $4)
  `, [sessionId, role, content, intent]);
}

/**
 * Get chat history
 */
const getChatHistory = async (sessionId) => {
  const result = await db.query(`
    SELECT role, content, created_at
    FROM chatbot_messages
    WHERE session_id = $1
    ORDER BY created_at ASC
  `, [sessionId]);

  return result.rows.map(row => ({
    role: row.role,
    content: row.content,
    timestamp: row.created_at,
  }));
};

module.exports = {
  processMessage,
  classifyIntent,
  getChatHistory,
};
