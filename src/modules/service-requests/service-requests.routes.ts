import { Router } from 'express';
import * as srController from './service-requests.controller';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { uploadMedia } from '../../middleware/upload.middleware';

const router = Router();

router.use(authenticate, requireRole('CUSTOMER'));

router.post('/', srController.createServiceRequest);
router.get('/', srController.getMyRequests);
router.post('/:id/media', uploadMedia.array('files', 8), srController.addRequestMedia);
router.get('/:id/quotes', srController.getQuotes);

export default router;
