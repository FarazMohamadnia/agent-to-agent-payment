import { Router } from 'express';
import { isProduction } from '../config/env';
import { validate } from '../middleware/validate';
import { orderIdParamSchema } from '../schemas';
import { mockPaymentVerifier } from '../payments/MockPaymentVerifier';
import { prisma } from '../db/prisma';
import { AppError } from '../utils/errors';
import { OrderStatus } from '@prisma/client';
import {
  handleWebhookSinkClear,
  handleWebhookSinkList,
} from '../dev/webhookSink';

const router = Router();

router.use((_req, _res, next) => {
  if (isProduction) {
    next(new AppError(404, 'NOT_FOUND', 'Route not found'));
    return;
  }
  next();
});

router.post(
  '/mock-pay/:orderId',
  validate(orderIdParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const order = await prisma.order.findUnique({ where: { id: req.params.orderId } });
      if (!order) {
        throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
      }
      if (order.status !== OrderStatus.pending_payment) {
        throw new AppError(409, 'INVALID_STATUS', 'Order is not awaiting payment');
      }
      mockPaymentVerifier.markPaid(order.id);
      res.json({
        ok: true,
        message: 'Order marked as paid in MockPaymentVerifier',
        orderId: order.id,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get('/webhook-sink', handleWebhookSinkList);
router.delete('/webhook-sink', handleWebhookSinkClear);

export default router;
