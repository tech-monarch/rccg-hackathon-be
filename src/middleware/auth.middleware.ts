import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { sendError } from '../utils/response';
import { Role } from '@prisma/client';
import prisma from '../config/database';

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      sendError(res, 'No token provided', 401);
      return;
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);

    // Verify user still active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, isActive: true, customer: { select: { id: true } }, provider: { select: { id: true } } },
    });

    if (!user || !user.isActive) {
      sendError(res, 'Account not found or suspended', 401);
      return;
    }

    req.user = {
      userId: user.id,
      role: user.role,
      profileId: user.customer?.id ?? user.provider?.id,
    };

    next();
  } catch {
    sendError(res, 'Invalid or expired token', 401);
  }
};

export const requireRole = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Not authenticated', 401);
      return;
    }
    if (!roles.includes(req.user.role)) {
      sendError(res, 'Insufficient permissions', 403);
      return;
    }
    next();
  };
};

export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payload = verifyAccessToken(token);
      req.user = { userId: payload.userId, role: payload.role, profileId: payload.profileId };
    }
  } catch {
    // silently ignore invalid token for optional auth
  }
  next();
};
