import prisma from '../../config/database';
import { deleteFromCloudinary } from '../../middleware/upload.middleware';
import { parseIntParam } from '../../utils/helpers';

export interface ProviderQueryParams {
  search?: string;
  category?: string;
  location?: string;
  minRating?: string;
  sort?: string;
  page?: string;
  limit?: string;
}

export const listProviders = async (query: ProviderQueryParams) => {
  const page = parseIntParam(query.page, 1);
  const limit = Math.min(parseIntParam(query.limit, 12), 50);
  const skip = (page - 1) * limit;
  const minRating = parseFloat(query.minRating ?? '0') || 0;

  const where: any = {
    isPublished: true,
    ...(query.search && {
      OR: [
        { businessName: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { services: { contains: query.search, mode: 'insensitive' } },
      ],
    }),
    ...(query.category && { category: { equals: query.category, mode: 'insensitive' } }),
    ...(query.location && { location: { contains: query.location, mode: 'insensitive' } }),
    ...(minRating > 0 && { avgRating: { gte: minRating } }),
  };

  const orderBy: any =
    query.sort === 'reviews' ? { totalReviews: 'desc' }
    : query.sort === 'name' ? { businessName: 'asc' }
    : query.sort === 'newest' ? { createdAt: 'desc' }
    : { avgRating: 'desc' };

  const [providers, total] = await Promise.all([
    prisma.provider.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        portfolioImages: { orderBy: { sortOrder: 'asc' }, take: 1 },
        user: { select: { email: true } },
      },
    }),
    prisma.provider.count({ where }),
  ]);

  return { providers, page, limit, total };
};

export const getProviderById = async (id: string) => {
  const provider = await prisma.provider.findUnique({
    where: { id },
    include: {
      portfolioImages: { orderBy: { sortOrder: 'asc' } },
      user: { select: { email: true } },
      reviews: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { customer: { select: { fullName: true, avatarUrl: true } } },
      },
    },
  });
  if (!provider) throw Object.assign(new Error('Provider not found'), { statusCode: 404 });

  // Increment profile views
  await prisma.provider.update({ where: { id }, data: { profileViews: { increment: 1 } } });

  return provider;
};

export const getMyProfile = async (providerId: string) => {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    include: {
      portfolioImages: { orderBy: { sortOrder: 'asc' } },
      user: { select: { email: true } },
    },
  });
  if (!provider) throw Object.assign(new Error('Provider not found'), { statusCode: 404 });

  const [bookingCount, completedCount] = await Promise.all([
    prisma.booking.count({ where: { providerId } }),
    prisma.booking.count({ where: { providerId, status: 'COMPLETED' } }),
  ]);

  return {
    provider,
    stats: {
      profileViews: provider.profileViews,
      totalBookings: bookingCount,
      completedBookings: completedCount,
      avgRating: provider.avgRating,
      totalReviews: provider.totalReviews,
    },
  };
};

export const updateMyProfile = async (providerId: string, data: any) => {
  const allowed = ['businessName', 'ownerName', 'phone', 'category', 'location', 'description', 'services', 'experience', 'website'];
  const update: any = {};
  for (const key of allowed) {
    if (data[key] !== undefined) update[key] = data[key];
  }

  const provider = await prisma.provider.update({ where: { id: providerId }, data: update });
  return provider;
};

export const addPortfolioImages = async (
  providerId: string,
  images: { url: string; publicId: string }[]
) => {
  const existing = await prisma.portfolioImage.count({ where: { providerId } });
  if (existing + images.length > 12) {
    throw Object.assign(new Error('Maximum 12 portfolio images allowed'), { statusCode: 400 });
  }

  const created = await prisma.portfolioImage.createMany({
    data: images.map((img, i) => ({
      providerId,
      imageUrl: img.url,
      publicId: img.publicId,
      sortOrder: existing + i,
    })),
  });

  return prisma.portfolioImage.findMany({ where: { providerId }, orderBy: { sortOrder: 'asc' } });
};

export const deletePortfolioImage = async (providerId: string, imageId: string) => {
  const image = await prisma.portfolioImage.findUnique({ where: { id: imageId } });
  if (!image) throw Object.assign(new Error('Image not found'), { statusCode: 404 });
  if (image.providerId !== providerId) throw Object.assign(new Error('Not authorized'), { statusCode: 403 });

  await deleteFromCloudinary(image.publicId);
  await prisma.portfolioImage.delete({ where: { id: imageId } });
};

export const getMyInquiries = async (providerId: string, query: any) => {
  const page = parseIntParam(query.page, 1);
  const limit = parseIntParam(query.limit, 20);
  const skip = (page - 1) * limit;

  const where: any = {
    providerId,
    ...(query.status && { status: query.status.toUpperCase() }),
  };

  const [inquiries, total] = await Promise.all([
    prisma.inquiry.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { fullName: true, phone: true, avatarUrl: true } } },
    }),
    prisma.inquiry.count({ where }),
  ]);

  return { inquiries, page, limit, total };
};

export const replyToInquiry = async (providerId: string, inquiryId: string, data: { reply?: string; status?: string }) => {
  const inquiry = await prisma.inquiry.findUnique({ where: { id: inquiryId } });
  if (!inquiry) throw Object.assign(new Error('Inquiry not found'), { statusCode: 404 });
  if (inquiry.providerId !== providerId) throw Object.assign(new Error('Not authorized'), { statusCode: 403 });

  const update: any = {};
  if (data.reply) update.reply = data.reply;
  if (data.status) update.status = data.status.toUpperCase();
  if (data.reply && !data.status) update.status = 'REPLIED';

  return prisma.inquiry.update({ where: { id: inquiryId }, data: update, include: { customer: { select: { fullName: true } } } });
};

export const getMyReviews = async (providerId: string, query: any) => {
  const page = parseIntParam(query.page, 1);
  const limit = parseIntParam(query.limit, 20);
  const skip = (page - 1) * limit;

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: { providerId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { fullName: true, avatarUrl: true } } },
    }),
    prisma.review.count({ where: { providerId } }),
  ]);

  return { reviews, page, limit, total };
};

export const replyToReview = async (providerId: string, reviewId: string, reply: string) => {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw Object.assign(new Error('Review not found'), { statusCode: 404 });
  if (review.providerId !== providerId) throw Object.assign(new Error('Not authorized'), { statusCode: 403 });
  if (review.providerReply) throw Object.assign(new Error('Already replied to this review'), { statusCode: 400 });

  return prisma.review.update({ where: { id: reviewId }, data: { providerReply: reply } });
};
