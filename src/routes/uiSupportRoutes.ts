import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth';
import { isProduction } from '../config/env';
import { AppError } from '../utils/errors';
import { clearActivity, listActivity } from '../services/activityLog';
import { prisma } from '../db/prisma';

const router = Router();

router.get('/activity', (_req, res, next) => {
  try {
    if (isProduction) {
      throw new AppError(404, 'NOT_FOUND', 'Route not found');
    }
    const limit = Number(_req.query.limit ?? 100);
    res.json({ entries: listActivity(Number.isFinite(limit) ? limit : 100) });
  } catch (err) {
    next(err);
  }
});

router.delete('/activity', (_req, res, next) => {
  try {
    if (isProduction) {
      throw new AppError(404, 'NOT_FOUND', 'Route not found');
    }
    clearActivity();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get(
  '/webhook-logs',
  authenticate,
  requireRole(Role.ADMIN, Role.PROVIDER),
  async (req, res, next) => {
    try {
      const where =
        req.user!.role === Role.ADMIN
          ? {}
          : { order: { listing: { providerId: req.user!.id } } };

      const logs = await prisma.webhookDeliveryLog.findMany({
        where,
        orderBy: { attemptedAt: 'desc' },
        take: 100,
        include: {
          order: {
            select: {
              id: true,
              status: true,
              paymentReference: true,
              listingId: true,
            },
          },
        },
      });
      res.json({ logs });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
