// ─── reviews.service.ts ──────────────────────────────────────────────────────
import prisma from '../../config/database';
import { sendEmail, emailTemplates } from '../../utils/email';

export const createReview = async (customerId: string, bookingId: string, data: { rating: number; comment?: string }) => {
  if (data.rating < 1 || data.rating > 5) throw Object.assign(new Error('Rating must be between 1 and 5'), { statusCode: 400 });

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { provider: { include: { user: { select: { email: true } } } } },
  });
  if (!booking) throw Object.assign(new Error('Booking not found'), { statusCode: 404 });
  if (booking.customerId !== customerId) throw Object.assign(new Error('Not authorized'), { statusCode: 403 });
  if (booking.status !== 'COMPLETED') throw Object.assign(new Error('Can only review completed bookings'), { statusCode: 400 });

  const existing = await prisma.review.findUnique({ where: { bookingId } });
  if (existing) throw Object.assign(new Error('Already reviewed this booking'), { statusCode: 409 });

  const review = await prisma.review.create({
    data: {
      bookingId,
      customerId,
      providerId: booking.providerId,
      rating: data.rating,
      comment: data.comment,
    },
    include: { customer: { select: { fullName: true } } },
  });

  // Recalculate provider average rating
  const stats = await prisma.review.aggregate({
    where: { providerId: booking.providerId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await prisma.provider.update({
    where: { id: booking.providerId },
    data: {
      avgRating: stats._avg.rating ?? 0,
      totalReviews: stats._count.rating,
    },
  });

  // Notify provider
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  await sendEmail({
    to: booking.provider.user.email,
    ...emailTemplates.reviewReceived(booking.provider.businessName, customer!.fullName, data.rating),
  });

  return review;
};
