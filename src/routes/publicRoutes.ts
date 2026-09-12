import { Router } from 'express';
import { validate } from '../middleware/validate';
import { idParamSchema } from '../schemas';
import * as listingService from '../services/listingService';

const router = Router();

router.get('/listings', async (_req, res, next) => {
  try {
    const listings = await listingService.listPublicActive();
    res.json({ listings });
  } catch (err) {
    next(err);
  }
});

router.get('/listings/:id', validate(idParamSchema, 'params'), async (req, res, next) => {
  try {
    const listing = await listingService.getPublicListing(req.params.id);
    res.json({ listing });
  } catch (err) {
    next(err);
  }
});

export default router;
