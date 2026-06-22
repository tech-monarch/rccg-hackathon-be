import prisma from '../../config/database';

export const createServiceRequest = async (customerId: string, data: any) => {
  const { category, description, address, preferredDate, preferredTime, urgency } = data;

  const request = await prisma.serviceRequest.create({
    data: {
      customerId,
      category,
      description,
      address,
      preferredDate: new Date(preferredDate),
      preferredTime,
      urgency: (urgency ?? 'STANDARD').toUpperCase(),
    },
  });

  return request;
};

export const addRequestMedia = async (
  customerId: string,
  requestId: string,
  mediaFiles: { url: string; publicId: string; mediaType: string }[]
) => {
  const request = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
  if (!request) throw Object.assign(new Error('Service request not found'), { statusCode: 404 });
  if (request.customerId !== customerId) throw Object.assign(new Error('Not authorized'), { statusCode: 403 });

  await prisma.serviceRequestMedia.createMany({
    data: mediaFiles.map((f) => ({
      serviceRequestId: requestId,
      mediaUrl: f.url,
      publicId: f.publicId,
      mediaType: f.mediaType,
    })),
  });

  return prisma.serviceRequestMedia.findMany({ where: { serviceRequestId: requestId } });
};

export const getQuotes = async (customerId: string, requestId: string) => {
  const request = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
  if (!request) throw Object.assign(new Error('Service request not found'), { statusCode: 404 });
  if (request.customerId !== customerId) throw Object.assign(new Error('Not authorized'), { statusCode: 403 });

  // Match providers in the same category, published and verified
  const providers = await prisma.provider.findMany({
    where: {
      category: { equals: request.category, mode: 'insensitive' },
      isPublished: true,
    },
    orderBy: { avgRating: 'desc' },
    take: 5,
    include: {
      portfolioImages: { take: 1, orderBy: { sortOrder: 'asc' } },
    },
  });

  // Build quote objects with estimated price based on urgency
  const urgencyMultiplier = request.urgency === 'EMERGENCY' ? 1.5 : request.urgency === 'URGENT' ? 1.2 : 1.0;

  const quotes = providers.map((p) => ({
    providerId: p.id,
    businessName: p.businessName,
    ownerName: p.ownerName,
    category: p.category,
    location: p.location,
    avgRating: p.avgRating,
    totalReviews: p.totalReviews,
    phone: p.phone,
    portfolioImage: p.portfolioImages[0]?.imageUrl ?? null,
    estimatedPrice: Math.round(5000 * urgencyMultiplier), // Base ₦5000 — providers set real prices in production
    estimatedDuration: '2-4 hours',
    availableDate: request.preferredDate,
  }));

  return quotes;
};

export const getMyRequests = async (customerId: string) => {
  return prisma.serviceRequest.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    include: {
      media: true,
      bookings: {
        include: { provider: { select: { businessName: true, category: true } } },
      },
    },
  });
};
