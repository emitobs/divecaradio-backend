const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Diveca Radio Chat API',
      version: '1.0.0',
      description: 'API for Diveca Radio real-time chat system with authentication',
      contact: {
        name: 'Erizos DevOps',
        email: 'contact@erizos.dev',
        url: 'https://erizos.dev',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
      {
        url: 'https://your-production-domain.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        sessionAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'connect.sid',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'User ID',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            username: {
              type: 'string',
              description: 'Username for display',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp',
            },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            password: {
              type: 'string',
              minLength: 6,
              description: 'User password',
            },
          },
        },
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password', 'username'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            password: {
              type: 'string',
              minLength: 6,
              description: 'User password',
            },
            username: {
              type: 'string',
              minLength: 3,
              maxLength: 50,
              description: 'Username for display',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
            details: {
              type: 'string',
              description: 'Additional error details',
            },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Operation success status',
            },
            message: {
              type: 'string',
              description: 'Success message',
            },
          },
        },
      },
    },
  },
  apis: ['./src/server/*.js'], // paths to files containing OpenAPI definitions
};

const specs = swaggerJsdoc(options);

module.exports = {
  specs,
  swaggerUi,
};
