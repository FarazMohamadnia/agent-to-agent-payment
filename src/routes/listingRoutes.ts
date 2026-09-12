import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createListingSchema, idParamSchema, updateListingSchema } from '../schemas';
import * as listingService from '../services/listingService';

const router = Router();

router.use(authenticate, requireRole(Role.PROVIDER));

router.post('/', validate(createListingSchema), async (req, res, next) => {
  try {
    const listing = await listingService.createListing(req.user!.id, req.body);
    res.status(201).json({ listing });
  } catch (err) {
    next(err);
  }
});

router.get('/mine', async (req, res, next) => {
  try {
    const listings = await listingService.listMine(req.user!.id);
    res.json({ listings });
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateListingSchema),
  async (req, res, next) => {
    try {
      const listing = await listingService.updateListing(req.user!.id, req.params.id, req.body);
      res.json({ listing });
    } catch (err) {
      next(err);
    }
  },
);

router.delete('/:id', validate(idParamSchema, 'params'), async (req, res, next) => {
  try {
    const listing = await listingService.deactivateListing(req.user!.id, req.params.id);
    res.json({ listing });
  } catch (err) {
    next(err);
  }
});

export default router;
