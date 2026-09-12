import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../utils/errors';

type RequestPart = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, part: RequestPart = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      next(
        new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', result.error.flatten()),
      );
      return;
    }
    (req as Request & { [key: string]: unknown })[part] = result.data;
    next();
  };
}
