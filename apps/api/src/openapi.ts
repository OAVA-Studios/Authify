export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Authify API',
    version: '1.0.0',
    description: 'Self-hostable Backend-as-a-Service platform combining auth, licensing, database, storage, functions, messaging, realtime and webhooks.',
    contact: { name: 'Authify', url: 'https://github.com/authify' },
    license: { name: 'MIT', identifier: 'MIT' },
  },
  servers: [
    { url: 'http://localhost:4000', description: 'Local development' },
  ],
  tags: [
    { name: 'Auth', description: 'Authentication & user management' },
    { name: 'OAuth', description: 'OAuth2 provider integrations' },
    { name: 'Licensing', description: 'License apps, keys, activations, variables & blacklist' },
    { name: 'Database', description: 'Collections, policies & document CRUD' },
    { name: 'Storage', description: 'Buckets, files, uploads & image transforms' },
    { name: 'Functions', description: 'Serverless functions, invocations & executions' },
    { name: 'Messaging', description: 'Providers, templates & message sending' },
    { name: 'Webhooks', description: 'Webhook endpoints, deliveries & triggering' },
    { name: 'Realtime', description: 'WebSocket channels, broadcast & presence' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    service: { type: 'string', example: 'authify-api' },
                    requestId: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },

    /* ─────────── Auth ─────────── */
    '/v1/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8, maxLength: 128 },
                  metadata: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'User registered' },
          '400': { description: 'Invalid input' },
          '409': { description: 'Email already registered' },
        },
      },
    },
    '/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                  twoFactorCode: { type: 'string', length: 6 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Login successful' },
          '401': { description: 'Invalid credentials' },
        },
      },
    },
    '/v1/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Logout successful' },
        },
      },
    },
    '/v1/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh access token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                  refreshToken: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'New token pair' },
          '401': { description: 'Invalid refresh token' },
        },
      },
    },
    '/v1/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current user',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Current user profile' },
        },
      },
      patch: {
        tags: ['Auth'],
        summary: 'Update profile',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  metadata: { type: 'object' },
                  preferences: { type: 'object' },
                  currentPassword: { type: 'string' },
                  newPassword: { type: 'string', minLength: 8, maxLength: 128 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Profile updated' },
        },
      },
    },
    '/v1/auth/password-reset-request': {
      post: {
        tags: ['Auth'],
        summary: 'Request password reset',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: { email: { type: 'string', format: 'email' } },
              },
            },
          },
        },
        responses: { '200': { description: 'Reset email sent if user exists' } },
      },
    },
    '/v1/auth/password-reset': {
      post: {
        tags: ['Auth'],
        summary: 'Reset password',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token', 'newPassword'],
                properties: {
                  token: { type: 'string', format: 'uuid' },
                  newPassword: { type: 'string', minLength: 8, maxLength: 128 },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Password updated' }, '400': { description: 'Invalid or expired token' } },
      },
    },
    '/v1/auth/verify-email-request': {
      post: {
        tags: ['Auth'],
        summary: 'Request email verification',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Verification email sent' } },
      },
    },
    '/v1/auth/verify-email': {
      post: {
        tags: ['Auth'],
        summary: 'Verify email',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token'],
                properties: { token: { type: 'string', format: 'uuid' } },
              },
            },
          },
        },
        responses: { '200': { description: 'Email verified' } },
      },
    },
    '/v1/auth/2fa/enable': {
      post: {
        tags: ['Auth'],
        summary: 'Enable 2FA',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: '2FA secret and backup codes' } },
      },
    },
    '/v1/auth/2fa/verify': {
      post: {
        tags: ['Auth'],
        summary: 'Verify 2FA code and enable',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code'],
                properties: { code: { type: 'string', length: 6 } },
              },
            },
          },
        },
        responses: { '200': { description: '2FA enabled' } },
      },
    },
    '/v1/auth/2fa/disable': {
      post: {
        tags: ['Auth'],
        summary: 'Disable 2FA',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code'],
                properties: { code: { type: 'string', length: 6 } },
              },
            },
          },
        },
        responses: { '200': { description: '2FA disabled' } },
      },
    },
    '/v1/auth/sessions': {
      get: {
        tags: ['Auth'],
        summary: 'List sessions',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'List of active sessions' } },
      },
      delete: {
        tags: ['Auth'],
        summary: 'Delete all other sessions',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Other sessions revoked' } },
      },
    },
    '/v1/auth/sessions/{id}': {
      delete: {
        tags: ['Auth'],
        summary: 'Delete a session',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { '200': { description: 'Session deleted' } },
      },
    },

    /* ─────────── Licensing ─────────── */
    '/v1/licensing/apps': {
      get: {
        tags: ['Licensing'],
        summary: 'List license apps',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'List of apps' } },
      },
      post: {
        tags: ['Licensing'],
        summary: 'Create license app',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', maxLength: 256 },
                  description: { type: 'string' },
                  version: { type: 'string', maxLength: 64, default: '1.0.0' },
                  hwidLocking: { type: 'boolean', default: true },
                  maxDevices: { type: 'integer', minimum: 1, default: 1 },
                  webhookUrl: { type: 'string', format: 'uri' },
                  antiDebug: { type: 'boolean', default: false },
                  encryptionKey: { type: 'string' },
                  metadata: { type: 'object' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'App created' } },
      },
    },
    '/v1/licensing/apps/{id}': {
      get: {
        tags: ['Licensing'],
        summary: 'Get license app',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'App details' } },
      },
      patch: {
        tags: ['Licensing'],
        summary: 'Update license app',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', maxLength: 256 },
                  description: { type: 'string' },
                  version: { type: 'string', maxLength: 64 },
                  hwidLocking: { type: 'boolean' },
                  maxDevices: { type: 'integer', minimum: 1 },
                  webhookUrl: { type: 'string', format: 'uri', nullable: true },
                  antiDebug: { type: 'boolean' },
                  metadata: { type: 'object' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'App updated' } },
      },
      delete: {
        tags: ['Licensing'],
        summary: 'Delete license app',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'App deleted' } },
      },
    },
    '/v1/licensing/keys': {
      get: {
        tags: ['Licensing'],
        summary: 'List license keys',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'appId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'active', 'expired', 'revoked', 'banned'] } },
          { name: 'userId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: { '200': { description: 'Paginated list of keys' } },
      },
      post: {
        tags: ['Licensing'],
        summary: 'Create license key(s)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['appId'],
                properties: {
                  appId: { type: 'string', format: 'uuid' },
                  userId: { type: 'string', format: 'uuid' },
                  tier: { type: 'string', maxLength: 64, default: 'basic' },
                  maxActivations: { type: 'integer', minimum: 1, default: 1 },
                  expiresAt: { type: 'string', format: 'date-time' },
                  note: { type: 'string' },
                  metadata: { type: 'object' },
                  quantity: { type: 'integer', minimum: 1, maximum: 1000, default: 1 },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Key(s) created' } },
      },
    },
    '/v1/licensing/keys/{id}': {
      get: {
        tags: ['Licensing'],
        summary: 'Get license key',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Key details' } },
      },
      patch: {
        tags: ['Licensing'],
        summary: 'Update license key',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  tier: { type: 'string', maxLength: 64 },
                  maxActivations: { type: 'integer', minimum: 1 },
                  expiresAt: { type: 'string', format: 'date-time', nullable: true },
                  status: { type: 'string', enum: ['pending', 'active', 'expired', 'revoked', 'banned'] },
                  note: { type: 'string', nullable: true },
                  metadata: { type: 'object' },
                  userId: { type: 'string', format: 'uuid', nullable: true },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Key updated' } },
      },
      delete: {
        tags: ['Licensing'],
        summary: 'Delete license key',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Key deleted' } },
      },
    },
    '/v1/licensing/activate': {
      post: {
        tags: ['Licensing'],
        summary: 'Activate a license key',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['key', 'hwid'],
                properties: {
                  key: { type: 'string' },
                  hwid: { type: 'string' },
                  deviceName: { type: 'string' },
                  appVersion: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Activation successful' }, '401': { description: 'Invalid/expired key or device blacklisted' } },
      },
    },
    '/v1/licensing/validate': {
      post: {
        tags: ['Licensing'],
        summary: 'Validate a license key',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['key', 'hwid'],
                properties: { key: { type: 'string' }, hwid: { type: 'string' } },
              },
            },
          },
        },
        responses: { '200': { description: 'Validation result' }, '401': { description: 'Invalid or inactive key' } },
      },
    },
    '/v1/licensing/heartbeat': {
      post: {
        tags: ['Licensing'],
        summary: 'License heartbeat',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['key', 'hwid'],
                properties: { key: { type: 'string' }, hwid: { type: 'string' } },
              },
            },
          },
        },
        responses: { '200': { description: 'Alive' } },
      },
    },
    '/v1/licensing/deactivate': {
      post: {
        tags: ['Licensing'],
        summary: 'Deactivate a device',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['key', 'hwid'],
                properties: { key: { type: 'string' }, hwid: { type: 'string' } },
              },
            },
          },
        },
        responses: { '200': { description: 'Deactivated' } },
      },
    },
    '/v1/licensing/activations': {
      get: {
        tags: ['Licensing'],
        summary: 'List activations',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'keyId', in: 'query', schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'List of activations' } },
      },
    },
    '/v1/licensing/activations/{id}': {
      delete: {
        tags: ['Licensing'],
        summary: 'Delete activation',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Activation deleted' } },
      },
    },
    '/v1/licensing/variables': {
      get: {
        tags: ['Licensing'],
        summary: 'List variables',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'appId', in: 'query', schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'List of variables' } },
      },
      post: {
        tags: ['Licensing'],
        summary: 'Create variable',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['appId', 'name', 'value'],
                properties: {
                  appId: { type: 'string', format: 'uuid' },
                  name: { type: 'string', maxLength: 256 },
                  value: { type: 'string' },
                  type: { type: 'string', maxLength: 64, default: 'string' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Variable created' } },
      },
    },
    '/v1/licensing/variables/{id}': {
      patch: {
        tags: ['Licensing'],
        summary: 'Update variable',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', maxLength: 256 },
                  value: { type: 'string' },
                  type: { type: 'string', maxLength: 64 },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Variable updated' } },
      },
      delete: {
        tags: ['Licensing'],
        summary: 'Delete variable',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Variable deleted' } },
      },
    },
    '/v1/licensing/blacklist': {
      get: {
        tags: ['Licensing'],
        summary: 'List blacklist entries',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'type', in: 'query', schema: { type: 'string', enum: ['ip', 'hwid', 'username', 'email', 'license_key'] } }],
        responses: { '200': { description: 'List of blacklist entries' } },
      },
      post: {
        tags: ['Licensing'],
        summary: 'Create blacklist entry',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['type', 'value'],
                properties: {
                  appId: { type: 'string', format: 'uuid' },
                  type: { type: 'string', enum: ['ip', 'hwid', 'username', 'email', 'license_key'] },
                  value: { type: 'string', maxLength: 512 },
                  reason: { type: 'string' },
                  permanent: { type: 'boolean', default: true },
                  expiresAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Entry created' } },
      },
    },
    '/v1/licensing/blacklist/{id}': {
      delete: {
        tags: ['Licensing'],
        summary: 'Delete blacklist entry',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Entry deleted' } },
      },
    },

    /* ─────────── Database ─────────── */
    '/v1/database/collections': {
      get: {
        tags: ['Database'],
        summary: 'List collections',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'List of collections' } },
      },
      post: {
        tags: ['Database'],
        summary: 'Create collection',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'tableName', 'schema'],
                properties: {
                  name: { type: 'string', maxLength: 256 },
                  tableName: { type: 'string', maxLength: 63, pattern: '^[a-zA-Z][a-zA-Z0-9_]*$' },
                  schema: { type: 'object' },
                  rlsEnabled: { type: 'boolean', default: true },
                  metadata: { type: 'object' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Collection created' } },
      },
    },
    '/v1/database/collections/{id}': {
      get: {
        tags: ['Database'],
        summary: 'Get collection',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Collection details' } },
      },
      patch: {
        tags: ['Database'],
        summary: 'Update collection',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', maxLength: 256 },
                  schema: { type: 'object' },
                  rlsEnabled: { type: 'boolean' },
                  metadata: { type: 'object' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Collection updated' } },
      },
      delete: {
        tags: ['Database'],
        summary: 'Delete collection',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Collection deleted' } },
      },
    },
    '/v1/database/collections/{id}/policies': {
      get: {
        tags: ['Database'],
        summary: 'List collection policies',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'List of policies' } },
      },
      post: {
        tags: ['Database'],
        summary: 'Create policy',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'operation', 'condition'],
                properties: {
                  name: { type: 'string', maxLength: 256 },
                  operation: { type: 'string', enum: ['read', 'write', 'delete', 'all'] },
                  condition: { type: 'object' },
                  role: { type: 'string', maxLength: 64 },
                  enabled: { type: 'boolean', default: true },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Policy created' } },
      },
    },
    '/v1/database/policies/{policyId}': {
      patch: {
        tags: ['Database'],
        summary: 'Update policy',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'policyId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', maxLength: 256 },
                  operation: { type: 'string', enum: ['read', 'write', 'delete', 'all'] },
                  condition: { type: 'object' },
                  role: { type: 'string', maxLength: 64, nullable: true },
                  enabled: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Policy updated' } },
      },
      delete: {
        tags: ['Database'],
        summary: 'Delete policy',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'policyId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Policy deleted' } },
      },
    },
    '/v1/database/collections/{name}/documents': {
      get: {
        tags: ['Database'],
        summary: 'List documents',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        parameters: [
          { name: 'name', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'orderBy', in: 'query', schema: { type: 'string', default: 'created_at' } },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
          { name: 'filter', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Paginated documents' } },
      },
      post: {
        tags: ['Database'],
        summary: 'Create document',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['data'],
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  data: { type: 'object' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Document created' } },
      },
    },
    '/v1/database/collections/{name}/documents/{docId}': {
      get: {
        tags: ['Database'],
        summary: 'Get document',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        parameters: [
          { name: 'name', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'docId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { '200': { description: 'Document' } },
      },
      patch: {
        tags: ['Database'],
        summary: 'Update document',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        parameters: [
          { name: 'name', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'docId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['data'],
                properties: { data: { type: 'object' } },
              },
            },
          },
        },
        responses: { '200': { description: 'Document updated' } },
      },
      delete: {
        tags: ['Database'],
        summary: 'Delete document',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        parameters: [
          { name: 'name', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'docId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { '200': { description: 'Document deleted' } },
      },
    },

    /* ─────────── Storage ─────────── */
    '/v1/storage/buckets': {
      get: {
        tags: ['Storage'],
        summary: 'List buckets',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'List of buckets' } },
      },
      post: {
        tags: ['Storage'],
        summary: 'Create bucket',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', maxLength: 256 },
                  public: { type: 'boolean', default: false },
                  maxFileSize: { type: 'integer', minimum: 1, maximum: 10737418240, default: 1073741824 },
                  allowedMimeTypes: { type: 'array', items: { type: 'string' }, default: [] },
                  metadata: { type: 'object' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Bucket created' } },
      },
    },
    '/v1/storage/buckets/{id}': {
      get: {
        tags: ['Storage'],
        summary: 'Get bucket',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Bucket details' } },
      },
      patch: {
        tags: ['Storage'],
        summary: 'Update bucket',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', maxLength: 256 },
                  public: { type: 'boolean' },
                  maxFileSize: { type: 'integer', minimum: 1, maximum: 10737418240 },
                  allowedMimeTypes: { type: 'array', items: { type: 'string' } },
                  metadata: { type: 'object' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Bucket updated' } },
      },
      delete: {
        tags: ['Storage'],
        summary: 'Delete bucket',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Bucket deleted' } },
      },
    },
    '/v1/storage/upload': {
      post: {
        tags: ['Storage'],
        summary: 'Upload file',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        parameters: [
          { name: 'bucketId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'path', in: 'query', schema: { type: 'string', maxLength: 512 } },
        ],
        requestBody: {
          content: {
            'application/octet-stream': { schema: { type: 'string', format: 'binary' } },
            'multipart/form-data': { schema: { type: 'object' } },
          },
        },
        responses: { '201': { description: 'File uploaded' } },
      },
    },
    '/v1/storage/uploads/init': {
      post: {
        tags: ['Storage'],
        summary: 'Init chunked upload',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['bucketId', 'name', 'totalChunks', 'mimeType'],
                properties: {
                  bucketId: { type: 'string', format: 'uuid' },
                  name: { type: 'string', maxLength: 512 },
                  totalChunks: { type: 'integer', minimum: 1, maximum: 1000 },
                  mimeType: { type: 'string', maxLength: 256 },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Upload initialized' } },
      },
    },
    '/v1/storage/uploads/chunk': {
      post: {
        tags: ['Storage'],
        summary: 'Upload chunk',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        parameters: [
          { name: 'uploadId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'chunkNumber', in: 'query', required: true, schema: { type: 'integer', minimum: 1 } },
          { name: 'totalChunks', in: 'query', required: true, schema: { type: 'integer', minimum: 1 } },
        ],
        requestBody: {
          content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
        },
        responses: { '200': { description: 'Chunk received' } },
      },
    },
    '/v1/storage/uploads/complete': {
      post: {
        tags: ['Storage'],
        summary: 'Complete chunked upload',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['uploadId', 'bucketId', 'name', 'totalChunks', 'mimeType'],
                properties: {
                  uploadId: { type: 'string', format: 'uuid' },
                  bucketId: { type: 'string', format: 'uuid' },
                  name: { type: 'string', maxLength: 512 },
                  totalChunks: { type: 'integer', minimum: 1 },
                  mimeType: { type: 'string', maxLength: 256 },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Upload completed' } },
      },
    },
    '/v1/storage/files': {
      get: {
        tags: ['Storage'],
        summary: 'List files',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        parameters: [
          { name: 'bucketId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: { '200': { description: 'Paginated files' } },
      },
    },
    '/v1/storage/files/{id}': {
      get: {
        tags: ['Storage'],
        summary: 'Get file',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'File details' } },
      },
      delete: {
        tags: ['Storage'],
        summary: 'Delete file',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'File deleted' } },
      },
    },
    '/v1/storage/files/{id}/download': {
      get: {
        tags: ['Storage'],
        summary: 'Download file',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'File binary' } },
      },
    },
    '/v1/storage/files/{id}/transform': {
      get: {
        tags: ['Storage'],
        summary: 'Transform image',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'w', in: 'query', schema: { type: 'integer' } },
          { name: 'h', in: 'query', schema: { type: 'integer' } },
          { name: 'q', in: 'query', schema: { type: 'integer' } },
          { name: 'f', in: 'query', schema: { type: 'string', enum: ['jpeg', 'png', 'webp', 'avif'] } },
          { name: 'fit', in: 'query', schema: { type: 'string', enum: ['cover', 'contain', 'fill', 'inside', 'outside'] } },
        ],
        responses: { '200': { description: 'Transformed image' } },
      },
    },

    /* ─────────── Functions ─────────── */
    '/v1/functions': {
      get: {
        tags: ['Functions'],
        summary: 'List functions',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'triggerType', in: 'query', schema: { type: 'string', enum: ['http', 'schedule', 'event', 'webhook'] } },
        ],
        responses: { '200': { description: 'Paginated functions' } },
      },
      post: {
        tags: ['Functions'],
        summary: 'Create function',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'slug', 'sourceCode'],
                properties: {
                  name: { type: 'string', maxLength: 256 },
                  slug: { type: 'string', maxLength: 256 },
                  entrypoint: { type: 'string', maxLength: 512, default: 'index.js' },
                  runtime: { type: 'string', enum: ['node22', 'node20', 'bun'], default: 'node22' },
                  sourceCode: { type: 'string' },
                  sourcePath: { type: 'string', maxLength: 512 },
                  envVars: { type: 'object', additionalProperties: { type: 'string' }, default: {} },
                  triggerType: { type: 'string', enum: ['http', 'schedule', 'event', 'webhook'], default: 'http' },
                  triggerConfig: { type: 'object', default: {} },
                  timeout: { type: 'integer', minimum: 1000, maximum: 300000, default: 30000 },
                  memory: { type: 'integer', minimum: 64, maximum: 1024, default: 256 },
                  metadata: { type: 'object' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Function created' } },
      },
    },
    '/v1/functions/{id}': {
      get: {
        tags: ['Functions'],
        summary: 'Get function',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Function details' } },
      },
      patch: {
        tags: ['Functions'],
        summary: 'Update function',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', maxLength: 256 },
                  slug: { type: 'string', maxLength: 256 },
                  entrypoint: { type: 'string', maxLength: 512 },
                  runtime: { type: 'string', enum: ['node22', 'node20', 'bun'] },
                  sourceCode: { type: 'string' },
                  sourcePath: { type: 'string', maxLength: 512, nullable: true },
                  envVars: { type: 'object', additionalProperties: { type: 'string' } },
                  triggerType: { type: 'string', enum: ['http', 'schedule', 'event', 'webhook'] },
                  triggerConfig: { type: 'object' },
                  timeout: { type: 'integer', minimum: 1000, maximum: 300000 },
                  memory: { type: 'integer', minimum: 64, maximum: 1024 },
                  active: { type: 'boolean' },
                  metadata: { type: 'object' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Function updated' } },
      },
      delete: {
        tags: ['Functions'],
        summary: 'Delete function',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Function deleted' } },
      },
    },
    '/v1/functions/{slug}/invoke': {
      post: {
        tags: ['Functions'],
        summary: 'Invoke function (HTTP trigger)',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': { schema: { type: 'object' } },
            'text/plain': { schema: { type: 'string' } },
            'multipart/form-data': { schema: { type: 'object' } },
          },
        },
        responses: { '200': { description: 'Function response' } },
      },
    },
    '/v1/functions/{slug}/trigger': {
      post: {
        tags: ['Functions'],
        summary: 'Async trigger function',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['event'],
                properties: {
                  event: { type: 'string' },
                  payload: { type: 'object', default: {} },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Job queued' } },
      },
    },
    '/v1/functions/executions': {
      get: {
        tags: ['Functions'],
        summary: 'List executions',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'functionId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'running', 'completed', 'failed'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: { '200': { description: 'Paginated executions' } },
      },
    },
    '/v1/functions/executions/{id}': {
      get: {
        tags: ['Functions'],
        summary: 'Get execution',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Execution details' } },
      },
      delete: {
        tags: ['Functions'],
        summary: 'Delete execution',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Execution deleted' } },
      },
    },

    /* ─────────── Messaging ─────────── */
    '/v1/messaging/providers': {
      get: {
        tags: ['Messaging'],
        summary: 'List providers',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'List of providers' } },
      },
      post: {
        tags: ['Messaging'],
        summary: 'Create provider',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'type', 'config'],
                properties: {
                  name: { type: 'string', maxLength: 256 },
                  type: { type: 'string', enum: ['smtp', 'resend', 'mailgun', 'sendgrid', 'twilio', 'vonage', 'fcm'] },
                  config: { type: 'object' },
                  isDefault: { type: 'boolean', default: false },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Provider created' } },
      },
    },
    '/v1/messaging/providers/{id}': {
      get: {
        tags: ['Messaging'],
        summary: 'Get provider',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Provider details' } },
      },
      patch: {
        tags: ['Messaging'],
        summary: 'Update provider',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', maxLength: 256 },
                  config: { type: 'object' },
                  isDefault: { type: 'boolean' },
                  active: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Provider updated' } },
      },
      delete: {
        tags: ['Messaging'],
        summary: 'Delete provider',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Provider deleted' } },
      },
    },
    '/v1/messaging/templates': {
      get: {
        tags: ['Messaging'],
        summary: 'List templates',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'List of templates' } },
      },
      post: {
        tags: ['Messaging'],
        summary: 'Create template',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'type', 'body'],
                properties: {
                  name: { type: 'string', maxLength: 256 },
                  type: { type: 'string', enum: ['email', 'sms', 'push'] },
                  subject: { type: 'string', maxLength: 512 },
                  body: { type: 'string' },
                  htmlBody: { type: 'string' },
                  variables: { type: 'array', items: { type: 'string' }, default: [] },
                  metadata: { type: 'object' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Template created' } },
      },
    },
    '/v1/messaging/templates/{id}': {
      get: {
        tags: ['Messaging'],
        summary: 'Get template',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Template details' } },
      },
      patch: {
        tags: ['Messaging'],
        summary: 'Update template',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', maxLength: 256 },
                  type: { type: 'string', enum: ['email', 'sms', 'push'] },
                  subject: { type: 'string', maxLength: 512, nullable: true },
                  body: { type: 'string' },
                  htmlBody: { type: 'string', nullable: true },
                  variables: { type: 'array', items: { type: 'string' } },
                  metadata: { type: 'object' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Template updated' } },
      },
      delete: {
        tags: ['Messaging'],
        summary: 'Delete template',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Template deleted' } },
      },
    },
    '/v1/messaging/send': {
      post: {
        tags: ['Messaging'],
        summary: 'Send message',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['type', 'to'],
                properties: {
                  providerId: { type: 'string', format: 'uuid' },
                  templateId: { type: 'string', format: 'uuid' },
                  type: { type: 'string', enum: ['email', 'sms', 'push'] },
                  to: { type: 'string', maxLength: 512 },
                  subject: { type: 'string', maxLength: 512 },
                  body: { type: 'string' },
                  htmlBody: { type: 'string' },
                  variables: { type: 'object', additionalProperties: { type: 'string' }, default: {} },
                  metadata: { type: 'object' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Message sent' } },
      },
    },
    '/v1/messaging/messages': {
      get: {
        tags: ['Messaging'],
        summary: 'List messages',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'sent', 'failed', 'delivered'] } },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['email', 'sms', 'push'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: { '200': { description: 'Paginated messages' } },
      },
    },
    '/v1/messaging/messages/{id}': {
      get: {
        tags: ['Messaging'],
        summary: 'Get message',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Message details' } },
      },
      delete: {
        tags: ['Messaging'],
        summary: 'Delete message',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Message deleted' } },
      },
    },

    /* ─────────── Webhooks ─────────── */
    '/v1/webhooks': {
      get: {
        tags: ['Webhooks'],
        summary: 'List webhooks',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'List of webhooks' } },
      },
      post: {
        tags: ['Webhooks'],
        summary: 'Create webhook',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'url', 'events'],
                properties: {
                  name: { type: 'string', maxLength: 256 },
                  url: { type: 'string', format: 'uri' },
                  secret: { type: 'string', maxLength: 512 },
                  events: { type: 'array', items: { type: 'string' }, minItems: 1 },
                  active: { type: 'boolean', default: true },
                  retries: { type: 'integer', minimum: 0, maximum: 10, default: 3 },
                  metadata: { type: 'object' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Webhook created' } },
      },
    },
    '/v1/webhooks/{id}': {
      get: {
        tags: ['Webhooks'],
        summary: 'Get webhook',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Webhook details' } },
      },
      patch: {
        tags: ['Webhooks'],
        summary: 'Update webhook',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', maxLength: 256 },
                  url: { type: 'string', format: 'uri' },
                  secret: { type: 'string', maxLength: 512, nullable: true },
                  events: { type: 'array', items: { type: 'string' } },
                  active: { type: 'boolean' },
                  retries: { type: 'integer', minimum: 0, maximum: 10 },
                  metadata: { type: 'object' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Webhook updated' } },
      },
      delete: {
        tags: ['Webhooks'],
        summary: 'Delete webhook',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Webhook deleted' } },
      },
    },
    '/v1/webhooks/deliveries': {
      get: {
        tags: ['Webhooks'],
        summary: 'List deliveries',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'webhookId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'event', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['success', 'failed'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: { '200': { description: 'Paginated deliveries' } },
      },
    },
    '/v1/webhooks/trigger': {
      post: {
        tags: ['Webhooks'],
        summary: 'Trigger webhooks',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['event'],
                properties: {
                  event: { type: 'string' },
                  payload: { type: 'object', default: {} },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Webhooks triggered' } },
      },
    },

    /* ─────────── Realtime ─────────── */
    '/v1/realtime': {
      get: {
        tags: ['Realtime'],
        summary: 'WebSocket upgrade endpoint',
        description: 'Upgrade to WebSocket for realtime subscriptions. Connect with ?project_id=your_project_id.',
        parameters: [
          { name: 'project_id', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '101': { description: 'WebSocket upgrade successful' },
        },
      },
    },
    '/v1/realtime/channels': {
      get: {
        tags: ['Realtime'],
        summary: 'List channels',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'List of channels' } },
      },
    },
    '/v1/realtime/channels/{name}': {
      get: {
        tags: ['Realtime'],
        summary: 'Get channel details',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Channel details' } },
      },
    },
    '/v1/realtime/broadcast': {
      post: {
        tags: ['Realtime'],
        summary: 'Admin broadcast',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['payload'],
                properties: {
                  channel: { type: 'string' },
                  clientIds: { type: 'array', items: { type: 'string' } },
                  event: { type: 'string', default: 'broadcast' },
                  payload: { type: 'object' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Broadcast sent' } },
      },
    },
    '/v1/realtime/broadcast/project': {
      post: {
        tags: ['Realtime'],
        summary: 'Project-scoped broadcast',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['channel', 'payload'],
                properties: {
                  channel: { type: 'string' },
                  event: { type: 'string', default: 'broadcast' },
                  payload: { type: 'object' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Broadcast sent' } },
      },
    },
    '/v1/realtime/stats': {
      get: {
        tags: ['Realtime'],
        summary: 'Realtime stats',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Connection and channel stats' } },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token from login/refresh',
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'Project API key for service-to-service auth',
      },
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: { type: 'boolean' },
          data: {},
          meta: { type: 'object' },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'object' },
            },
          },
          requestId: { type: 'string' },
        },
      },
      PaginatedMeta: {
        type: 'object',
        required: ['page', 'limit', 'total', 'totalPages'],
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
          nextCursor: { type: 'string' },
          hasMore: { type: 'boolean' },
        },
      },
    },
  },
};
