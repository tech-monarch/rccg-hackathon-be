import prisma from '../../config/database';
import { config } from '../../config';
import { calculatePoints } from '../../utils/helpers';
import { sendEmail, emailTemplates } from '../../utils/email';
import { sendWhatsAppMessage, waTemplates } from '../../utils/whatsapp';

const PAYSTACK_BASE = 'https://api.paystack.co';
import crypto from 'crypto';

const paystackHeaders = () => ({
  Authorization: `Bearer ${config.paystack.secretKey}`,
  'Content-Type': 'application/json',
});

export const createBooking = async (
  customerId: string,
  data: { serviceRequestId: string; providerId: string; scheduledAt: string; amount?: number }
) => {
  const { serviceRequestId, providerId, scheduledAt, amount = 5000 } = data;

  const serviceRequest = await prisma.serviceRequest.findUnique({ where: { id: serviceRequestId } });
  if (!serviceRequest) throw Object.assign(new Error('Service request not found'), { statusCode: 404 });
  if (serviceRequest.customerId !== customerId) throw Object.assign(new Error('Not authorized'), { statusCode: 403 });

  const [provider, customer, existing] = await Promise.all([
    prisma.provider.findUnique({
      where: { id: providerId },
      include: { user: { select: { email: true } } },
    }),
    prisma.customer.findUnique({
      where: { id: customerId },
      include: { user: { select: { email: true } } },
    }),
    prisma.booking.findFirst({
      where: { serviceRequestId, status: { notIn: ['CANCELLED'] } },
    }),
  ]);

  if (!provider) throw Object.assign(new Error('Provider not found'), { statusCode: 404 });
  if (existing) throw Object.assign(new Error('This request is already booked'), { statusCode: 409 });

  const booking = await prisma.booking.create({
    data: { serviceRequestId, customerId, providerId, amount, scheduledAt: new Date(scheduledAt), status: 'PENDING_PAYMENT' },
  });

  await prisma.serviceRequest.update({ where: { id: serviceRequestId }, data: { status: 'BOOKED' } });

  // Paystack init
  let paystackData: any = null;
  if (config.paystack.secretKey && config.paystack.secretKey !== 'sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
    try {
      const paystackRes = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
        method: 'POST',
        headers: paystackHeaders(),
        body: JSON.stringify({
          email: customer!.user.email,
          amount: amount * 100,
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

  // Notify provider via WhatsApp (fire-and-forget)
  if (provider.phone && customer) {
    sendWhatsAppMessage(
      provider.phone,
      waTemplates.bookingCreated(
        provider.businessName,
        customer.fullName,
        serviceRequest.category,
        new Date(scheduledAt)
      )
    );
  }

  return {
    booking,
    paystackAuthorizationUrl: paystackData?.authorization_url ?? null,
    paystackReference: paystackData?.reference ?? null,
  };
};

export const handlePaystackWebhook = async (rawBody: Buffer, signature: string, event: any) => {
  // Verify Paystack webhook signature (HMAC SHA-512)
  if (config.paystack.webhookSecret) {
    const hash = crypto
      .createHmac('sha512', config.paystack.webhookSecret)
      .update(rawBody)
      .digest('hex');
    if (hash !== signature) {
      throw Object.assign(new Error('Invalid webhook signature'), { statusCode: 401 });
    }
  }

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

  // Email confirmation
  sendEmail({
    to: booking.customer.user.email,
    ...emailTemplates.bookingConfirmed(booking.customer.fullName, booking.provider.businessName, booking.scheduledAt),
  }).catch(() => {});

  // WhatsApp notification to customer and provider
  sendWhatsAppMessage(
    booking.customer.phone,
    waTemplates.paymentConfirmed(
      booking.customer.fullName,
      booking.provider.businessName,
      Number(booking.amount),
      booking.scheduledAt
    )
  );
};

export const completeBooking = async (providerId: string, bookingId: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: true,
      provider: { select: { businessName: true } },
    },
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

  // WhatsApp notification to customer
  sendWhatsAppMessage(
    booking.customer.phone,
    waTemplates.jobCompleted(booking.customer.fullName, booking.provider.businessName, pointsToAward)
  );

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

// List provider's bookings (missing route in original)
export const getProviderBookings = async (providerId: string, status?: string) => {
  return prisma.booking.findMany({
    where: {
      providerId,
      ...(status ? { status: status.toUpperCase() as any } : {}),
    },
    orderBy: { scheduledAt: 'asc' },
    include: {
      customer: { select: { fullName: true, phone: true } },
      serviceRequest: { select: { category: true, description: true, address: true, preferredDate: true } },
    },
  });
};
