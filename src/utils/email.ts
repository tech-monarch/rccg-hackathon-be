/**
 * Email utility — supports both Resend (preferred) and SMTP (nodemailer fallback).
 *
 * FIX: The original code declared a Resend API key in config but only ever used
 * nodemailer. If RESEND_API_KEY is set, we now use the Resend HTTP API directly
 * (no extra package needed — it's a simple fetch call). SMTP is the fallback.
 */
import nodemailer from 'nodemailer';
import { config } from '../config';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

// ── Resend (preferred when configured) ────────────────────────────────────────

async function sendViaResend(options: EmailOptions): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.email.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    `${config.email.fromName} <${config.email.from}>`,
      to:      [options.to],
      subject: options.subject,
      html:    options.html,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

// ── SMTP / nodemailer fallback ─────────────────────────────────────────────────

const getTransporter = () => {
  if (config.email.smtpHost && config.email.smtpUser) {
    return nodemailer.createTransport({
      host:   config.email.smtpHost,
      port:   config.email.smtpPort,
      secure: config.email.smtpPort === 465,
      auth:   { user: config.email.smtpUser, pass: config.email.smtpPass },
    });
  }
  // Ethereal test account for development (messages visible at ethereal.email)
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: { user: 'ethereal_test@ethereal.email', pass: 'ethereal_test_pass' },
  });
};

// ── Public API ─────────────────────────────────────────────────────────────────

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    if (config.email.resendApiKey) {
      await sendViaResend(options);
    } else {
      const transporter = getTransporter();
      const info = await transporter.sendMail({
        from:    `"${config.email.fromName}" <${config.email.from}>`,
        to:      options.to,
        subject: options.subject,
        html:    options.html,
      });
      if (config.isDev) {
        console.log(`[Email] Preview: ${nodemailer.getTestMessageUrl(info)}`);
      }
    }
  } catch (err) {
    console.error('[Email] Failed to send:', err);
    // Never throw — email failure must not break the API response
  }
};

// ── Email templates ────────────────────────────────────────────────────────────

export const emailTemplates = {
  welcome: (name: string) => ({
    subject: 'Welcome to Haven!',
    html: `<h2>Welcome to Haven, ${name}! 🎉</h2><p>Your account is ready. Connect with trusted service providers across Nigeria.</p><p>— The Haven Team</p>`,
  }),

  passwordReset: (name: string, resetLink: string) => ({
    subject: 'Reset your Haven password',
    html: `<h2>Hi ${name},</h2><p>Reset your password: <a href="${resetLink}">Reset Password</a></p><p>Expires in 1 hour.</p><p>— The Haven Team</p>`,
  }),

  bookingConfirmed: (customerName: string, providerName: string, scheduledAt: Date) => ({
    subject: 'Your Haven booking is confirmed',
    html: `<h2>Booking Confirmed! ✅</h2><p>Hi <strong>${customerName}</strong>, your booking with <strong>${providerName}</strong> is confirmed. Scheduled: ${scheduledAt.toLocaleString('en-NG')}</p><p>— The Haven Team</p>`,
  }),

  newInquiry: (providerName: string, customerName: string, service: string) => ({
    subject: `New inquiry from ${customerName}`,
    html: `<h2>New Inquiry 📨</h2><p>Hi <strong>${providerName}</strong>, <strong>${customerName}</strong> sent an inquiry about: <strong>${service}</strong>. Log in to respond.</p><p>— The Haven Team</p>`,
  }),

  reviewReceived: (providerName: string, customerName: string, rating: number) => ({
    subject: `You received a ${rating}-star review`,
    html: `<h2>New Review ⭐</h2><p>Hi <strong>${providerName}</strong>, <strong>${customerName}</strong> left you a <strong>${rating}-star review</strong>. Log in to see it and reply.</p><p>— The Haven Team</p>`,
  }),
};
