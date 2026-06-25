import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../../config/database';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { RegisterCustomerInput, RegisterProviderInput, LoginInput } from './auth.schema';
import { sendEmail, emailTemplates } from '../../utils/email';
import { config } from '../../config';

// ─── Performance note ─────────────────────────────────────────────────────────
// bcrypt rounds are controlled by BCRYPT_ROUNDS env var (default 10).
// The original code hardcoded 12 for password hashing AND 10 for refresh token
// hashing — that was two expensive bcrypt calls on every login. We fix both:
//
//  1. Configurable rounds via config.bcryptRounds (10 is the standard sweet spot).
//  2. Refresh tokens are now stored as a SHA-256 hex digest (not bcrypt).
//     Refresh tokens are already long random strings (256-bit JWT secret) so
//     bcrypt adds no meaningful security — SHA-256 is sufficient and ~1000x faster.
// ─────────────────────────────────────────────────────────────────────────────

// In-memory reset token store — suitable for MVP single-instance.
// TODO: move to DB (PasswordResetToken table) before running multiple instances.
const resetTokens = new Map<string, { userId: string; expires: Date }>();

/** Fast, secure token comparison using SHA-256 instead of bcrypt */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function verifyTokenHash(token: string, stored: string): boolean {
  return crypto.timingSafeEqual(
    Buffer.from(hashToken(token), 'hex'),
    Buffer.from(stored, 'hex')
  );
}

export const registerCustomer = async (input: RegisterCustomerInput) => {
  // Single DB lookup — check if email exists
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true }, // minimal projection
  });
  if (existing) throw Object.assign(new Error('Email already registered'), { statusCode: 409 });

  // Use configurable rounds (default 10 ≈ 80ms vs 12 ≈ 400ms)
  const passwordHash = await bcrypt.hash(input.password, config.bcryptRounds);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      role: 'CUSTOMER',
      isVerified: true,
      customer: {
        create: {
          fullName: input.fullName,
          phone: input.phone,
        },
      },
    },
    include: { customer: { select: { id: true, fullName: true, phone: true, avatarUrl: true, totalPoints: true } } },
  });

  const tokenPayload = { userId: user.id, role: user.role, profileId: user.customer!.id };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // SHA-256 hash (fast) instead of bcrypt (slow) for token storage
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: hashToken(refreshToken) },
  });

  // Fire-and-forget — email failure must not slow down registration response
  sendEmail({ to: user.email, ...emailTemplates.welcome(input.fullName) }).catch(() => {});

  return {
    user: { id: user.id, email: user.email, role: user.role },
    customer: user.customer,
    accessToken,
    refreshToken,
  };
};

export const registerProvider = async (
  input: RegisterProviderInput,
  portfolioImages?: { url: string; publicId: string }[]
) => {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) throw Object.assign(new Error('Email already registered'), { statusCode: 409 });

  const passwordHash = await bcrypt.hash(input.password, config.bcryptRounds);

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

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: hashToken(refreshToken) },
  });

  sendEmail({ to: user.email, ...emailTemplates.welcome(input.businessName) }).catch(() => {});

  return {
    user: { id: user.id, email: user.email, role: user.role },
    provider: user.provider,
    accessToken,
    refreshToken,
  };
};

export const login = async (input: LoginInput) => {
  // Fetch user + profile in one query. Select only what we need.
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      passwordHash: true,
      customer: { select: { id: true, fullName: true, phone: true, avatarUrl: true, totalPoints: true } },
      provider: { select: { id: true, businessName: true, ownerName: true, phone: true, category: true, location: true, avgRating: true } },
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

  // Single update — SHA-256 hash, no bcrypt wait
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: hashToken(refreshToken) },
  });

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

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, role: true, isActive: true, refreshToken: true },
  });
  if (!user?.refreshToken || !user.isActive) {
    throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 });
  }

  // Fast SHA-256 comparison instead of bcrypt.compare
  if (!verifyTokenHash(token, user.refreshToken)) {
    throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 });
  }

  const tokenPayload = { userId: user.id, role: user.role, profileId: payload.profileId };
  const accessToken = generateAccessToken(tokenPayload);
  const newRefreshToken = generateRefreshToken(tokenPayload);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: hashToken(newRefreshToken) },
  });

  return { accessToken, refreshToken: newRefreshToken };
};

export const logout = async (userId: string) => {
  await prisma.user.update({ where: { id: userId }, data: { refreshToken: null } });
};

export const forgotPassword = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      customer: { select: { fullName: true } },
      provider: { select: { businessName: true } },
    },
  });
  if (!user) return; // Silently succeed — prevents email enumeration

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 3600000); // 1 hour
  resetTokens.set(token, { userId: user.id, expires });

  const name = user.customer?.fullName ?? user.provider?.businessName ?? 'User';
  const resetLink = `${config.frontendUrl}/reset-password?token=${token}`;
  sendEmail({ to: user.email, ...emailTemplates.passwordReset(name, resetLink) }).catch(() => {});
};

export const resetPassword = async (token: string, newPassword: string) => {
  const entry = resetTokens.get(token);
  if (!entry || entry.expires < new Date()) {
    throw Object.assign(new Error('Invalid or expired reset token'), { statusCode: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, config.bcryptRounds);
  await prisma.user.update({
    where: { id: entry.userId },
    data: { passwordHash, refreshToken: null },
  });
  resetTokens.delete(token);
};
