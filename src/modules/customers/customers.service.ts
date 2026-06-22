import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { parseIntParam } from '../../utils/helpers';

export const getMyProfile = async (customerId: string) => {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { user: { select: { email: true, createdAt: true } } },
  });
  if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });
  return customer;
};

export const updateMyProfile = async (customerId: string, data: any) => {
  const allowed = ['fullName', 'phone', 'address'];
  const update: any = {};
  for (const key of allowed) {
    if (data[key] !== undefined) update[key] = data[key];
  }
  return prisma.customer.update({ where: { id: customerId }, data: update });
};

export const updateAvatar = async (customerId: string, avatarUrl: string) => {
  return prisma.customer.update({ where: { id: customerId }, data: { avatarUrl } });
};

export const changePassword = async (userId: string, currentPassword: string, newPassword: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw Object.assign(new Error('Current password is incorrect'), { statusCode: 400 });

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
};

export const getServiceHistory = async (customerId: string, query: any) => {
  const page = parseIntParam(query.page, 1);
  const limit = parseIntParam(query.limit, 20);
  const skip = (page - 1) * limit;

  const where: any = {
    customerId,
    ...(query.status && { status: query.status.toUpperCase() }),
  };

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        provider: { select: { businessName: true, category: true, phone: true } },
        serviceRequest: { select: { category: true, description: true, address: true } },
        review: { select: { rating: true, comment: true } },
        payment: { select: { status: true, amount: true } },
      },
    }),
    prisma.booking.count({ where }),
  ]);

  return { bookings, page, limit, total };
};

export const getPoints = async (customerId: string) => {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { totalPoints: true },
  });

  const transactions = await prisma.pointsTransaction.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return { totalPoints: customer?.totalPoints ?? 0, transactions };
};
