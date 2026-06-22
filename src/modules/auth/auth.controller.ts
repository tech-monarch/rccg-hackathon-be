import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { sendSuccess, sendError } from '../../utils/response';
import { uploadToCloudinary } from '../../middleware/upload.middleware';

export const registerCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.registerCustomer(req.body);
    sendSuccess(res, result, 201);
  } catch (err) { next(err); }
};

export const registerProvider = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Handle portfolio image uploads if files present
    const portfolioImages: { url: string; publicId: string }[] = [];
    const files = req.files as Express.Multer.File[] | undefined;

    if (files && files.length > 0) {
      for (const file of files) {
        const uploaded = await uploadToCloudinary(file.buffer, 'portfolios');
        portfolioImages.push(uploaded);
      }
    }

    const result = await authService.registerProvider(req.body, portfolioImages);
    sendSuccess(res, result, 201);
  } catch (err) { next(err); }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.login(req.body);
    sendSuccess(res, result);
  } catch (err) { next(err); }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refreshTokens(refreshToken);
    sendSuccess(res, result);
  } catch (err) { next(err); }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.logout(req.user!.userId);
    sendSuccess(res, { message: 'Logged out successfully' });
  } catch (err) { next(err); }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.forgotPassword(req.body.email);
    sendSuccess(res, { message: 'If that email exists, a reset link has been sent.' });
  } catch (err) { next(err); }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.resetPassword(req.body.token, req.body.newPassword);
    sendSuccess(res, { message: 'Password reset successfully. Please log in.' });
  } catch (err) { next(err); }
};
