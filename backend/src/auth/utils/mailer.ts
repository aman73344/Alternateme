import nodemailer from 'nodemailer';
import { config } from '@/config';
import { logger } from '@/utils/logger';

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
  const message = {
    from: config.email.smtp.from,
    to,
    subject,
    html,
  };

  await transporter.sendMail(message);
  logger.info({ to, subject }, 'Email sent');
}
