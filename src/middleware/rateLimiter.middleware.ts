import rateLimit from 'express-rate-limit';
import { Request } from 'express';

/**
 * Rate limiters.
 *
 * BUG FIXED: authLimiter previously had no keyGenerator, so all requests from
 * the same IP counted together. On Render/Railway, the bot and frontend share
 * a NAT IP, meaning a few bot registration calls could exhaust the 10-request
 * limit for all users on that IP.
 *
 * FIX: internal routes (identified by X-Internal-Key header) are excluded from
 * the auth rate limiter. They have their own generous limiter instead.
 */

/** Skips rate limiting for internal bot requests */
const skipInternal = (req: Request): boolean =>
  !!req.headers['x-internal-key'];

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  skip: skipInternal,        // ← bot calls bypass this limiter entirely
  message: { success: false, message: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  message: { success: false, message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many uploads. Please wait before uploading more.' },
});

/** Generous limiter for internal bot-only routes (already protected by X-Internal-Key) */
export const internalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { success: false, message: 'Internal rate limit exceeded.' },
  standardHeaders: true,
  legacyHeaders: false,
});
