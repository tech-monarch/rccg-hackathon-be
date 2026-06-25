import { Request, Response, NextFunction } from 'express';
import * as bookingsService from './bookings.service';
import { sendSuccess } from '../../utils/response';

export const createBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await bookingsService.createBooking(req.user!.profileId!, req.body);
    sendSuccess(res, result, 201);
  } catch (err) { next(err); }
};

export const paystackWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers['x-paystack-signature'] as string;
    const raw = req.body as Buffer;
    const event = JSON.parse(raw.toString());
    await bookingsService.handlePaystackWebhook(raw, signature, event);
    res.sendStatus(200);
  } catch (err) { next(err); }
};

export const completeBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await bookingsService.completeBooking(req.user!.profileId!, req.params.id);
    sendSuccess(res, result);
  } catch (err) { next(err); }
};

export const getBookingById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const booking = await bookingsService.getBookingById(req.params.id);
    sendSuccess(res, booking);
  } catch (err) { next(err); }
};

export const getProviderBookings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookings = await bookingsService.getProviderBookings(
      req.user!.profileId!,
      req.query.status as string | undefined
    );
    sendSuccess(res, bookings);
  } catch (err) { next(err); }
};
