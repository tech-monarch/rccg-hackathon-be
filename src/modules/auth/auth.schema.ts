import { z } from 'zod';

export const registerCustomerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address').toLowerCase(),
  phone: z.string().min(10, 'Phone number too short').max(20),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerProviderSchema = z.object({
  businessName: z.string().min(2).max(150),
  ownerName: z.string().min(2).max(100),
  email: z.string().email().toLowerCase(),
  phone: z.string().min(10).max(20),
  category: z.string().min(2).max(100),
  location: z.string().min(2).max(100),
  description: z.string().min(10).max(1000),
  services: z.string().optional(),
  experience: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  password: z.string().min(6),
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(6),
});

export type RegisterCustomerInput = z.infer<typeof registerCustomerSchema>;
export type RegisterProviderInput = z.infer<typeof registerProviderSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
