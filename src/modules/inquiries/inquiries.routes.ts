import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/database';
import { sendSuccess } from '../../utils/response';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { sendEmail, emailTemplates } from '../../utils/email';

// ─── Service ─────────────────────────────────────────────────────────────────
export const createInquiry = async (
  customerId: string,
  data: { providerId: string; service: string; message: string }
) => {
  const provider = await prisma.provider.findUnique({
    where: { id: data.providerId },
    include: { user: { select: { email: true } } },
  });
  if (!provider) throw Object.assign(new Error('Provider not found'), { statusCode: 404 });

  const inquiry = await prisma.inquiry.create({
    data: {
      customerId,
      providerId: data.providerId,
      service: data.service,
      message: data.message,
    },
    include: { customer: { select: { fullName: true } } },
  });

  await sendEmail({
    to: provider.user.email,
    ...emailTemplates.newInquiry(provider.businessName, inquiry.customer.fullName, data.service),
  });

  return inquiry;
};

// ─── Controller ──────────────────────────────────────────────────────────────
const createInquiryHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inquiry = await createInquiry(req.user!.profileId!, req.body);
    sendSuccess(res, { inquiry }, 201);
  } catch (err) { next(err); }
};

// ─── Routes ──────────────────────────────────────────────────────────────────
const router = Router();
router.post('/', authenticate, requireRole('CUSTOMER'), createInquiryHandler);

export default router;
