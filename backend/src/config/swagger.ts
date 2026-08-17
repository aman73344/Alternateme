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
      Alternate: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          username: { type: 'string', example: 'john-doe' },
          displayName: { type: 'string', example: 'John Doe' },
          title: { type: 'string', example: 'Senior Software Engineer' },
          bio: { type: 'string' },
          avatarUrl: { type: 'string', format: 'uri' },
          visibility: { type: 'string', enum: ['PUBLIC', 'UNLISTED', 'PRIVATE'] },
          status: { type: 'string', enum: ['DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED'] },
          publishedAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      OnboardingStatus: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED'] },
          currentStep: { type: 'string', enum: ['PERSONAL', 'SOURCES', 'PERSONA', 'VOICE', 'AI_PROVIDER', 'PUBLISH'], nullable: true },
          completedSteps: { type: 'array', items: { type: 'string' } },
          alternateId: { type: 'string', format: 'uuid', nullable: true },
        },
      },
      TrainingSource: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          alternateId: { type: 'string', format: 'uuid' },
          type: { type: 'string', enum: ['FILE', 'URL', 'LINKEDIN', 'YOUTUBE', 'OTHER'] },
          name: { type: 'string' },
          url: { type: 'string', format: 'uri', nullable: true },
          status: { type: 'string', enum: ['PENDING', 'PROCESSING', 'READY', 'FAILED', 'DELETED'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Persona: {
        type: 'object',
        properties: {
          tone: { type: 'string', nullable: true },
          writingStyle: { type: 'string', nullable: true },
          personality: { type: 'string', nullable: true },
          instructions: { type: 'string', nullable: true },
          boundaries: { type: 'string', nullable: true },
          refusalBehavior: { type: 'string', nullable: true },
        },
      },
      VoiceProvider: {
        type: 'object',
        properties: {
          provider: { type: 'string', enum: ['ELEVENLABS', 'CARTESIA'] },
          available: { type: 'boolean' },
        },
      },
      AIProviderConfig: {
        type: 'object',
        properties: {
          provider: { type: 'string', enum: ['OPENAI', 'ANTHROPIC'] },
          status: { type: 'string', enum: ['PENDING', 'VALID', 'INVALID'] },
          defaultModel: { type: 'string', nullable: true },
        },
      },
      OnboardingPreview: {
        type: 'object',
        properties: {
          alternate: {
            type: 'object',
            properties: {
              displayName: { type: 'string' },
              title: { type: 'string', nullable: true },
              bio: { type: 'string', nullable: true },
              avatarUrl: { type: 'string', nullable: true },
              username: { type: 'string' },
            },
          },
          persona: { $ref: '#/components/schemas/Persona' },
          sources: {
            type: 'object',
            properties: {
              count: { type: 'integer' },
              ready: { type: 'integer' },
              pending: { type: 'integer' },
            },
          },
          voice: {
            type: 'object',
            properties: {
              configured: { type: 'boolean' },
            },
          },
          aiProvider: {
            type: 'object',
            properties: {
              configured: { type: 'boolean' },
              provider: { type: 'string', nullable: true },
            },
          },
        },
      },
      PublicAlternate: {
        type: 'object',
        properties: {
          displayName: { type: 'string' },
          title: { type: 'string', nullable: true },
          bio: { type: 'string', nullable: true },
          avatarUrl: { type: 'string', nullable: true },
          username: { type: 'string' },
          visibility: { type: 'string' },
          status: { type: 'string' },
          publishedAt: { type: 'string', format: 'date-time', nullable: true },
          persona: { $ref: '#/components/schemas/Persona' },
          voice: {
            type: 'object',
            properties: {
              provider: { type: 'string' },
              name: { type: 'string' },
            },
          },
          aiProvider: {
            type: 'object',
            properties: {
              provider: { type: 'string' },
              model: { type: 'string', nullable: true },
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
    { name: 'Onboarding', description: 'Owner onboarding flow' },
    { name: 'Alternates', description: 'Digital Twin management' },
    { name: 'Sources', description: 'Training source management' },
    { name: 'Voice', description: 'Voice synthesis and cloning' },
    { name: 'Public', description: 'Public alternate profiles' },
    { name: 'Chat', description: 'Chat with digital twins' },
    { name: 'Conversations', description: 'Conversation history' },
    { name: 'Email', description: 'Email agent management' },
    { name: 'Telephony', description: 'Phone call management' },
    { name: 'Billing', description: 'Subscription and billing' },
    { name: 'Analytics', description: 'Usage analytics' },
    { name: 'Admin', description: 'Admin operations' },
  ],
};

const options: swaggerJsdoc.Options = {
  definition: swaggerDefinition,
  apis: ['./src/**/*.routes.ts', './src/controllers/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);