import { Request, Response, NextFunction } from 'express';
import { pushActivity } from '../services/activityLog';

export function activityLogger(req: Request, res: Response, next: NextFunction): void {
  const started = Date.now();
  res.on('finish', () => {
    // Skip noisy static assets
    if (req.path.startsWith('/ui/') || req.path === '/' || req.path === '/favicon.ico') {
      return;
    }
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    pushActivity({
      level,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      requestId: req.requestId,
      message: `${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - started}ms)`,
    });
  });
  next();
}
