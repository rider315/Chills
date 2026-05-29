const nodemailer = require('nodemailer');

/**
 * Create a Nodemailer transport from SMTP configuration.
 */
function createTransport(smtpConfig) {
  return nodemailer.createTransport({
    host: smtpConfig.host || smtpConfig.smtpHost,
    port: parseInt(smtpConfig.port || smtpConfig.smtpPort, 10) || 587,
    secure: parseInt(smtpConfig.port || smtpConfig.smtpPort, 10) === 465,
    auth: {
      user: smtpConfig.user || smtpConfig.smtpUser,
      pass: smtpConfig.pass || smtpConfig.smtpPass,
    },
  });
}

/**
 * Send an email using the provided transport.
 * @param {object} transport - Nodemailer transport
 * @param {object} options - { from, to, subject, body, attachments? }
 *   attachments is an optional array of { filename, path } objects.
 */
async function sendEmail(transport, { from, to, subject, body, attachments }) {
  try {
    const mailOptions = {
      from,
      to,
      subject,
      text: body,
      html: body.replace(/\n/g, '<br>'),
    };

    // Attach files if provided
    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments.map((a) => ({
        filename: a.filename,
        path: a.path,
      }));
    }

    const info = await transport.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Test SMTP connection by verifying the transport.
 */
async function testConnection(smtpConfig) {
  try {
    const transport = createTransport(smtpConfig);
    await transport.verify();
    transport.close();
    return { success: true, message: 'SMTP connection verified successfully.' };
  } catch (error) {
    return { success: false, message: `SMTP connection failed: ${error.message}` };
  }
}

module.exports = {
  createTransport,
  sendEmail,
  testConnection,
};
