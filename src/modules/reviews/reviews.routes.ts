import { Router } from "express";
import { Request, Response, NextFunction } from "express";
import * as reviewsService from "./reviews.service";
import { sendSuccess } from "../../utils/response";
import { authenticate, requireRole } from "../../middleware/auth.middleware";

// Controller
export const createReview = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const review = await reviewsService.createReview(
      req.user!.profileId!,
      req.params.bookingId as string,
      req.body,
    );
    sendSuccess(res, { review }, 201);
  } catch (err) {
    next(err);
  }
};

// Routes
const router = Router();
router.post(
  "/bookings/:bookingId/reviews",
  authenticate,
  requireRole("CUSTOMER"),
  createReview,
);

export default router;
