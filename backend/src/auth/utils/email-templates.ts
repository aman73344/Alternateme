import { config } from '@/config';

export function buildWelcomeEmail(name: string, email: string): { subject: string; html: string } {
  return {
    subject: 'Welcome to Alternate Me',
    html: `
      <p>Hi ${name || email},</p>
      <p>Welcome to Alternate Me. Your account is ready and you can start creating your digital twin experience right away.</p>
      <p>If you have any questions, reply to this email and our team will help.</p>
    `,
  };
}

export function buildVerificationEmail(name: string, email: string, token: string): { subject: string; html: string } {
  const verifyUrl = `${config.app.clientUrl}/verify-email?token=${encodeURIComponent(token)}`;
  return {
    subject: 'Verify your Alternate Me email',
    html: `
      <p>Hi ${name || email},</p>
      <p>Thanks for creating an Alternate Me account. Please verify your email by clicking the link below:</p>
      <p><a href="${verifyUrl}">Verify my email</a></p>
      <p>If that does not work, paste this URL into your browser:</p>
      <p>${verifyUrl}</p>
      <p>This link expires in 24 hours.</p>
    `,
  };
}

export function buildPasswordResetEmail(name: string, email: string, token: string): { subject: string; html: string } {
  const resetUrl = `${config.app.clientUrl}/reset-password?token=${encodeURIComponent(token)}`;
  return {
    subject: 'Reset your Alternate Me password',
    html: `
      <p>Hi ${name || email},</p>
      <p>We received a request to reset your password. Click the link below to continue:</p>
      <p><a href="${resetUrl}">Reset my password</a></p>
      <p>This link expires in 1 hour. If you did not request a password reset, you can ignore this email.</p>
    `,
  };
}

export function buildEmailChangedNotification(name: string, email: string): { subject: string; html: string } {
  return {
    subject: 'Your Alternate Me email address was changed',
    html: `
      <p>Hi ${name || email},</p>
      <p>This is a confirmation that your email address on Alternate Me has been updated successfully.</p>
      <p>If you did not authorize this change, please contact support immediately.</p>
    `,
  };
}

export function buildSecurityAlertEmail(name: string, email: string, details: string): { subject: string; html: string } {
  return {
    subject: 'Security alert for your Alternate Me account',
    html: `
      <p>Hi ${name || email},</p>
      <p>We detected a security-related activity on your account:</p>
      <p>${details}</p>
      <p>If this was not you, please sign in immediately and review your active sessions.</p>
    `,
  };
}
