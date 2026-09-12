import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createOrderSchema, idParamSchema } from '../schemas';
import * as orderService from '../services/orderService';

const router = Router();

router.post(
  '/',
  authenticate,
  requireRole(Role.BUYER),
  validate(createOrderSchema),
  async (req, res, next) => {
    try {
      const { listingId, buyerDeliveryDomain } = req.body as {
        listingId: string;
        buyerDeliveryDomain: string;
      };
      const order = await orderService.createOrder(req.user!.id, listingId, buyerDeliveryDomain);
      res.status(201).json({ order });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/:id/status',
  authenticate,
  validate(idParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const order = await orderService.getOrderStatus(req.params.id, req.user!);
      res.json({ order });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/:id/verify-payment',
  authenticate,
  validate(idParamSchema, 'params'),
  async (req, res, next) => {
    try {
      // Buyer, provider of listing, or admin may trigger verification
      await orderService.getOrderStatus(req.params.id, req.user!);
      const result = await orderService.verifyPayment(req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
