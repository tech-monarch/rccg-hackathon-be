import { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: Role;
        profileId?: string; // customerId or providerId
      };
    }
  }
}
