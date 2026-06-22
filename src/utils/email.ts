import nodemailer from 'nodemailer';
import { config } from '../config';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

const getTransporter = () => {
  // If SMTP configured, use it; otherwise use a test account in dev
  if (config.email.smtpHost && config.email.smtpUser) {
    return nodemailer.createTransport({
      host: config.email.smtpHost,
      port: config.email.smtpPort,
      secure: config.email.smtpPort === 465,
      auth: {
        user: config.email.smtpUser,
        pass: config.email.smtpPass,
      },
    });
  }

  // Ethereal test account for development
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
      user: 'ethereal_test@ethereal.email',
      pass: 'ethereal_test_pass',
    },
  });
};

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: `"${config.email.fromName}" <${config.email.from}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    if (config.isDev) {
      console.log(`[Email] Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }
  } catch (err) {
    console.error('[Email] Failed to send:', err);
    // Don't throw — email failure shouldn't break the API response
  }
};

export const emailTemplates = {
  welcome: (name: string) => ({
    subject: 'Welcome to Haven! 🎉',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h1 style="color:#1E3A5F">Welcome to Haven, ${name}!</h1>
        <p>Your account has been created successfully.</p>
        <p>Haven connects you with trusted local service professionals.</p>
        <p style="color:#6B7280;font-size:12px">© 2026 Haven. All rights reserved.</p>
      </div>
    `,
  }),

  bookingConfirmed: (customerName: string, providerName: string, scheduledAt: Date) => ({
    subject: 'Booking Confirmed – Haven',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1E3A5F">Booking Confirmed!</h2>
        <p>Hi ${customerName},</p>
        <p>Your booking with <strong>${providerName}</strong> has been confirmed.</p>
        <p><strong>Scheduled:</strong> ${scheduledAt.toLocaleString('en-NG')}</p>
        <p>The service provider will reach out to confirm details.</p>
        <p style="color:#6B7280;font-size:12px">© 2026 Haven</p>
      </div>
    `,
  }),

  newInquiry: (providerName: string, customerName: string, service: string) => ({
    subject: `New Inquiry – ${service}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1E3A5F">New Inquiry</h2>
        <p>Hi ${providerName},</p>
        <p><strong>${customerName}</strong> has sent you an inquiry about your <strong>${service}</strong> service.</p>
        <p>Log in to your Haven dashboard to respond.</p>
        <p style="color:#6B7280;font-size:12px">© 2026 Haven</p>
      </div>
    `,
  }),

  passwordReset: (name: string, resetLink: string) => ({
    subject: 'Reset Your Haven Password',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1E3A5F">Password Reset</h2>
        <p>Hi ${name},</p>
        <p>You requested a password reset. Click the button below (valid for 1 hour):</p>
        <a href="${resetLink}" style="display:inline-block;background:#2563EB;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;margin:16px 0">
          Reset Password
        </a>
        <p>If you didn't request this, ignore this email.</p>
        <p style="color:#6B7280;font-size:12px">© 2026 Haven</p>
      </div>
    `,
  }),

  reviewReceived: (providerName: string, customerName: string, rating: number) => ({
    subject: 'New Review Received – Haven',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1E3A5F">New Review</h2>
        <p>Hi ${providerName},</p>
        <p><strong>${customerName}</strong> left you a <strong>${rating}/5</strong> star review.</p>
        <p>Log in to your dashboard to view and respond.</p>
        <p style="color:#6B7280;font-size:12px">© 2026 Haven</p>
      </div>
    `,
  }),
};
