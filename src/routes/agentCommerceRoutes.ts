import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import * as agentService from '../services/agentService';
import { createQuote, negotiateQuote, getQuote, expireQuoteIfNeeded } from '../services/quoteService';
import { paymentService } from '../services/paymentService';
import { deliverService } from '../services/deliveryService';
import { runAutonomousTransaction } from '../services/autonomousCommerce';
import { AppError } from '../utils/errors';

const router = Router();

const capabilityQuery = z
  .object({
    capability: z.string().min(1).optional(),
  })
  .strict();

router.get('/agents', validate(capabilityQuery, 'query'), async (req, res, next) => {
  try {
    const capability = (req.query as { capability?: string }).capability;
    const agents = await agentService.listAgents(capability);
    res.json({
      demoMode: true,
      notice: 'DEMO MODE — NO REAL FUNDS',
      agents,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/agents/:id', async (req, res, next) => {
  try {
    const agent = await agentService.getAgent(req.params.id);
    res.json({ agent, demoMode: true });
  } catch (err) {
    next(err);
  }
});

router.get('/offers', validate(capabilityQuery, 'query'), async (req, res, next) => {
  try {
    const capability = (req.query as { capability?: string }).capability;
    const offers = await agentService.discoverOffers(capability);
    res.json({
      demoMode: true,
      notice: 'DEMO MODE — NO REAL FUNDS',
      offers,
    });
  } catch (err) {
    next(err);
  }
});

const quoteBody = z
  .object({
    buyerAgentId: z.string().uuid(),
    sellerAgentId: z.string().uuid(),
    listingId: z.string().uuid(),
    quantity: z.number().int().positive().default(100),
    negotiatedPrice: z.string().optional(),
  })
  .strict();

router.post('/quotes', validate(quoteBody), async (req, res, next) => {
  try {
    const quote = await createQuote(req.body);
    res.status(201).json({ quote, demoMode: true });
  } catch (err) {
    next(err);
  }
});

router.get('/quotes/:id', async (req, res, next) => {
  try {
    await expireQuoteIfNeeded(req.params.id);
    const quote = await getQuote(req.params.id);
    res.json({ quote });
  } catch (err) {
    next(err);
  }
});

const negotiateBody = z
  .object({
    counterPrice: z.string().min(1),
  })
  .strict();

router.post('/quotes/:id/negotiate', validate(negotiateBody), async (req, res, next) => {
  try {
    const result = await negotiateQuote(req.params.id, req.body.counterPrice);
    res.json({ ...result, demoMode: true });
  } catch (err) {
    next(err);
  }
});

router.post('/payments/intent', validate(z.object({ quoteId: z.string().uuid() }).strict()), async (req, res, next) => {
  try {
    const intent = await paymentService.createPaymentIntent(req.body.quoteId);
    res.json(intent);
  } catch (err) {
    next(err);
  }
});

router.post('/payments/execute', validate(z.object({ quoteId: z.string().uuid() }).strict()), async (req, res, next) => {
  try {
    const result = await paymentService.executeMockPayment(req.body.quoteId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

const verifyBody = z
  .object({
    paymentProofToken: z.string().min(10),
    sellerAgentId: z.string().uuid(),
  })
  .strict();

router.post('/payments/verify', validate(verifyBody), async (req, res, next) => {
  try {
    const result = await paymentService.verifyPaymentProof(
      req.body.paymentProofToken,
      req.body.sellerAgentId,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

const deliverBody = z
  .object({
    paymentId: z.string().uuid(),
    sellerAgentId: z.string().uuid(),
    paymentProofToken: z.string().min(10),
    city: z.string().optional(),
    symbol: z.string().optional(),
    text: z.string().optional(),
  })
  .strict();

router.post('/deliveries', validate(deliverBody), async (req, res, next) => {
  try {
    const result = await deliverService({
      paymentId: req.body.paymentId,
      sellerAgentId: req.body.sellerAgentId,
      paymentProofToken: req.body.paymentProofToken,
      request: {
        city: req.body.city,
        symbol: req.body.symbol,
        text: req.body.text,
      },
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

const autonomousBody = z
  .object({
    capability: z.string().optional(),
    city: z.string().optional(),
    quantity: z.number().int().positive().optional(),
    negotiateTo: z.string().optional(),
  })
  .strict();

router.post('/demo/autonomous', validate(autonomousBody), async (req, res, next) => {
  try {
    const result = await runAutonomousTransaction(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/demo/autonomous', (_req, res, next) => {
  next(new AppError(405, 'METHOD_NOT_ALLOWED', 'Use POST /api/demo/autonomous'));
});

export default router;
