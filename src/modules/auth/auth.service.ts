import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../../config/database';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { RegisterCustomerInput, RegisterProviderInput, LoginInput } from './auth.schema';
import { sendEmail, emailTemplates } from '../../utils/email';
import { config } from '../../config';

// In-memory reset token store (use Redis in production)
const resetTokens = new Map<string, { userId: string; expires: Date }>();

export const registerCustomer = async (input: RegisterCustomerInput) => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw Object.assign(new Error('Email already registered'), { statusCode: 409 });

  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      role: 'CUSTOMER',
      isVerified: true, // Auto-verify for MVP; add email OTP for production
      customer: {
        create: {
          fullName: input.fullName,
          phone: input.phone,
        },
      },
    },
    include: { customer: true },
  });

  const tokenPayload = { userId: user.id, role: user.role, profileId: user.customer!.id };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  const refreshHash = await bcrypt.hash(refreshToken, 10);
  await prisma.user.update({ where: { id: user.id }, data: { refreshToken: refreshHash } });

  await sendEmail({ to: user.email, ...emailTemplates.welcome(input.fullName) });

  return {
    user: { id: user.id, email: user.email, role: user.role },
    customer: user.customer,
    accessToken,
    refreshToken,
  };
};

export const registerProvider = async (input: RegisterProviderInput, portfolioImages?: { url: string; publicId: string }[]) => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw Object.assign(new Error('Email already registered'), { statusCode: 409 });

  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      role: 'PROVIDER',
      isVerified: true,
      provider: {
        create: {
          businessName: input.businessName,
          ownerName: input.ownerName,
          phone: input.phone,
          category: input.category,
          location: input.location,
          description: input.description,
          services: input.services,
          experience: input.experience,
          website: input.website || null,
          portfolioImages: portfolioImages?.length
            ? { create: portfolioImages.map((img, i) => ({ imageUrl: img.url, publicId: img.publicId, sortOrder: i })) }
            : undefined,
        },
      },
    },
    include: { provider: { include: { portfolioImages: true } } },
  });

  const tokenPayload = { userId: user.id, role: user.role, profileId: user.provider!.id };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);
  const refreshHash = await bcrypt.hash(refreshToken, 10);
  await prisma.user.update({ where: { id: user.id }, data: { refreshToken: refreshHash } });

  await sendEmail({ to: user.email, ...emailTemplates.welcome(input.businessName) });

  return {
    user: { id: user.id, email: user.email, role: user.role },
    provider: user.provider,
    accessToken,
    refreshToken,
  };
};

export const login = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: {
      customer: true,
      provider: true,
    },
  });

  if (!user) throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
  if (!user.isActive) throw Object.assign(new Error('Account suspended. Contact support.'), { statusCode: 403 });

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });

  const profileId = user.customer?.id ?? user.provider?.id;
  const tokenPayload = { userId: user.id, role: user.role, profileId };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);
  const refreshHash = await bcrypt.hash(refreshToken, 10);
  await prisma.user.update({ where: { id: user.id }, data: { refreshToken: refreshHash } });

  const profile = user.role === 'CUSTOMER' ? user.customer : user.provider;

  return {
    user: { id: user.id, email: user.email, role: user.role },
    profile,
    role: user.role,
    accessToken,
    refreshToken,
  };
};

export const refreshTokens = async (token: string) => {
  const payload = verifyRefreshToken(token);

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user?.refreshToken) throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 });

  const valid = await bcrypt.compare(token, user.refreshToken);
  if (!valid) throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 });

  const tokenPayload = { userId: user.id, role: user.role, profileId: payload.profileId };
  const accessToken = generateAccessToken(tokenPayload);
  const newRefreshToken = generateRefreshToken(tokenPayload);
  const refreshHash = await bcrypt.hash(newRefreshToken, 10);
  await prisma.user.update({ where: { id: user.id }, data: { refreshToken: refreshHash } });

  return { accessToken, refreshToken: newRefreshToken };
};

export const logout = async (userId: string) => {
  await prisma.user.update({ where: { id: userId }, data: { refreshToken: null } });
};

export const forgotPassword = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { customer: true, provider: true },
  });
  if (!user) return; // Silently succeed to prevent email enumeration

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 3600000); // 1 hour
  resetTokens.set(token, { userId: user.id, expires });

  const name = user.customer?.fullName ?? user.provider?.businessName ?? 'User';
  const resetLink = `${config.frontendUrl}/reset-password?token=${token}`;
  await sendEmail({ to: user.email, ...emailTemplates.passwordReset(name, resetLink) });
};

export const resetPassword = async (token: string, newPassword: string) => {
  const entry = resetTokens.get(token);
  if (!entry || entry.expires < new Date()) {
    throw Object.assign(new Error('Invalid or expired reset token'), { statusCode: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: entry.userId }, data: { passwordHash, refreshToken: null } });
  resetTokens.delete(token);
};
