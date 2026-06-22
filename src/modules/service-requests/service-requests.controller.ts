import { Request, Response, NextFunction } from 'express';
import * as srService from './service-requests.service';
import { sendSuccess } from '../../utils/response';
import { uploadToCloudinary } from '../../middleware/upload.middleware';

export const createServiceRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const request = await srService.createServiceRequest(
      req.user!.profileId!,
      req.body
    );

    sendSuccess(res, { serviceRequest: request }, 201);
  } catch (err) {
    next(err);
  }
};

export const addRequestMedia = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files provided',
      });
    }

    const requestId = req.params.id as string;

    const uploadedRaw = await Promise.all(
      files.map(async (f) => {
        try {
          const isVideo = f.mimetype.startsWith('video/');

          const result = await uploadToCloudinary(
            f.buffer,
            'service-requests',
            isVideo ? 'video' : 'image'
          );

          return {
            url: result.url,
            publicId: result.publicId,
            mediaType: isVideo ? 'video' : 'image',
          };
        } catch (err) {
          console.error('Cloudinary upload failed:', err);
          return null;
        }
      })
    );

    // ✅ FIX: remove nulls properly (fixes TS error)
    const cleanUploads = uploadedRaw.filter(
      (item): item is {
        url: string;
        publicId: string;
        mediaType: string;
      } => item !== null
    );

    if (cleanUploads.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'All uploads failed',
      });
    }

    const media = await srService.addRequestMedia(
      req.user!.profileId!,
      requestId,
      cleanUploads
    );

    return sendSuccess(res, { mediaFiles: media }, 201);
  } catch (err) {
    next(err);
  }
};

export const getQuotes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const quotes = await srService.getQuotes(
      req.user!.profileId!,
      req.params.id as string
    );

    sendSuccess(res, { quotes });
  } catch (err) {
    next(err);
  }
};

export const getMyRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const requests = await srService.getMyRequests(req.user!.profileId!);
    sendSuccess(res, requests);
  } catch (err) {
    next(err);
  }
};