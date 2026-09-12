import { Request, Response, NextFunction } from 'express';
import { isAppError } from '../utils/errors';
import { logger } from '../config/logger';
import { pushActivity } from '../services/activityLog';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (isAppError(err)) {
    pushActivity({
      level: err.statusCode >= 500 ? 'error' : 'warn',
      method: req.method,
      path: req.originalUrl,
      statusCode: err.statusCode,
      requestId: req.requestId,
      message: err.message,
      details: { code: err.code, details: err.details },
    });
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? undefined,
      },
    });
    return;
  }

  logger.error({ err, requestId: req.requestId }, 'Unhandled error');
  pushActivity({
    level: 'error',
    method: req.method,
    path: req.originalUrl,
    statusCode: 500,
    requestId: req.requestId,
    message: 'Unhandled internal error',
    details: err instanceof Error ? { name: err.name, message: err.message } : err,
  });
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
  });
}
