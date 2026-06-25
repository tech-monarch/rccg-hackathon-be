/**
 * Internal API — used exclusively by the WhatsApp bot.
 * Protected by INTERNAL_API_KEY (X-Internal-Key header).
 * All routes return plain JSON shaped for easy bot consumption.
 */
import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../../config/database';
import { sendSuccess, sendError } from '../../utils/response';
import { calculatePoints } from '../../utils/helpers';

const router = Router();

// ─── Helper ───────────────────────────────────────────────────────────────────
const wrap = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

// ─── Resolve user by phone number ─────────────────────────────────────────────
// Bot calls this first thing to identify who is messaging.
// Strips leading + and 0-prefix to normalise Nigerian numbers.
router.post('/resolve-user', wrap(async (req, res) => {
  let { phone } = req.body as { phone: string };
  if (!phone) { sendError(res, 'phone is required', 400); return; }

  // Normalize: remove spaces/dashes, strip leading +
  phone = phone.replace(/[\s\-()]/g, '').replace(/^\+/, '');
  // Nigerian number: leading 0 → 234
  const variants = new Set([phone]);
  if (phone.startsWith('234')) variants.add('0' + phone.slice(3));
  if (phone.startsWith('0'))   variants.add('234' + phone.slice(1));
  // Also try without country code
  if (phone.length > 10) variants.add(phone.slice(-10));

  const phoneArr = Array.from(variants);

  // Search Customer first
  const customer = await prisma.customer.findFirst({
    where: { phone: { in: phoneArr } },
    select: {
      id: true, fullName: true, phone: true, avatarUrl: true, totalPoints: true, address: true,
      user: { select: { id: true, email: true, isActive: true } },
    },
  });

  if (customer) {
    if (!customer.user.isActive) { sendError(res, 'Account suspended', 403); return; }
    sendSuccess(res, {
      role: 'CUSTOMER',
      userId: customer.user.id,
      profileId: customer.id,
      name: customer.fullName,
      email: customer.user.email,
      phone: customer.phone,
      totalPoints: customer.totalPoints,
    });
    return;
  }

  // Search Provider
  const provider = await prisma.provider.findFirst({
    where: { phone: { in: phoneArr } },
    select: {
      id: true, businessName: true, ownerName: true, phone: true,
      category: true, location: true, avgRating: true, isPublished: true,
      user: { select: { id: true, email: true, isActive: true } },
    },
  });

  if (provider) {
    if (!provider.user.isActive) { sendError(res, 'Account suspended', 403); return; }
    sendSuccess(res, {
      role: 'PROVIDER',
      userId: provider.user.id,
      profileId: provider.id,
      name: provider.businessName,
      ownerName: provider.ownerName,
      email: provider.user.email,
      phone: provider.phone,
      category: provider.category,
      location: provider.location,
    });
    return;
  }

  sendError(res, 'User not found', 404);
}));

// ─── CUSTOMER routes ──────────────────────────────────────────────────────────

// List customer's active service requests
router.get('/customer/:id/requests', wrap(async (req, res) => {
  const requests = await prisma.serviceRequest.findMany({
    where: {
      customerId: req.params.id,
      status: { notIn: ['COMPLETED', 'CANCELLED'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      bookings: {
        where: { status: { notIn: ['CANCELLED'] } },
        include: { provider: { select: { businessName: true, phone: true, category: true } } },
        take: 1,
      },
    },
  });
  sendSuccess(res, requests);
}));

// List customer's bookings
router.get('/customer/:id/bookings', wrap(async (req, res) => {
  const { status } = req.query as { status?: string };
  const bookings = await prisma.booking.findMany({
    where: {
      customerId: req.params.id,
      ...(status ? { status: status.toUpperCase() as any } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      provider: { select: { businessName: true, phone: true, category: true, location: true } },
      serviceRequest: { select: { category: true, description: true, address: true, preferredDate: true } },
      payment: { select: { status: true } },
    },
  });
  sendSuccess(res, bookings);
}));

// Get customer profile + points
router.get('/customer/:id/profile', wrap(async (req, res) => {
  const customer = await prisma.customer.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { email: true } } },
  });
  if (!customer) { sendError(res, 'Not found', 404); return; }
  sendSuccess(res, customer);
}));

