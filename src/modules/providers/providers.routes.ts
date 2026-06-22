import { Router } from 'express';
import * as providersController from './providers.controller';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { uploadImages } from '../../middleware/upload.middleware';
import { uploadLimiter } from '../../middleware/rateLimiter.middleware';

const router = Router();

// Public
router.get('/', providersController.listProviders);
router.get('/me', authenticate, requireRole('PROVIDER'), providersController.getMyProfile);
router.put('/me', authenticate, requireRole('PROVIDER'), providersController.updateMyProfile);
router.post('/me/portfolio', authenticate, requireRole('PROVIDER'), uploadLimiter, uploadImages.array('images', 6), providersController.uploadPortfolioImages);
router.delete('/me/portfolio/:imageId', authenticate, requireRole('PROVIDER'), providersController.deletePortfolioImage);
router.get('/me/inquiries', authenticate, requireRole('PROVIDER'), providersController.getMyInquiries);
router.patch('/me/inquiries/:inquiryId', authenticate, requireRole('PROVIDER'), providersController.replyToInquiry);
router.get('/me/reviews', authenticate, requireRole('PROVIDER'), providersController.getMyReviews);
router.post('/me/reviews/:reviewId/reply', authenticate, requireRole('PROVIDER'), providersController.replyToReview);

// Public (must be after /me routes)
router.get('/:id', providersController.getProviderById);

export default router;
