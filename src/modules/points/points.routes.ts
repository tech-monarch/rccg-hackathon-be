import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/database';
import { sendSuccess, sendError } from '../../utils/response';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { config } from '../../config';

// ─── Service ─────────────────────────────────────────────────────────────────
export const redeemPoints = async (customerId: string, phone: string) => {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });

  if (customer.totalPoints < config.points.redemptionThreshold) {
    throw Object.assign(
      new Error(`You need at least ${config.points.redemptionThreshold} points to redeem. You have ${customer.totalPoints}.`),
      { statusCode: 400 }
    );
  }

  // Call VTPass API for airtime
  let redemptionRef = `HAVEN-AIRTIME-${Date.now()}`;
  let vtpassSuccess = false;

  if (config.vtpass.apiKey && config.vtpass.apiKey !== 'your_vtpass_api_key') {
    try {
      // Format phone for VTPass (08012345678 format)
      let formattedPhone = phone.replace(/\D/g, '');
      if (formattedPhone.startsWith('234')) formattedPhone = '0' + formattedPhone.slice(3);
      if (!formattedPhone.startsWith('0')) formattedPhone = '0' + formattedPhone;

      // Detect network from phone prefix
      const mtn = ['0803', '0806', '0703', '0706', '0813', '0816', '0810', '0814', '0903', '0906'];
      const airtel = ['0802', '0808', '0708', '0812', '0701', '0902'];
      const glo = ['0805', '0807', '0705', '0815', '0811', '0905'];
      const ntel = ['0804'];

      const prefix = formattedPhone.slice(0, 4);
      let serviceId = 'mtn';
      if (airtel.includes(prefix)) serviceId = 'airtel';
      else if (glo.includes(prefix)) serviceId = 'glo';
      else if (ntel.includes(prefix)) serviceId = 'etisalat';

      const vtRes = await fetch(`${config.vtpass.baseUrl}/pay`, {
        method: 'POST',
        headers: {
          'api-key': config.vtpass.apiKey,
          'secret-key': config.vtpass.secretKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          request_id: redemptionRef,
          serviceID: serviceId,
          amount: config.points.airtimeValue,
          phone: formattedPhone,
        }),
      });

      const json = await vtRes.json() as any;
      if (json.code === '000') vtpassSuccess = true;
      else throw new Error(json.response_description ?? 'Airtime API error');
    } catch (err: any) {
      throw Object.assign(new Error(`Airtime redemption failed: ${err.message}`), { statusCode: 402 });
    }
  } else {
    // Dev mode: simulate success
    vtpassSuccess = true;
    console.log(`[Points] DEV MODE: Simulated ₦${config.points.airtimeValue} airtime for ${phone}`);
  }

  if (vtpassSuccess) {
    // Deduct points in transaction
    await prisma.$transaction([
      prisma.customer.update({
        where: { id: customerId },
        data: { totalPoints: { decrement: config.points.redemptionThreshold } },
      }),
      prisma.pointsTransaction.create({
        data: {
          customerId,
          type: 'REDEEMED',
          amount: config.points.redemptionThreshold,
          description: `Redeemed ${config.points.redemptionThreshold} points for ₦${config.points.airtimeValue} airtime to ${phone}`,
        },
      }),
    ]);

    const updated = await prisma.customer.findUnique({ where: { id: customerId }, select: { totalPoints: true } });
    return { remainingPoints: updated!.totalPoints, redemptionRef };
  }

  throw Object.assign(new Error('Redemption failed'), { statusCode: 500 });
};

// ─── Controller ──────────────────────────────────────────────────────────────
const redeemPointsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = req.body;
    if (!phone) { sendError(res, 'Phone number is required', 400); return; }
    const result = await redeemPoints(req.user!.profileId!, phone);
    sendSuccess(res, result);
  } catch (err) { next(err); }
};

// ─── Routes ──────────────────────────────────────────────────────────────────
const router = Router();
router.post('/redeem', authenticate, requireRole('CUSTOMER'), redeemPointsHandler);

export default router;
