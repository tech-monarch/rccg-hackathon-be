import { Request, Response, NextFunction } from "express";
import * as providersService from "./providers.service";
import { sendSuccess } from "../../utils/response";
import { paginateMeta } from "../../utils/response";
import { uploadToCloudinary } from "../../middleware/upload.middleware";

export const listProviders = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { providers, page, limit, total } =
      await providersService.listProviders(req.query as any);
    sendSuccess(res, providers, 200, paginateMeta(page, limit, total));
  } catch (err) {
    next(err);
  }
};

export const getProviderById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const provider = await providersService.getProviderById(
      req.params.id as string,
    );
    sendSuccess(res, provider);
  } catch (err) {
    next(err);
  }
};

export const getMyProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await providersService.getMyProfile(req.user!.profileId!);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const updateMyProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const provider = await providersService.updateMyProfile(
      req.user!.profileId!,
      req.body,
    );
    sendSuccess(res, { provider });
  } catch (err) {
    next(err);
  }
};

export const uploadPortfolioImages = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ success: false, message: "No images provided" });
      return;
    }

    const uploaded = await Promise.all(
      files.map((f) => uploadToCloudinary(f.buffer, "portfolios")),
    );

    const images = await providersService.addPortfolioImages(
      req.user!.profileId!,
      uploaded,
    );
    sendSuccess(res, { uploadedImages: images }, 201);
  } catch (err) {
    next(err);
  }
};

export const deletePortfolioImage = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await providersService.deletePortfolioImage(
      req.user!.profileId!,
      req.params.imageId as string,
    );
    sendSuccess(res, { message: "Image deleted successfully" });
  } catch (err) {
    next(err);
  }
};

export const getMyInquiries = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { inquiries, page, limit, total } =
      await providersService.getMyInquiries(req.user!.profileId!, req.query);
    sendSuccess(res, inquiries, 200, paginateMeta(page, limit, total));
  } catch (err) {
    next(err);
  }
};

export const replyToInquiry = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const inquiry = await providersService.replyToInquiry(
      req.user!.profileId!,
      req.params.inquiryId as string,
      req.body,
    );
    sendSuccess(res, { inquiry });
  } catch (err) {
    next(err);
  }
};

export const getMyReviews = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { reviews, page, limit, total } = await providersService.getMyReviews(
      req.user!.profileId!,
      req.query,
    );
    sendSuccess(res, reviews, 200, paginateMeta(page, limit, total));
  } catch (err) {
    next(err);
  }
};

export const replyToReview = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const review = await providersService.replyToReview(
      req.user!.profileId!,
      req.params.reviewId as string,
      req.body.reply,
    );
    sendSuccess(res, { review });
  } catch (err) {
    next(err);
  }
};
