import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { sendError } from '../utils/response';

/**
 * Validates the X-Internal-Key header on all /api/v1/internal/* routes.
 *
 * FIX: Previously read from src/config/index.ts which was missing internalApiKey
 * (it always returned ''). This caused the middleware to fall through to the
 * dev-mode bypass (next()) in development, and return 503 in production.
 * Now that src/config/index.ts re-exports from src/config.ts, INTERNAL_API_KEY
 * is correctly available at config.whatsapp.internalApiKey.
 *
 * IMPORTANT: Set INTERNAL_API_KEY to the same random secret in both .env files
 * (backend and bot). Use: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
export const internalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const key = req.headers['x-internal-key'] as string | undefined;

  if (!config.whatsapp.internalApiKey) {
    if (config.isProd) {
      // Key not configured in production — block everything and log a warning
      console.error('[internalAuth] INTERNAL_API_KEY is not set in production! All bot calls will be blocked.');
      sendError(res, 'Internal API not configured', 503);
      return;
    }
    // Dev mode with no key configured — allow through with a warning
    console.warn('[internalAuth] No INTERNAL_API_KEY set — allowing request in dev mode');
    next();
    return;
  }

  if (!key) {
    sendError(res, 'Missing X-Internal-Key header', 401);
    return;
  }

  if (key !== config.whatsapp.internalApiKey) {
    sendError(res, 'Invalid internal API key', 401);
    return;
  }

  next();
};
