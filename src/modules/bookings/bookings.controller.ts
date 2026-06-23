import { Request, Response, NextFunction } from "express";
import * as bookingsService from "./bookings.service";
import { sendSuccess } from "../../utils/response";
import crypto from "crypto";
import { config } from "../../config";

export const createBooking = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await bookingsService.createBooking(
      req.user!.profileId!,
      req.body,
    );
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
};

export const paystackWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const signature = req.headers["x-paystack-signature"] as string;
    const hash = crypto
      .createHmac("sha512", config.paystack.secretKey)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (signature !== hash) {
      res.status(400).json({ success: false, message: "Invalid signature" });
      return;
    }

    await bookingsService.handlePaystackWebhook(req.body);
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const completeBooking = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await bookingsService.completeBooking(
      req.user!.profileId!,
      req.params.id as string,
    );
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const getBookingById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const booking = await bookingsService.getBookingById(
      req.params.id as string,
    );
    if (!booking) {
      res.status(404).json({ success: false, message: "Booking not found" });
      return;
    }
    sendSuccess(res, booking);
  } catch (err) {
    next(err);
  }
};