// Create service request
router.post('/service-requests', wrap(async (req, res) => {
  const { customerId, category, description, address, preferredDate, preferredTime, urgency } = req.body;
  if (!customerId || !category || !description || !address || !preferredDate || !preferredTime) {
    sendError(res, 'Missing required fields', 400); return;
  }
  const request = await prisma.serviceRequest.create({
    data: {
      customerId,
      category,
      description,
      address,
      preferredDate: new Date(preferredDate),
      preferredTime,
      urgency: (urgency ?? 'STANDARD').toUpperCase() as any,
    },
  });
  sendSuccess(res, request, 201);
}));

// Get quotes for a service request (returns matching providers)
router.get('/service-requests/:id/quotes', wrap(async (req, res) => {
  const request = await prisma.serviceRequest.findUnique({ where: { id: req.params.id } });
  if (!request) { sendError(res, 'Not found', 404); return; }

  const urgencyMultiplier =
    request.urgency === 'EMERGENCY' ? 1.5 :
    request.urgency === 'URGENT'    ? 1.2 : 1.0;

  const providers = await prisma.provider.findMany({
    where: { category: { equals: request.category, mode: 'insensitive' }, isPublished: true },
    orderBy: { avgRating: 'desc' },
    take: 5,
    select: {
      id: true, businessName: true, ownerName: true, phone: true,
      category: true, location: true, avgRating: true, totalReviews: true,
    },
  });

  const quotes = providers.map(p => ({
    providerId: p.id,
    businessName: p.businessName,
    ownerName: p.ownerName,
    phone: p.phone,
    category: p.category,
    location: p.location,
    avgRating: p.avgRating,
    totalReviews: p.totalReviews,
    estimatedPrice: Math.round(5000 * urgencyMultiplier),
  }));

  sendSuccess(res, quotes);
}));

// Create booking
router.post('/bookings', wrap(async (req, res) => {
  const { customerId, serviceRequestId, providerId, scheduledAt, amount = 5000 } = req.body;
  if (!customerId || !serviceRequestId || !providerId || !scheduledAt) {
    sendError(res, 'Missing required fields', 400); return;
  }

  const existing = await prisma.booking.findFirst({
    where: { serviceRequestId, status: { notIn: ['CANCELLED'] } },
  });
  if (existing) { sendError(res, 'Request already booked', 409); return; }

  const booking = await prisma.booking.create({
    data: {
      serviceRequestId, customerId, providerId,
      amount, scheduledAt: new Date(scheduledAt),
      status: 'PENDING_PAYMENT',
    },
    include: {
      provider: { select: { businessName: true, phone: true } },
    },
  });

  await prisma.serviceRequest.update({
    where: { id: serviceRequestId },
    data: { status: 'BOOKED' },
  });

  sendSuccess(res, booking, 201);
}));

// Get single booking
router.get('/bookings/:id', wrap(async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id },
    include: {
      provider: { select: { businessName: true, phone: true, category: true, location: true } },
      serviceRequest: { select: { category: true, description: true, address: true, preferredDate: true, urgency: true } },
      payment: { select: { status: true, paidAt: true } },
    },
  });
  if (!booking) { sendError(res, 'Not found', 404); return; }
  sendSuccess(res, booking);
}));

// Cancel booking
router.post('/bookings/:id/cancel', wrap(async (req, res) => {
  const { requesterId, requesterRole } = req.body;
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking) { sendError(res, 'Not found', 404); return; }

  // Validate authorization
  if (requesterRole === 'CUSTOMER' && booking.customerId !== requesterId) {
    sendError(res, 'Not authorized', 403); return;
  }
  if (requesterRole === 'PROVIDER' && booking.providerId !== requesterId) {
    sendError(res, 'Not authorized', 403); return;
  }

  if (['COMPLETED', 'CANCELLED'].includes(booking.status)) {
    sendError(res, `Cannot cancel a ${booking.status.toLowerCase()} booking`, 400); return;
  }

  await prisma.$transaction([
    prisma.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } }),
    prisma.serviceRequest.update({ where: { id: booking.serviceRequestId }, data: { status: 'CANCELLED' } }),
  ]);

  sendSuccess(res, { message: 'Booking cancelled' });
}));

