import crypto from 'crypto';

/**
 * Format a Nigerian phone number for wa.me URLs (remove +, spaces, dashes)
 */
export const formatPhoneForWhatsApp = (phone: string): string => {
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
  if (cleaned.startsWith('0')) cleaned = '234' + cleaned.slice(1);
  return cleaned;
};

/**
 * Generate a random reset token
 */
export const generateResetToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Parse integer query param with default
 */
export const parseIntParam = (val: unknown, defaultVal: number): number => {
  const n = parseInt(String(val), 10);
  return isNaN(n) ? defaultVal : n;
};

/**
 * Calculate points to award for a booking based on amount paid
 * ₦1000 = 20 points, ₦5000 = 100 points, etc.
 */
export const calculatePoints = (amountNaira: number): number => {
  return Math.floor(amountNaira / 50);
};
