import { Request, Response, NextFunction } from 'express';
import { isAppError } from '../utils/errors';
import { logger } from '../config/logger';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (isAppError(err)) {
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
