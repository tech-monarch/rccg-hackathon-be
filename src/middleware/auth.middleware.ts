import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { sendError } from '../utils/response';
import { Role } from '@prisma/client';
import prisma from '../config/database';

// ─── Token cache ──────────────────────────────────────────────────────────────
// Each auth middleware call currently hits the DB to verify user.isActive.
// For a JWT-based system, this defeats the point of stateless tokens.
// We cache the user lookup by userId for 30 seconds — this means a newly
// suspended user stays active for at most 30s, which is acceptable.
// The cache is a simple Map bounded to 5000 entries to prevent memory leaks.

const USER_CACHE_TTL_MS = 30_000; // 30 seconds
const USER_CACHE_MAX = 5_000;

interface CachedUser {
  role: Role;
  isActive: boolean;
  customerId?: string;
  providerId?: string;
  expiresAt: number;
}

const userCache = new Map<string, CachedUser>();

function getCachedUser(userId: string): CachedUser | null {
  const entry = userCache.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    userCache.delete(userId);
    return null;
  }
  return entry;
}

function setCachedUser(userId: string, data: Omit<CachedUser, 'expiresAt'>): void {
  // Evict oldest entries if we're at the limit
  if (userCache.size >= USER_CACHE_MAX) {
    const firstKey = userCache.keys().next().value;
    if (firstKey) userCache.delete(firstKey);
  }
  userCache.set(userId, { ...data, expiresAt: Date.now() + USER_CACHE_TTL_MS });
}

/** Call this when a user is suspended/deleted to immediately invalidate their cache */
export function invalidateUserCache(userId: string): void {
  userCache.delete(userId);
}

// ─────────────────────────────────────────────────────────────────────────────

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
    const payload = verifyAccessToken(token); // throws if invalid/expired

    // Try cache first
    let cached = getCachedUser(payload.userId);

    if (!cached) {
      // DB lookup — only on cache miss (once per 30s per user under normal load)
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          role: true,
          isActive: true,
          customer: { select: { id: true } },
          provider: { select: { id: true } },
        },
      });

      if (!user || !user.isActive) {
        sendError(res, 'Account not found or suspended', 401);
        return;
      }

      cached = {
        role: user.role,
        isActive: user.isActive,
        customerId: user.customer?.id,
        providerId: user.provider?.id,
      };
      setCachedUser(payload.userId, cached);
    }

    if (!cached.isActive) {
      sendError(res, 'Account suspended', 401);
      return;
    }

    req.user = {
      userId: payload.userId,
      role: cached.role,
      profileId: cached.customerId ?? cached.providerId,
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
    // silently ignore
  }
  next();
};
