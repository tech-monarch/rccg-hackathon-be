import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { sendError } from '../utils/response';

/**
 * Middleware that validates the INTERNAL_API_KEY header.
 * Used to protect /api/internal/* routes so only the WhatsApp bot
 * (or other trusted internal services) can call them.
 *
 * Header: X-Internal-Key: <value of INTERNAL_API_KEY>
 */
export const internalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const key = req.headers['x-internal-key'] as string | undefined;

  if (!config.whatsapp.internalApiKey) {
    // If no key is configured, block all internal routes in production
    if (config.isProd) {
      sendError(res, 'Internal API not configured', 503);
      return;
    }
    // Allow in dev without key
    next();
    return;
  }

  if (!key || key !== config.whatsapp.internalApiKey) {
    sendError(res, 'Unauthorized', 401);
    return;
  }

  next();
};
