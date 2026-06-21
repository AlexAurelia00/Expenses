import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  port: parseInt(process.env.SMTP_PORT || '2525'),
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

export const sendMail = async ({ to, subject, text, html }) => {
  const mailOptions = {
    from: process.env.SMTP_FROM || 'noreply@splitwiseclone.com',
    to,
    subject,
    text,
    html,
  };

  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log(`[SMTP MOCK] Email would be sent to: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Text: ${text}`);
      return { success: true, mock: true };
    }

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`Email send failed: ${error.message}`);
    // Return success: false, but don't throw to prevent crashing main routes
    return { success: false, error: error.message };
  }
};
