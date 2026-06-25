import { Router } from 'express';
import * as bookingsController from './bookings.controller';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import express from 'express';

const router = Router();

// Paystack webhook — raw body
router.post(
  '/paystack/callback',
  express.raw({ type: 'application/json' }),
  bookingsController.paystackWebhook
);

router.post('/', authenticate, requireRole('CUSTOMER'), bookingsController.createBooking);
router.get('/', authenticate, requireRole('PROVIDER'), bookingsController.getProviderBookings);
router.get('/:id', authenticate, bookingsController.getBookingById);
router.post('/:id/complete', authenticate, requireRole('PROVIDER'), bookingsController.completeBooking);

export default router;
