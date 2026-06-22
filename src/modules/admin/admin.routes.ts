import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/database';
import { sendSuccess, paginateMeta } from '../../utils/response';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { parseIntParam } from '../../utils/helpers';

const router = Router();
router.use(authenticate, requireRole('ADMIN'));

// List all providers (with verification status filter)
router.get('/providers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseIntParam(req.query.page, 1);
    const limit = parseIntParam(req.query.limit, 20);
    const skip = (page - 1) * limit;
    const where: any = {};
    if (req.query.isVerified !== undefined) where.isVerified = req.query.isVerified === 'true';

    const [providers, total] = await Promise.all([
      prisma.provider.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true, createdAt: true } } },
      }),
      prisma.provider.count({ where }),
    ]);
    sendSuccess(res, providers, 200, paginateMeta(page, limit, total));
  } catch (err) { next(err); }
});

// Verify a provider
router.patch('/providers/:id/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isVerified, isPublished } = req.body;
    const provider = await prisma.provider.update({
      where: { id: req.params.id },
      data: {
        ...(isVerified !== undefined && { isVerified }),
        ...(isPublished !== undefined && { isPublished }),
      },
    });
    sendSuccess(res, { provider });
  } catch (err) { next(err); }
});

// List all users
router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseIntParam(req.query.page, 1);
    const limit = parseIntParam(req.query.limit, 20);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip, take: limit, orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, role: true, isActive: true, isVerified: true, createdAt: true,
          customer: { select: { fullName: true, phone: true } },
          provider: { select: { businessName: true, phone: true } },
        },
      }),
      prisma.user.count(),
    ]);
    sendSuccess(res, users, 200, paginateMeta(page, limit, total));
  } catch (err) { next(err); }
});

// Suspend / reactivate a user
router.patch('/users/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: req.body.isActive },
      select: { id: true, email: true, isActive: true },
    });
    sendSuccess(res, { user });
  } catch (err) { next(err); }
});

// Platform stats
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [customers, providers, bookings, completedBookings, revenue] = await Promise.all([
      prisma.customer.count(),
      prisma.provider.count(),
      prisma.booking.count(),
      prisma.booking.count({ where: { status: 'COMPLETED' } }),
      prisma.payment.aggregate({ where: { status: 'SUCCESS' }, _sum: { amount: true } }),
    ]);
    sendSuccess(res, {
      customers, providers, bookings, completedBookings,
      totalRevenue: revenue._sum.amount ?? 0,
    });
  } catch (err) { next(err); }
});

export default router;
