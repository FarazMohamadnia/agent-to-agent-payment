import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { idParamSchema } from '../schemas';
import * as orderService from '../services/orderService';

const router = Router();

router.use(authenticate, requireRole(Role.ADMIN));

router.get('/orders', async (_req, res, next) => {
  try {
    const orders = await orderService.listAllOrders();
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/orders/:id/payout',
  validate(idParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const order = await orderService.markPayoutSent(req.params.id);
      res.json({ order });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
