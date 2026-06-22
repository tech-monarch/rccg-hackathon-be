import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/database';
import { sendSuccess, paginateMeta } from '../../utils/response';
import { authenticate } from '../../middleware/auth.middleware';
import { parseIntParam } from '../../utils/helpers';

// ─── Service ─────────────────────────────────────────────────────────────────
export const listHousing = async (query: any) => {
  const page = parseIntParam(query.page, 1);
  const limit = Math.min(parseIntParam(query.limit, 12), 50);
  const skip = (page - 1) * limit;

  const where: any = {
    isAvailable: true,
    ...(query.search && {
      OR: [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { location: { contains: query.search, mode: 'insensitive' } },
      ],
    }),
    ...(query.category && { category: query.category.toUpperCase() }),
    ...(query.location && { location: { contains: query.location, mode: 'insensitive' } }),
    ...(query.minRating && { avgRating: { gte: parseFloat(query.minRating) } }),
  };

  const orderBy: any =
    query.sort === 'price_asc' ? { pricePerMonth: 'asc' }
    : query.sort === 'price_desc' ? { pricePerMonth: 'desc' }
    : query.sort === 'rating' ? { avgRating: 'desc' }
    : { createdAt: 'desc' };

  const [listings, total] = await Promise.all([
    prisma.housingListing.findMany({ where, orderBy, skip, take: limit }),
    prisma.housingListing.count({ where }),
  ]);

  return { listings, page, limit, total };
};

export const createListing = async (ownerId: string, data: any) => {
  const { title, category, description, location, address, pricePerMonth, phone, imageUrl } = data;
  return prisma.housingListing.create({
    data: {
      ownerId,
      title,
      category: category.toUpperCase(),
      description,
      location,
      address,
      pricePerMonth: pricePerMonth ? parseFloat(pricePerMonth) : null,
      phone,
      imageUrl,
    },
  });
};

export const getListingById = async (id: string) => {
  const listing = await prisma.housingListing.findUnique({ where: { id } });
  if (!listing) throw Object.assign(new Error('Listing not found'), { statusCode: 404 });
  return listing;
};

// ─── Controller ──────────────────────────────────────────────────────────────
const listHousingHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { listings, page, limit, total } = await listHousing(req.query);
    sendSuccess(res, listings, 200, paginateMeta(page, limit, total));
  } catch (err) { next(err); }
};

const createListingHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const listing = await createListing(req.user!.userId, req.body);
    sendSuccess(res, { listing }, 201);
  } catch (err) { next(err); }
};

const getListingByIdHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const listing = await getListingById(req.params.id);
    sendSuccess(res, listing);
  } catch (err) { next(err); }
};

// ─── Routes ──────────────────────────────────────────────────────────────────
const router = Router();
router.get('/', listHousingHandler);
router.post('/', authenticate, createListingHandler);
router.get('/:id', getListingByIdHandler);

export default router;
