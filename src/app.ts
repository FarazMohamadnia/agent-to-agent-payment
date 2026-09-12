import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { env, isProduction } from './config/env';
import { logger } from './config/logger';
import { requestId } from './middleware/requestId';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import authRoutes from './routes/authRoutes';
import listingRoutes from './routes/listingRoutes';
import publicRoutes from './routes/publicRoutes';
import orderRoutes from './routes/orderRoutes';
import adminRoutes from './routes/adminRoutes';
import devRoutes from './routes/devRoutes';

function buildCorsOptions(): cors.CorsOptions {
  const origins = env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  if (origins.includes('*')) {
    return { origin: true };
  }
  return {
    origin: (origin, callback) => {
      // Allow non-browser clients (no Origin header)
      if (!origin || origins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
  };
}

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).requestId ?? 'unknown',
      autoLogging: env.NODE_ENV !== 'test',
    }),
  );
  app.use(helmet());
  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: '1mb' }));

  const authLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_AUTH_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: { code: 'RATE_LIMITED', message: 'Too many auth attempts, try again later' },
    },
  });

  const ordersLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_ORDERS_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: { code: 'RATE_LIMITED', message: 'Too many order requests, try again later' },
    },
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/listings', listingRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/orders', ordersLimiter, orderRoutes);
  app.use('/api/admin', adminRoutes);

  if (!isProduction) {
    app.use('/api/dev', devRoutes);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
