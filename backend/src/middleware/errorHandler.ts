import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logger';
import { ZodError } from 'zod';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      details: err.errors,
    });
    return;
  }

  // Jira API errors
  if (err.response) {
    const status = err.response.status;
    const message = err.response.data?.errorMessages?.join(', ') ||
      err.response.data?.message ||
      'Jira API error';

    res.status(status === 401 || status === 403 ? status : 502).json({
      error: message,
      jiraStatus: status,
    });
    return;
  }

  // Config errors
  if (err.message?.includes('Invalid Jira configuration')) {
    res.status(400).json({ error: err.message });
    return;
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
}
