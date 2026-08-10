import pino from 'pino';
import { config } from '@/config';

const logger = pino({
  level: config.logging.level,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'body.password',
      'body.token',
      'body.secret',
      'body.apiKey',
      'body.api_key',
      '*.apiKey',
      '*.secret',
      '*.password',
    ],
    censor: '[REDACTED]',
  },
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    }),
    res: (res) => ({
      statusCode: res.statusCode,
      duration: res.duration,
    }),
    err: pino.stdSerializers.err,
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export { logger };