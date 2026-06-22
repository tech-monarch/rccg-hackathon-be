import { Request, Response, NextFunction } from 'express';
import * as customersService from './customers.service';
import { sendSuccess, paginateMeta } from '../../utils/response';
import { uploadToCloudinary } from '../../middleware/upload.middleware';

export const getMyProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customer = await customersService.getMyProfile(req.user!.profileId!);
    sendSuccess(res, customer);
  } catch (err) { next(err); }
};

export const updateMyProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customer = await customersService.updateMyProfile(req.user!.profileId!, req.body);
    sendSuccess(res, { customer });
  } catch (err) { next(err); }
};

export const uploadAvatar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    if (!file) { res.status(400).json({ success: false, message: 'No file provided' }); return; }
    const { url } = await uploadToCloudinary(file.buffer, 'avatars');
    const customer = await customersService.updateAvatar(req.user!.profileId!, url);
    sendSuccess(res, { avatarUrl: url, customer });
  } catch (err) { next(err); }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await customersService.changePassword(req.user!.userId, req.body.currentPassword, req.body.newPassword);
    sendSuccess(res, { message: 'Password changed successfully' });
  } catch (err) { next(err); }
};

export const getServiceHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { bookings, page, limit, total } = await customersService.getServiceHistory(req.user!.profileId!, req.query);
    sendSuccess(res, bookings, 200, paginateMeta(page, limit, total));
  } catch (err) { next(err); }
};

export const getPoints = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await customersService.getPoints(req.user!.profileId!);
    sendSuccess(res, result);
  } catch (err) { next(err); }
};
