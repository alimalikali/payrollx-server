/**
 * Email Service
 * Sends transactional emails via SMTP using nodemailer
 */

const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

const getTransporter = () => {
  if (!transporter && config.email.enabled) {
    transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: config.email.user
        ? { user: config.email.user, pass: config.email.pass }
        : undefined,
    });
  }
  return transporter;
};

// --- HTML Templates ---

const baseTemplate = (title, body) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:20px auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e0e0e0;">
    <div style="background:#1a1a2e;padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;">PayrollX</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:18px;">${title}</h2>
      ${body}
    </div>
    <div style="padding:16px 32px;background:#f4f4f7;text-align:center;color:#888;font-size:12px;">
      This is an automated email from PayrollX. Please do not reply.
    </div>
  </div>
</body>
</html>
`;

const templates = {
  leaveApproved: ({ employeeName, leaveType, startDate, endDate }) =>
    ({
      subject: 'Leave Request Approved',
      html: baseTemplate('Leave Approved', `
        <p style="color:#333;line-height:1.6;">Hi <strong>${employeeName}</strong>,</p>
        <p style="color:#333;line-height:1.6;">Your <strong>${leaveType}</strong> request has been <span style="color:#16a34a;font-weight:bold;">approved</span>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px;border:1px solid #e0e0e0;font-weight:bold;">Leave Type</td><td style="padding:8px;border:1px solid #e0e0e0;">${leaveType}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e0e0e0;font-weight:bold;">Start Date</td><td style="padding:8px;border:1px solid #e0e0e0;">${startDate}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e0e0e0;font-weight:bold;">End Date</td><td style="padding:8px;border:1px solid #e0e0e0;">${endDate}</td></tr>
        </table>
      `),
    }),

  leaveRejected: ({ employeeName, leaveType, reason }) =>
    ({
      subject: 'Leave Request Rejected',
      html: baseTemplate('Leave Rejected', `
        <p style="color:#333;line-height:1.6;">Hi <strong>${employeeName}</strong>,</p>
        <p style="color:#333;line-height:1.6;">Your <strong>${leaveType}</strong> request has been <span style="color:#dc2626;font-weight:bold;">rejected</span>.</p>
        ${reason ? `<p style="color:#333;line-height:1.6;"><strong>Reason:</strong> ${reason}</p>` : ''}
      `),
    }),

  salaryCredited: ({ employeeName, month, amount }) =>
    ({
      subject: 'Salary Credited',
      html: baseTemplate('Salary Credited', `
        <p style="color:#333;line-height:1.6;">Hi <strong>${employeeName}</strong>,</p>
        <p style="color:#333;line-height:1.6;">Your salary for <strong>${month}</strong> has been credited.</p>
        <p style="color:#333;line-height:1.6;font-size:24px;font-weight:bold;color:#1a1a2e;">PKR ${amount}</p>
      `),
    }),

  newNoticePosted: ({ title, content, priority, category }) =>
    ({
      subject: `New Notice: ${title}`,
      html: baseTemplate('New Company Notice', `
        <div style="padding:12px;border-left:4px solid ${priority === 'urgent' ? '#dc2626' : priority === 'high' ? '#f97316' : '#3b82f6'};background:#f8f9fa;margin-bottom:16px;">
          <span style="font-size:12px;text-transform:uppercase;color:#666;">${category} &bull; ${priority} priority</span>
          <h3 style="margin:8px 0 4px;color:#1a1a2e;">${title}</h3>
        </div>
        <div style="color:#333;line-height:1.6;">${content}</div>
      `),
    }),

  welcome: ({ employeeName, email, tempPassword }) =>
    ({
      subject: 'Welcome to PayrollX',
      html: baseTemplate('Welcome!', `
        <p style="color:#333;line-height:1.6;">Hi <strong>${employeeName}</strong>,</p>
        <p style="color:#333;line-height:1.6;">Your PayrollX account has been created. Here are your login details:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px;border:1px solid #e0e0e0;font-weight:bold;">Email</td><td style="padding:8px;border:1px solid #e0e0e0;">${email}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e0e0e0;font-weight:bold;">Password</td><td style="padding:8px;border:1px solid #e0e0e0;">${tempPassword}</td></tr>
        </table>
        <p style="color:#dc2626;font-weight:bold;">Please change your password after first login.</p>
      `),
    }),
};

/**
 * Send email (fire-and-forget)
 * @param {Object} params
 * @param {string} params.to - recipient email
 * @param {string} params.template - template name from templates object
 * @param {Object} params.data - template data
 * @returns {Promise<boolean>} true if sent, false otherwise
 */
const sendEmail = async ({ to, template, data }) => {
  if (!config.email.enabled) return false;

  const transport = getTransporter();
  if (!transport) return false;

  const templateFn = templates[template];
  if (!templateFn) {
    console.error(`[Email] Unknown template: ${template}`);
    return false;
  }

  try {
    const { subject, html } = templateFn(data);
    await transport.sendMail({
      from: config.email.from,
      to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error(`[Email] Failed to send to ${to}:`, err.message);
    return false;
  }
};

module.exports = { sendEmail, templates };
