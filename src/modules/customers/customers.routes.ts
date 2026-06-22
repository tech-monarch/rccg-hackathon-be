import { Router } from 'express';
import * as customersController from './customers.controller';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { uploadSingle } from '../../middleware/upload.middleware';

const router = Router();

router.use(authenticate, requireRole('CUSTOMER'));

router.get('/me', customersController.getMyProfile);
router.put('/me', customersController.updateMyProfile);
router.post('/me/avatar', uploadSingle.single('avatar'), customersController.uploadAvatar);
router.post('/me/change-password', customersController.changePassword);
router.get('/me/service-history', customersController.getServiceHistory);
router.get('/me/points', customersController.getPoints);

export default router;
