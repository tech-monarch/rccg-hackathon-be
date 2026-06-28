/**
 * Single source of truth for all backend configuration.
 *
 * This is the file that every module imports as `from '../config'` or `from './config'`.
 * src/config/index.ts re-exports from here so the runtime dist/ bundle always gets
 * the same values regardless of which resolution path Node uses.
 */
import dotenv from 'dotenv';
dotenv.config();

const optional = (key: string, fallback = ''): string =>
  process.env[key] ?? fallback;

export const config = {
  port: parseInt(optional('PORT', '3001'), 10),
  nodeEnv: optional('NODE_ENV', 'development'),
  frontendUrl: optional('FRONTEND_URL', 'http://localhost:3000'),

  jwt: {
    accessSecret:  optional('JWT_ACCESS_SECRET',  'dev_access_secret_change_in_production'),
    refreshSecret: optional('JWT_REFRESH_SECRET', 'dev_refresh_secret_change_in_production'),
    accessExpiry:  optional('JWT_ACCESS_EXPIRY',  '15m'),
    refreshExpiry: optional('JWT_REFRESH_EXPIRY', '7d'),
  },

  cloudinary: {
    cloudName: optional('CLOUDINARY_CLOUD_NAME'),
    apiKey:    optional('CLOUDINARY_API_KEY'),
    apiSecret: optional('CLOUDINARY_API_SECRET'),
  },

  paystack: {
    secretKey:     optional('PAYSTACK_SECRET_KEY'),
    publicKey:     optional('PAYSTACK_PUBLIC_KEY'),
    webhookSecret: optional('PAYSTACK_WEBHOOK_SECRET'),
  },

  vtpass: {
    apiKey:    optional('VTPASS_API_KEY'),
    secretKey: optional('VTPASS_SECRET_KEY'),
    baseUrl:   optional('VTPASS_BASE_URL', 'https://sandbox.vtpass.com/api'),
  },

  email: {
    resendApiKey: optional('RESEND_API_KEY'),
    from:         optional('EMAIL_FROM',      'noreply@haven.ng'),
    fromName:     optional('EMAIL_FROM_NAME', 'Haven'),
    smtpHost:     optional('SMTP_HOST'),
    smtpPort:     parseInt(optional('SMTP_PORT', '587'), 10),
    smtpUser:     optional('SMTP_USER'),
    smtpPass:     optional('SMTP_PASS'),
  },

  whatsapp: {
    botNumber:      optional('HAVEN_BOT_WHATSAPP',      '2349017335663'),
    supportNumber:  optional('HAVEN_SUPPORT_WHATSAPP',  '2349017335663'),
    /** URL of the WhatsApp bot's HTTP server (used to send outbound messages) */
    botBaseUrl:     optional('BOT_BASE_URL', 'http://localhost:3000'),
    /** Shared secret for internal bot ↔ backend communication (X-Internal-Key header) */
    internalApiKey: optional('INTERNAL_API_KEY', ''),
  },

  points: {
    redemptionThreshold: parseInt(optional('POINTS_REDEMPTION_THRESHOLD', '5000'), 10),
    airtimeValue:        parseInt(optional('POINTS_AIRTIME_VALUE',        '1000'), 10),
  },

  /**
   * bcrypt rounds. 10 ≈ 80 ms (recommended). 12 ≈ 400 ms (original — too slow).
   * Never go below 8 in production.
   */
  bcryptRounds: parseInt(optional('BCRYPT_ROUNDS', '10'), 10),

  isDev:  optional('NODE_ENV', 'development') === 'development',
  isProd: optional('NODE_ENV', 'development') === 'production',
};
