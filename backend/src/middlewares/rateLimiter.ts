import rateLimit from 'express-rate-limit';
import { config } from '@/config';
import { RateLimitError } from '@/utils/errors';

export const globalRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_ERROR',
      message: 'Too many requests, please try again later.',
    },
  },
  handler: (_req, _res, _next, _options) => {
    throw new RateLimitError();
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_ERROR',
      message: 'Too many authentication attempts. Try again in 15 minutes.',
    },
  },
  handler: (_req, _res, _next, _options) => {
    throw new RateLimitError('Too many authentication attempts');
  },
});
