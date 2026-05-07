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
git clone https://github.com/authify/authify.git
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

The API is documented with a comprehensive OpenAPI 3.1.0 specification served at runtime:

- **OpenAPI JSON**: `GET /openapi.json`
- **Swagger UI**: `GET /docs`

### Authentication

Two security schemes are supported:

1. **Bearer Auth** (`Authorization: Bearer <jwt>`) — for user sessions
2. **API Key** (`x-api-key: <key>`) — for service-to-service auth

### Endpoints

| Tag | Base Path | Operations |
|-----|-----------|------------|
| Auth | `/v1/auth` | register, login, logout, refresh, me, 2FA, sessions |
| OAuth | `/v1/auth/oauth` | Google, GitHub, Discord, Microsoft OAuth2 flows |
| Licensing | `/v1/licensing` | apps, keys, activate, validate, heartbeat, variables, blacklist |
| Database | `/v1/database` | collections, policies, documents |
| Storage | `/v1/storage` | buckets, uploads, files, transforms |
| Functions | `/v1/functions` | create, invoke, trigger, executions |
| Messaging | `/v1/messaging` | providers, templates, send |
| Webhooks | `/v1/webhooks` | endpoints, deliveries, trigger |
| Realtime | `/v1/realtime` | WebSocket upgrade, channels, broadcast |

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

- GitHub Issues: [github.com/authify/authify/issues](https://github.com/authify/authify/issues)
- API Docs: [http://localhost:4000/docs](http://localhost:4000/docs) (when running locally)
