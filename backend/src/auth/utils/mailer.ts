import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { config } from '@/config';
import { logger } from '@/utils/logger';

// Use Resend as primary email service (more reliable than SMTP)
let resendClient: Resend | null = null;
if (config.email.resend.apiKey && config.email.resend.apiKey !== 're_placeholder') {
  resendClient = new Resend(config.email.resend.apiKey);
}

// Fallback to SMTP if Resend is not configured
const transporter = nodemailer.createTransport({
  host: config.email.smtp.host,
  port: config.email.smtp.port,
  secure: config.email.smtp.port === 465,
  auth: {
    user: config.email.smtp.user,
    pass: config.email.smtp.pass,
  },
});

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    // Try Resend first
    if (resendClient) {
      try {
        const { data, error } = await resendClient.emails.send({
          from: config.email.smtp.from,
          to,
          subject,
          html,
        });

        if (error) {
          throw error;
        }

        logger.info({ to, subject, messageId: data?.id }, 'Email sent via Resend');
        return;
      } catch (resendError) {
        logger.warn({ err: resendError, to, subject }, 'Resend failed, trying SMTP fallback');
      }
    }

    // Fallback to SMTP
    if (config.email.smtp.host) {
      const message = {
        from: config.email.smtp.from,
        to,
        subject,
        html,
      };

      await transporter.sendMail(message);
      logger.info({ to, subject }, 'Email sent via SMTP');
      return;
    }

    logger.warn({ to, subject }, 'No email service configured (Resend or SMTP)');
  } catch (err) {
    logger.warn({ err, to, subject }, 'Email sending failed (non-blocking)');
    // Don't throw - email failures shouldn't block registration
  }
}