// ─── PROVIDER routes ──────────────────────────────────────────────────────────

// List provider's jobs
router.get('/provider/:id/jobs', wrap(async (req, res) => {
  const { status } = req.query as { status?: string };
  const bookings = await prisma.booking.findMany({
    where: {
      providerId: req.params.id,
      ...(status ? { status: status.toUpperCase() as any } : {}),
    },
    orderBy: { scheduledAt: 'asc' },
    take: 20,
    include: {
      customer: { select: { fullName: true, phone: true } },
      serviceRequest: { select: { category: true, description: true, address: true, preferredDate: true, urgency: true } },
    },
  });
  sendSuccess(res, bookings);
}));

// Provider marks job complete
router.post('/provider/:id/jobs/:bookingId/complete', wrap(async (req, res) => {
  const { id: providerId, bookingId } = req.params;

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking)                       { sendError(res, 'Not found', 404); return; }
  if (booking.providerId !== providerId) { sendError(res, 'Not authorized', 403); return; }
  if (booking.status === 'COMPLETED') { sendError(res, 'Already completed', 400); return; }
  if (!['PAID', 'IN_PROGRESS'].includes(booking.status)) {
    sendError(res, 'Booking must be PAID or IN_PROGRESS to complete', 400); return;
  }

  const pointsToAward = calculatePoints(Number(booking.amount));

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'COMPLETED', completedAt: new Date(), pointsAwarded: pointsToAward },
    }),
    prisma.customer.update({
      where: { id: booking.customerId },
      data: { totalPoints: { increment: pointsToAward } },
    }),
    prisma.pointsTransaction.create({
      data: {
        customerId: booking.customerId,
        type: 'EARNED',
        amount: pointsToAward,
        bookingId,
        description: `Service completed – ${pointsToAward} points awarded`,
      },
    }),
    prisma.serviceRequest.update({
      where: { id: booking.serviceRequestId },
      data: { status: 'COMPLETED' },
    }),
  ]);

  sendSuccess(res, { message: 'Job marked complete', pointsAwarded: pointsToAward });
}));

// Mark job as in-progress
router.post('/provider/:id/jobs/:bookingId/start', wrap(async (req, res) => {
  const { id: providerId, bookingId } = req.params;
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking)                          { sendError(res, 'Not found', 404); return; }
  if (booking.providerId !== providerId) { sendError(res, 'Not authorized', 403); return; }
  if (booking.status !== 'PAID')         { sendError(res, 'Booking must be PAID to start', 400); return; }

  await prisma.booking.update({ where: { id: bookingId }, data: { status: 'IN_PROGRESS' } });
  sendSuccess(res, { message: 'Job marked as in progress' });
}));

// Provider profile
router.get('/provider/:id/profile', wrap(async (req, res) => {
  const provider = await prisma.provider.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { email: true } } },
  });
  if (!provider) { sendError(res, 'Not found', 404); return; }
  sendSuccess(res, provider);
}));

// Provider's inquiries
router.get('/provider/:id/inquiries', wrap(async (req, res) => {
  const inquiries = await prisma.inquiry.findMany({
    where: { providerId: req.params.id, status: 'NEW' },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { customer: { select: { fullName: true, phone: true } } },
  });
  sendSuccess(res, inquiries);
}));

// Search providers (for customer)
router.get('/providers', wrap(async (req, res) => {
  const { category, location, limit = '5' } = req.query as Record<string, string>;
  const providers = await prisma.provider.findMany({
    where: {
      isPublished: true,
      ...(category ? { category: { equals: category, mode: 'insensitive' } } : {}),
      ...(location ? { location: { contains: location, mode: 'insensitive' } } : {}),
    },
    orderBy: { avgRating: 'desc' },
    take: Math.min(parseInt(limit, 10) || 5, 10),
    select: {
      id: true, businessName: true, ownerName: true, phone: true,
      category: true, location: true, avgRating: true, totalReviews: true, description: true,
    },
  });
  sendSuccess(res, providers);
}));

export default router;
