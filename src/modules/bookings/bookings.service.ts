import prisma from '../../config/database';
import { config } from '../../config';
import { calculatePoints } from '../../utils/helpers';
import { sendEmail, emailTemplates } from '../../utils/email';

const PAYSTACK_BASE = 'https://api.paystack.co';

const paystackHeaders = () => ({
  Authorization: `Bearer ${config.paystack.secretKey}`,
  'Content-Type': 'application/json',
});

export const createBooking = async (
  customerId: string,
  data: { serviceRequestId: string; providerId: string; scheduledAt: string; amount?: number }
) => {
  const { serviceRequestId, providerId, scheduledAt, amount = 5000 } = data;

  // Validate service request belongs to customer
  const serviceRequest = await prisma.serviceRequest.findUnique({ where: { id: serviceRequestId } });
  if (!serviceRequest) throw Object.assign(new Error('Service request not found'), { statusCode: 404 });
  if (serviceRequest.customerId !== customerId) throw Object.assign(new Error('Not authorized'), { statusCode: 403 });

  // Validate provider exists
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    include: { user: { select: { email: true } } },
  });
  if (!provider) throw Object.assign(new Error('Provider not found'), { statusCode: 404 });

  // Check not already booked
  const existing = await prisma.booking.findFirst({
    where: { serviceRequestId, status: { notIn: ['CANCELLED'] } },
  });
  if (existing) throw Object.assign(new Error('This request is already booked'), { statusCode: 409 });

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { user: { select: { email: true } } },
  });

  // Create booking
  const booking = await prisma.booking.create({
    data: {
      serviceRequestId,
      customerId,
      providerId,
      amount,
      scheduledAt: new Date(scheduledAt),
      status: 'PENDING_PAYMENT',
    },
  });

  // Update service request status
  await prisma.serviceRequest.update({ where: { id: serviceRequestId }, data: { status: 'BOOKED' } });

  // Initialize Paystack payment
  let paystackData: any = null;
  if (config.paystack.secretKey && config.paystack.secretKey !== 'sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
    try {
      const paystackRes = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
        method: 'POST',
        headers: paystackHeaders(),
        body: JSON.stringify({
          email: customer!.user.email,
          amount: amount * 100, // Paystack uses kobo
          reference: `HAVEN-${booking.id}`,
          metadata: { bookingId: booking.id, customerId, providerId },
          callback_url: `${config.frontendUrl}/booking/confirm?bookingId=${booking.id}`,
        }),
      });
      const json = await paystackRes.json() as any;
      if (json.status) paystackData = json.data;
    } catch (err) {
      console.error('[Paystack] Init error:', err);
    }
  }

  return { booking, paystackAuthorizationUrl: paystackData?.authorization_url ?? null, paystackReference: paystackData?.reference ?? null };
};

export const handlePaystackWebhook = async (event: any) => {
  if (event.event !== 'charge.success') return;

  const reference = event.data.reference as string;
  const bookingId = reference.replace('HAVEN-', '');

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: { include: { user: { select: { email: true } } } },
      provider: true,
    },
  });
  if (!booking) return;

  await prisma.$transaction([
    prisma.booking.update({ where: { id: bookingId }, data: { status: 'PAID' } }),
    prisma.payment.create({
      data: {
        bookingId,
        customerId: booking.customerId,
        amount: booking.amount,
        gateway: 'paystack',
        gatewayReference: reference,
        status: 'SUCCESS',
        paidAt: new Date(),
      },
    }),
    prisma.serviceRequest.update({ where: { id: booking.serviceRequestId }, data: { status: 'BOOKED' } }),
  ]);

  // Send confirmation email
  await sendEmail({
    to: booking.customer.user.email,
    ...emailTemplates.bookingConfirmed(
      booking.customer.fullName,
      booking.provider.businessName,
      booking.scheduledAt
    ),
  });
};

export const completeBooking = async (providerId: string, bookingId: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true },
  });
  if (!booking) throw Object.assign(new Error('Booking not found'), { statusCode: 404 });
  if (booking.providerId !== providerId) throw Object.assign(new Error('Not authorized'), { statusCode: 403 });
  if (booking.status === 'COMPLETED') throw Object.assign(new Error('Booking already completed'), { statusCode: 400 });

  const pointsToAward = calculatePoints(Number(booking.amount));

  const [updatedBooking] = await prisma.$transaction([
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
    prisma.serviceRequest.update({ where: { id: booking.serviceRequestId }, data: { status: 'COMPLETED' } }),
  ]);

  return { booking: updatedBooking, pointsAwarded: pointsToAward };
};

export const getBookingById = async (id: string) => {
  return prisma.booking.findUnique({
    where: { id },
    include: {
      provider: { select: { businessName: true, category: true, phone: true } },
      serviceRequest: true,
      payment: true,
      review: true,
    },
  });
};
