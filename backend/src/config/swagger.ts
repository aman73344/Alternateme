import swaggerJsdoc from 'swagger-jsdoc';
import { config } from '@/config';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: config.app.name,
    version: config.app.apiVersion,
    description: 'AI Digital Twin Platform API',
    contact: {
      name: 'Alternate Me Support',
      email: 'support@alterneme.com',
    },
  },
  servers: [
    {
      url: `http://localhost:${config.app.port}${config.app.apiPrefix}`,
      description: 'Development server',
    },
    {
      url: 'https://api.alterneme.com/api/v1',
      description: 'Production server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      apiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
      },
    },
    responses: {
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', example: 'NOT_FOUND' },
                    message: { type: 'string', example: 'Resource not found' },
                  },
                },
              },
            },
          },
        },
      },
      ValidationError: {
        description: 'Validation failed',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', example: 'VALIDATION_ERROR' },
                    message: { type: 'string', example: 'Validation failed' },
                    details: { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            },
          },
        },
      },
      Unauthorized: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', example: 'AUTHENTICATION_ERROR' },
                    message: { type: 'string', example: 'Authentication required' },
                  },
                },
              },
            },
          },
        },
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'object' },
            },
          },
        },
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 10 },
          total: { type: 'integer', example: 100 },
          totalPages: { type: 'integer', example: 10 },
          hasNext: { type: 'boolean', example: true },
          hasPrevious: { type: 'boolean', example: false },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  tags: [
    { name: 'Health', description: 'Health check endpoints' },
    { name: 'Auth', description: 'Authentication endpoints' },
    { name: 'Alternates', description: 'Digital Twin management' },
    { name: 'Sources', description: 'Training source management' },
    { name: 'Chat', description: 'Chat with digital twins' },
    { name: 'Conversations', description: 'Conversation history' },
    { name: 'Voice', description: 'Voice synthesis and cloning' },
    { name: 'Email', description: 'Email agent management' },
    { name: 'Telephony', description: 'Phone call management' },
    { name: 'Billing', description: 'Subscription and billing' },
    { name: 'Analytics', description: 'Usage analytics' },
    { name: 'Admin', description: 'Admin operations' },
  ],
};

const options: swaggerJsdoc.Options = {
  definition: swaggerDefinition,
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
