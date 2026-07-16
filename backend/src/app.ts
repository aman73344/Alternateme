import express, { Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { config } from '@/config';
import { apiRouter } from '@/routes';
import {
  requestIdMiddleware,
  requestLogger,
  globalRateLimiter,
  tenantResolver,
  errorHandler,
  notFoundHandler,
} from '@/middlewares';

const app: import('express').Application = express();

app.set('trust proxy', 1);
app.set('etag', 'strong');

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: config.app.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Tenant-Id', 'X-User-Id'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 86400,
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(requestIdMiddleware);
app.use(requestLogger);
app.use(globalRateLimiter);
app.use(tenantResolver);
app.use(cookieParser());

// Lazy-load swagger docs to avoid swagger-jsdoc blocking at startup
// swagger-jsdoc reads files from disk at initialization which can hang
const swaggerRouter = Router();
app.use('/docs', swaggerRouter);

// Defer swagger initialization to first request
let swaggerInitialized = false;
swaggerRouter.use((_req, res, next) => {
  if (!swaggerInitialized) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { swaggerSpec } = require('@/config/swagger');
      swaggerRouter.use(swaggerUi.serve);
      swaggerRouter.use(swaggerUi.setup(swaggerSpec, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'Alternate Me API',
      }));
      swaggerInitialized = true;
      next();
    } catch {
      res.status(500).json({ success: false, error: { code: 'SWAGGER_ERROR', message: 'Failed to load API docs' } });
    }
  } else {
    next();
  }
});

app.use(config.app.apiPrefix, apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export { app };