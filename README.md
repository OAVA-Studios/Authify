# Authify

A self-hostable Backend-as-a-Service (BaaS) platform combining authentication, licensing, database, storage, serverless functions, messaging, realtime and webhooks — built with **Bun**, **Hono**, **React** and **PostgreSQL**.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.1-black?logo=bun)](https://bun.sh)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Dashboard](#dashboard)
- [SDK](#sdk)
- [Testing](#testing)
- [Deployment](#deployment)
- [Development](#development)
- [License](#license)

---

## Features

| Module | Description |
|--------|-------------|
| **Auth** | JWT RS256 auth, OAuth2 (Google, GitHub, Discord, Microsoft), 2FA TOTP, sessions, password reset, email verification |
| **Licensing** | License apps, keys, activations, heartbeat, HWID locking, variables, blacklist |
| **Database** | Document collections with Row-Level Security (RLS), policy engine, cursor pagination |
| **Storage** | Bucket management, file uploads, chunked uploads, image transforms (sharp) via MinIO |
| **Functions** | Serverless JS functions (Node 20/22, Bun), HTTP/webhook/schedule/event triggers, BullMQ execution queue |
| **Messaging** | Multi-provider messaging (SMTP, Resend, Mailgun, SendGrid, Twilio, Vonage, FCM), templates |
| **Realtime** | WebSocket channels, presence, broadcast (Redis-backed for multi-instance) |
| **Webhooks** | Endpoint management, event triggering, delivery tracking with retries |

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Dashboard     │     │   API Server    │     │   SDK (ESM)     │
│  React 19 + Vite│────▶│   Bun + Hono    │◄────│  isomorphic-ws  │
│  Tailwind v4    │     │   JWT / OAuth2  │     │  native fetch   │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            ▼                    ▼                    ▼
      ┌──────────┐       ┌──────────┐       ┌──────────┐
      │ PostgreSQL│       │  Redis   │       │  MinIO   │
      │ Drizzle  │       │  BullMQ  │       │  S3 API  │
      └──────────┘       └──────────┘       └──────────┘
```

- **Monorepo**: pnpm workspaces + Turborepo
- **API**: Bun runtime, Hono v4, Drizzle ORM, Zod validation
- **Dashboard**: React 19, Vite, Tailwind CSS v4, Zustand, React Router, TanStack Query
- **SDK**: Isomorphic ESM, native `fetch`, `isomorphic-ws` for realtime

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) 1.1+
- PostgreSQL 15+
- Redis 7+
- MinIO (or any S3-compatible storage)

### 1. Clone & Install

```bash
git clone https://github.com/OAVA-Studios/Authify.git
cd authify
pnpm install
```

### 2. Environment Variables

```bash
cp .env.example .env
# Edit .env with your credentials
```

Required variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_PRIVATE_KEY` | RSA private key (PKCS8 PEM) |
| `JWT_PUBLIC_KEY` | RSA public key (SPKI PEM) |
| `ENCRYPTION_KEY` | 32-byte hex AES-256 key |
| `API_KEY_SALT` | Salt for API key hashing |
| `MINIO_ENDPOINT` | MinIO host |
| `MINIO_ACCESS_KEY` | MinIO access key |
| `MINIO_SECRET_KEY` | MinIO secret key |

Generate keys:

```bash
# RSA key pair for JWT
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem

# 32-byte hex encryption key
openssl rand -hex 32
```

### 3. Database Setup

```bash
pnpm --filter @authify/db db:generate
pnpm --filter @authify/db db:migrate
```

### 4. Run Development

```bash
# API server (port 4000)
pnpm --filter @authify/api dev

# Dashboard (port 3001)
pnpm --filter @authify/dashboard dev
```

### 5. Open Swagger UI

Visit [http://localhost:4000/docs](http://localhost:4000/docs) for interactive API documentation.

---

## Configuration

### Workspace Scripts

```bash
# Build everything
pnpm build

# Type-check everything
pnpm typecheck

# Run all tests
pnpm test

# Lint everything
pnpm lint
```

### Turborepo Pipeline

```bash
# Run tasks in dependency order
pnpm turbo build
pnpm turbo test
```

---

## API Documentation


- **OpenAPI JSON**: `GET /openapi.json`
- **Swagger UI**: `GET /docs`

### Authentication

Two security schemes are supported:

| Scheme | Header | Use Case |
|--------|--------|----------|
| **Bearer Auth** | `Authorization: Bearer <jwt>` | User sessions (login required) |
| **API Key** | `x-api-key: <key>` | Service-to-service, public endpoints |

Most admin endpoints require **Bearer Auth** + `role=admin`. Document and storage read operations also accept **API Key** for SDK usage.

### Quick Authentication Flow

```bash
# 1. Register
curl -X POST http://localhost:4000/v1/auth/register \
  -H "Content-Type: application/json" \
  -H "x-project-id: your-project-id" \
  -d '{"email":"admin@example.com","password":"SecurePass123!"}'

# 2. Login
curl -X POST http://localhost:4000/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "x-project-id: your-project-id" \
  -d '{"email":"admin@example.com","password":"SecurePass123!"}'
# Response: { "success": true, "data": { "accessToken": "...", "refreshToken": "..." } }

# 3. Use Bearer token for admin endpoints
curl -H "Authorization: Bearer <accessToken>" \
  -H "x-project-id: your-project-id" \
  http://localhost:4000/v1/licensing/apps
```

---

### Auth Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/v1/auth/register` | — | Register new user |
| `POST` | `/v1/auth/login` | — | Login (returns JWT pair) |
| `POST` | `/v1/auth/logout` | Bearer | Invalidate current session |
| `POST` | `/v1/auth/refresh` | — | Refresh access token |
| `GET`  | `/v1/auth/me` | Bearer | Get current user profile |
| `PATCH`| `/v1/auth/me` | Bearer | Update profile / password |
| `POST` | `/v1/auth/password-reset-request` | — | Request password reset email |
| `POST` | `/v1/auth/password-reset` | — | Reset password with token |
| `POST` | `/v1/auth/verify-email-request` | Bearer | Request verification email |
| `POST` | `/v1/auth/verify-email` | — | Verify email with token |
| `POST` | `/v1/auth/2fa/enable` | Bearer | Enable TOTP 2FA (returns QR) |
| `POST` | `/v1/auth/2fa/verify` | Bearer | Confirm and activate 2FA |
| `POST` | `/v1/auth/2fa/disable` | Bearer | Disable 2FA |
| `GET`  | `/v1/auth/sessions` | Bearer | List active sessions |
| `DELETE`| `/v1/auth/sessions` | Bearer | Revoke all other sessions |
| `DELETE`| `/v1/auth/sessions/{id}` | Bearer | Revoke specific session |

#### OAuth2 Providers

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/v1/auth/oauth/{provider}` | Start OAuth flow (google, github, discord, microsoft) |
| `GET`  | `/v1/auth/oauth/{provider}/callback` | OAuth callback (handled by browser) |

---

### Licensing Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/v1/licensing/apps` | Bearer (admin) | List license apps |
| `POST` | `/v1/licensing/apps` | Bearer (admin) | Create license app |
| `GET`  | `/v1/licensing/apps/{id}` | Bearer | Get app details |
| `PATCH`| `/v1/licensing/apps/{id}` | Bearer (admin) | Update app |
| `DELETE`| `/v1/licensing/apps/{id}` | Bearer (admin) | Delete app |
| `GET`  | `/v1/licensing/keys` | Bearer (admin) | List license keys (paginated) |
| `POST` | `/v1/licensing/keys` | Bearer (admin) | Create license key(s) |
| `GET`  | `/v1/licensing/keys/{id}` | Bearer | Get key details |
| `PATCH`| `/v1/licensing/keys/{id}` | Bearer (admin) | Update key |
| `DELETE`| `/v1/licensing/keys/{id}` | Bearer (admin) | Delete key |
| `POST` | `/v1/licensing/activate` | API Key | Activate key with HWID |
| `POST` | `/v1/licensing/validate` | API Key | Validate key + HWID |
| `POST` | `/v1/licensing/heartbeat` | API Key | Heartbeat ping |
| `POST` | `/v1/licensing/deactivate` | API Key | Deactivate device |
| `GET`  | `/v1/licensing/activations` | Bearer (admin) | List activations |
| `DELETE`| `/v1/licensing/activations/{id}` | Bearer (admin) | Delete activation |
| `GET`  | `/v1/licensing/variables` | Bearer (admin) | List variables |
| `POST` | `/v1/licensing/variables` | Bearer (admin) | Create variable |
| `PATCH`| `/v1/licensing/variables/{id}` | Bearer (admin) | Update variable |
| `DELETE`| `/v1/licensing/variables/{id}` | Bearer (admin) | Delete variable |
| `GET`  | `/v1/licensing/blacklist` | Bearer (admin) | List blacklist entries |
| `POST` | `/v1/licensing/blacklist` | Bearer (admin) | Add blacklist entry |
| `DELETE`| `/v1/licensing/blacklist/{id}` | Bearer (admin) | Remove entry |

#### Licensing Example

```bash
# Create a license app
curl -X POST http://localhost:4000/v1/licensing/apps \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "x-project-id: your-project-id" \
  -d '{"name":"My Desktop App","hwidLocking":true,"maxDevices":3}'

# Create a license key for that app
curl -X POST http://localhost:4000/v1/licensing/keys \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "x-project-id: your-project-id" \
  -d '{"appId":"uuid-here","tier":"pro","maxActivations":3,"quantity":5}'

# Client-side: activate
curl -X POST http://localhost:4000/v1/licensing/activate \
  -H "Content-Type: application/json" \
  -H "x-project-id: your-project-id" \
  -H "x-api-key: your-api-key" \
  -d '{"key":"XXXXX-XXXXX-XXXXX-XXXXX","hwid":"device-123","deviceName":"MacBook Pro"}'
```

---

### Database Endpoints

Collections with dynamic PostgreSQL tables and Row-Level Security (RLS).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/v1/database/collections` | Bearer (admin) | List collections |
| `POST` | `/v1/database/collections` | Bearer (admin) | Create collection |
| `GET`  | `/v1/database/collections/{id}` | Bearer | Get collection |
| `PATCH`| `/v1/database/collections/{id}` | Bearer (admin) | Update collection |
| `DELETE`| `/v1/database/collections/{id}` | Bearer (admin) | Delete collection |
| `GET`  | `/v1/database/collections/{id}/policies` | Bearer (admin) | List policies |
| `POST` | `/v1/database/collections/{id}/policies` | Bearer (admin) | Create policy |
| `PATCH`| `/v1/database/policies/{policyId}` | Bearer (admin) | Update policy |
| `DELETE`| `/v1/database/policies/{policyId}` | Bearer (admin) | Delete policy |
| `GET`  | `/v1/database/collections/{name}/documents` | Bearer/API Key | List documents (cursor pagination) |
| `POST` | `/v1/database/collections/{name}/documents` | Bearer/API Key | Create document |
| `GET`  | `/v1/database/collections/{name}/documents/{docId}` | Bearer/API Key | Get document |
| `PATCH`| `/v1/database/collections/{name}/documents/{docId}` | Bearer/API Key | Update document |
| `DELETE`| `/v1/database/collections/{name}/documents/{docId}` | Bearer/API Key | Delete document |

#### Database Example

```bash
# Create a collection
curl -X POST http://localhost:4000/v1/database/collections \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "x-project-id: your-project-id" \
  -d '{"name":"Users","tableName":"users","schema":{"name":{"type":"string","required":true},"age":{"type":"integer"}},"rlsEnabled":true}'

# Add a policy (users can only read their own data)
curl -X POST http://localhost:4000/v1/database/collections/{id}/policies \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "x-project-id: your-project-id" \
  -d '{"name":"self-read","operation":"read","condition":{"eq":["data.userId","{{userId}}"]},"role":"user"}'

# Create a document
curl -X POST http://localhost:4000/v1/database/collections/users/documents \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "x-project-id: your-project-id" \
  -d '{"data":{"name":"John","age":30,"userId":"user-uuid"}}'
```

---

### Storage Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/v1/storage/buckets` | Bearer (admin) | List buckets |
| `POST` | `/v1/storage/buckets` | Bearer (admin) | Create bucket |
| `GET`  | `/v1/storage/buckets/{id}` | Bearer | Get bucket |
| `PATCH`| `/v1/storage/buckets/{id}` | Bearer (admin) | Update bucket |
| `DELETE`| `/v1/storage/buckets/{id}` | Bearer (admin) | Delete bucket |
| `POST` | `/v1/storage/upload` | Bearer/API Key | Upload file (query: `bucketId`, optional `path`) |
| `POST` | `/v1/storage/uploads/init` | Bearer/API Key | Init chunked upload |
| `POST` | `/v1/storage/uploads/chunk` | Bearer/API Key | Upload chunk (query: `uploadId`, `chunkNumber`, `totalChunks`) |
| `POST` | `/v1/storage/uploads/complete` | Bearer/API Key | Complete chunked upload |
| `GET`  | `/v1/storage/files` | Bearer/API Key | List files (query: `bucketId`) |
| `GET`  | `/v1/storage/files/{id}` | Bearer/API Key | Get file details |
| `GET`  | `/v1/storage/files/{id}/download` | Bearer/API Key | Download file |
| `DELETE`| `/v1/storage/files/{id}` | Bearer/API Key | Delete file |
| `GET`  | `/v1/storage/files/{id}/transform` | Bearer/API Key | Transform image (query: `w`, `h`, `q`, `f`, `fit`) |

#### Storage Example

```bash
# Create bucket
curl -X POST http://localhost:4000/v1/storage/buckets \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "x-project-id: your-project-id" \
  -d '{"name":"avatars","public":false,"maxFileSize":5242880,"allowedMimeTypes":["image/jpeg","image/png"]}'

# Upload file
curl -X POST "http://localhost:4000/v1/storage/upload?bucketId=uuid" \
  -H "Authorization: Bearer <token>" \
  -H "x-project-id: your-project-id" \
  -H "Content-Type: image/png" \
  --data-binary @avatar.png

# Transform image (resize to 200x200)
curl "http://localhost:4000/v1/storage/files/{id}/transform?w=200&h=200&f=webp" \
  -H "Authorization: Bearer <token>" \
  -H "x-project-id: your-project-id" \
  --output resized.webp
```

---

### Functions Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/v1/functions` | Bearer (admin) | List functions (paginated) |
| `POST` | `/v1/functions` | Bearer (admin) | Create function |
| `GET`  | `/v1/functions/{id}` | Bearer | Get function |
| `PATCH`| `/v1/functions/{id}` | Bearer (admin) | Update function |
| `DELETE`| `/v1/functions/{id}` | Bearer (admin) | Delete function |
| `ALL`  | `/v1/functions/{slug}/invoke` | Bearer/API Key | Invoke HTTP trigger |
| `POST` | `/v1/functions/{slug}/trigger` | Bearer | Async trigger (enqueue) |
| `GET`  | `/v1/functions/executions` | Bearer (admin) | List executions |
| `GET`  | `/v1/functions/executions/{id}` | Bearer | Get execution |
| `DELETE`| `/v1/functions/executions/{id}` | Bearer (admin) | Delete execution |

#### Functions Example

```bash
# Create a serverless function
curl -X POST http://localhost:4000/v1/functions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "x-project-id: your-project-id" \
  -d '{
    "name":"Hello World",
    "slug":"hello",
    "runtime":"node22",
    "sourceCode":"module.exports = async (ctx) => { return { status: 200, body: { message: \"Hello \" + ctx.query.name } }; };",
    "triggerType":"http",
    "timeout":30000,
    "memory":256
  }'

# Invoke it
curl "http://localhost:4000/v1/functions/hello/invoke?name=Authify" \
  -H "Authorization: Bearer <token>" \
  -H "x-project-id: your-project-id"

# Async trigger
curl -X POST http://localhost:4000/v1/functions/hello/trigger \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "x-project-id: your-project-id" \
  -d '{"event":"user.signup","payload":{"userId":"123"}}'
```

---

### Messaging Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/v1/messaging/providers` | Bearer (admin) | List providers |
| `POST` | `/v1/messaging/providers` | Bearer (admin) | Create provider |
| `GET`  | `/v1/messaging/providers/{id}` | Bearer | Get provider |
| `PATCH`| `/v1/messaging/providers/{id}` | Bearer (admin) | Update provider |
| `DELETE`| `/v1/messaging/providers/{id}` | Bearer (admin) | Delete provider |
| `GET`  | `/v1/messaging/templates` | Bearer (admin) | List templates |
| `POST` | `/v1/messaging/templates` | Bearer (admin) | Create template |
| `GET`  | `/v1/messaging/templates/{id}` | Bearer | Get template |
| `PATCH`| `/v1/messaging/templates/{id}` | Bearer (admin) | Update template |
| `DELETE`| `/v1/messaging/templates/{id}` | Bearer (admin) | Delete template |
| `POST` | `/v1/messaging/send` | Bearer/API Key | Send message |
| `GET`  | `/v1/messaging/messages` | Bearer (admin) | List sent messages |
| `GET`  | `/v1/messaging/messages/{id}` | Bearer | Get message |
| `DELETE`| `/v1/messaging/messages/{id}` | Bearer (admin) | Delete message |

#### Messaging Example

```bash
# Create SMTP provider
curl -X POST http://localhost:4000/v1/messaging/providers \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "x-project-id: your-project-id" \
  -d '{
    "name":"Primary SMTP",
    "type":"smtp",
    "config":{"host":"smtp.example.com","port":"587","user":"noreply","pass":"secret","secure":"true","from":"noreply@example.com"},
    "isDefault":true
  }'

# Create template
curl -X POST http://localhost:4000/v1/messaging/templates \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "x-project-id: your-project-id" \
  -d '{
    "name":"welcome-email",
    "type":"email",
    "subject":"Welcome to Authify",
    "body":"Hello {{name}}, welcome aboard!",
    "variables":["name"]
  }'

# Send email
curl -X POST http://localhost:4000/v1/messaging/send \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "x-project-id: your-project-id" \
  -d '{
    "type":"email",
    "to":"user@example.com",
    "templateId":"template-uuid",
    "variables":{"name":"John"}
  }'
```

---

### Webhooks Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/v1/webhooks` | Bearer (admin) | List webhooks |
| `POST` | `/v1/webhooks` | Bearer (admin) | Create webhook |
| `GET`  | `/v1/webhooks/{id}` | Bearer | Get webhook |
| `PATCH`| `/v1/webhooks/{id}` | Bearer (admin) | Update webhook |
| `DELETE`| `/v1/webhooks/{id}` | Bearer (admin) | Delete webhook |
| `GET`  | `/v1/webhooks/deliveries` | Bearer (admin) | List deliveries |
| `POST` | `/v1/webhooks/trigger` | Bearer/API Key | Trigger webhooks by event |

#### Webhooks Example

```bash
# Create webhook endpoint
curl -X POST http://localhost:4000/v1/webhooks \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "x-project-id: your-project-id" \
  -d '{
    "name":"License Events",
    "url":"https://your-app.com/webhooks/license",
    "events":["license.activated","license.revoked"],
    "retries":3
  }'

# Trigger manually
curl -X POST http://localhost:4000/v1/webhooks/trigger \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "x-project-id: your-project-id" \
  -d '{"event":"license.activated","payload":{"key":"XXXXX","hwid":"abc123"}}'
```

---

### Realtime Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/v1/realtime` | — | WebSocket upgrade (`?project_id=xxx`) |
| `GET`  | `/v1/realtime/channels` | Bearer | List channels |
| `GET`  | `/v1/realtime/channels/{name}` | Bearer | Channel details |
| `POST` | `/v1/realtime/broadcast` | Bearer (admin) | Admin broadcast |
| `POST` | `/v1/realtime/broadcast/project` | Bearer/API Key | Project-scoped broadcast |
| `GET`  | `/v1/realtime/stats` | Bearer | Connection stats |

#### Realtime WebSocket Example

```javascript
const ws = new WebSocket('ws://localhost:4000/v1/realtime?project_id=your-project-id');

ws.onopen = () => {
  // Subscribe to a channel
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'updates',
    event: 'new'
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log('Received:', msg);
};

// Broadcast from server
fetch('http://localhost:4000/v1/realtime/broadcast/project', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <token>',
    'Content-Type': 'application/json',
    'x-project-id': 'your-project-id'
  },
  body: JSON.stringify({
    channel: 'updates',
    event: 'new',
    payload: { message: 'Hello subscribers!' }
  })
});
```

---

### Error Responses

All errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found"
  },
  "requestId": "uuid-request-id"
}
```

| Status | Code | Description |
|--------|------|-------------|
| `400` | `BAD_REQUEST` | Invalid input |
| `401` | `UNAUTHORIZED` | Missing/invalid auth |
| `403` | `FORBIDDEN` | Insufficient permissions |
| `404` | `NOT_FOUND` | Resource not found |
| `409` | `CONFLICT` | Duplicate/resource exists |
| `429` | `RATE_LIMIT` | Too many requests |
| `500` | `INTERNAL_ERROR` | Server error |

---

## Dashboard

A modern React-based admin dashboard for managing projects, users, licenses, database collections, storage, functions, messaging and settings.

### Dashboard Features

- JWT auth with auto-redirect to login
- Dark theme (Slate/Zinc palette)
- Responsive sidebar navigation
- TanStack Query for server state
- Zustand for client state (auth)

### Running the Dashboard

```bash
cd apps/dashboard
pnpm dev          # Vite dev server with HMR
pnpm build        # Production build
pnpm preview      # Preview production build
```

### Dashboard Pages

| Route | Description |
|-------|-------------|
| `/login` | Admin login |
| `/dashboard` | Overview stats |
| `/users` | User management |
| `/licensing` | License apps & keys |
| `/database` | Collections & documents |
| `/storage` | Buckets & files |
| `/functions` | Serverless functions |
| `/messaging` | Providers & templates |
| `/webhooks` | Webhook endpoints |
| `/realtime` | Channel stats |
| `/settings` | Project settings |

---

## SDK

The `@authify/sdk` package provides an isomorphic ESM client for browsers and Node.js.

### Installation

```bash
npm install @authify/sdk
# or
pnpm add @authify/sdk
```

### Usage

```typescript
import { AuthifyClient, AuthifyAuth, AuthifyRealtime } from '@authify/sdk';

const client = new AuthifyClient({
  baseUrl: 'http://localhost:4000',
  projectId: 'your-project-id',
  apiKey: 'your-api-key',
});

// Auth
const auth = new AuthifyAuth(client);
const session = await auth.login({ email: 'user@example.com', password: 'password' });
client.setToken(session.accessToken, session.refreshToken);

// Realtime
const rt = new AuthifyRealtime(client);
await rt.connect();
rt.subscribe('updates', 'new', (data) => {
  console.log('New update:', data);
});
rt.broadcast('updates', 'action', { foo: 'bar' });
```

### SDK Modules

| Class | Description |
|-------|-------------|
| `AuthifyClient` | Core HTTP client with auto token-refresh |
| `AuthifyAuth` | Login, register, 2FA, sessions |
| `AuthifyDatabase` | Collection & document CRUD |
| `AuthifyStorage` | Upload, download, transforms |
| `AuthifyFunctions` | Invoke & trigger functions |
| `AuthifyLicensing` | Key validation, activation |
| `AuthifyMessaging` | Send messages |
| `AuthifyWebhooks` | Trigger webhooks |
| `AuthifyRealtime` | WebSocket client |

---

## Testing

### API Tests

```bash
cd apps/api
pnpm test
```

Test coverage:
- **Unit**: crypto, password, hwid, jwt services
- **Integration**: health, OpenAPI docs, Swagger UI assets

### SDK Tests

```bash
cd packages/sdk
pnpm test
```

Test coverage:
- **Client**: request/response, token refresh, error handling, upload/download
- **Realtime**: connect, subscribe, broadcast, message handling, disconnect

### Running All Tests

```bash
pnpm test
```

---

## Deployment

### Production Build

```bash
# Build all packages
pnpm build

# API (requires Bun runtime)
cd apps/api
bun run dist/index.js

# Dashboard (static files)
cd apps/dashboard
pnpm build
# Serve dist/ with any static file server or CDN
```

### Docker (Recommended)

A `docker-compose.yml` is recommended for production deployment:

```yaml
services:
  api:
    build: ./apps/api
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=postgres://authify:password@postgres:5432/authify
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
      - minio

  dashboard:
    build: ./apps/dashboard
    ports:
      - "3001:80"

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: authify
      POSTGRES_PASSWORD: password
      POSTGRES_DB: authify
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data

volumes:
  postgres_data:
  minio_data:
```

### Environment Checklist for Production

- [ ] Generate fresh RSA key pair
- [ ] Set strong `ENCRYPTION_KEY` (32-byte hex)
- [ ] Set strong `API_KEY_SALT`
- [ ] Configure `NODE_ENV=production`
- [ ] Set `API_URL` and `DASHBOARD_URL` to public domains
- [ ] Configure OAuth2 redirect URLs in provider dashboards
- [ ] Enable HTTPS (set `Secure` cookie flag automatically in production)
- [ ] Run database migrations
- [ ] Configure firewall rules for Redis and MinIO

---

## Development

### Project Structure

```
authify/
├── apps/
│   ├── api/                 # Bun + Hono API server
│   │   ├── src/
│   │   │   ├── routes/      # Hono route handlers
│   │   │   ├── services/    # Business logic
│   │   │   ├── middleware/  # Auth, CORS, rate-limit, validation
│   │   │   ├── realtime/    # WebSocket handler + Redis broadcast
│   │   │   ├── lib/         # Env, logger, Redis, MinIO clients
│   │   │   ├── tests/       # Vitest tests
│   │   │   └── openapi.ts   # OpenAPI 3.1.0 spec
│   │   └── vitest.config.ts
│   └── dashboard/           # React 19 + Vite dashboard
│       ├── src/
│       │   ├── components/  # UI primitives
│       │   ├── pages/       # Route pages
│       │   ├── store/       # Zustand stores
│       │   └── lib/         # Utils
│       └── vite.config.ts
├── packages/
│   ├── db/                  # Drizzle ORM + schema
│   ├── shared/              # Shared errors + utilities
│   └── sdk/                 # Isomorphic TypeScript SDK
│       ├── src/
│       │   ├── client.ts    # Core HTTP client
│       │   ├── realtime.ts  # WebSocket client
│       │   ├── types.ts     # TypeScript interfaces
│       │   └── *.test.ts    # Vitest tests
│       └── vitest.config.ts
├── turbo.json               # Turborepo pipeline
└── pnpm-workspace.yaml      # Workspace definition
```

### Key Technologies

| Layer | Technology |
|-------|------------|
| Runtime | Bun 1.1+ |
| API Framework | Hono 4.5+ |
| ORM | Drizzle ORM 0.31+ |
| Validation | Zod 3.23+ |
| JWT | jose (RS256) |
| Queue | BullMQ 5.8+ |
| Frontend | React 19, Vite 5, Tailwind CSS v4 |
| State | Zustand, TanStack Query |
| Testing | Vitest 1.6+ |

### Adding a New API Route

1. Create a route file in `apps/api/src/routes/<feature>.ts`
2. Define Zod schemas for request validation
3. Mount the route in `apps/api/src/index.ts`
4. Add OpenAPI documentation to `apps/api/src/openapi.ts`
5. Add corresponding SDK methods in `packages/sdk/src/<feature>.ts`
6. Write tests in `apps/api/src/tests/` and `packages/sdk/src/<feature>.test.ts`

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Contributing

Contributions are welcome! Please open an issue or pull request on GitHub.

## Support

- GitHub Issues: [github.com/OAVA-Studios/Authify/issues](https://github.com/OAVA-Studios/Authify/issues)
- API Docs: [http://localhost:4000/docs](http://localhost:4000/docs) (when running locally)
