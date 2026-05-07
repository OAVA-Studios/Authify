# Authify

Self-hostable Backend-as-a-Service Platform combining the best of auth.gg, Supabase, and Appwrite.

## Monorepo Structure

```
authify/
├── apps/
│   ├── api/                # Hono.js API server
│   ├── dashboard/          # React admin UI
│   └── functions-runtime/  # Isolated function execution
├── packages/
│   ├── sdk/                # TypeScript SDK
│   ├── db/                 # Drizzle ORM schema + migrations
│   └── shared/             # Common types, errors, utilities
├── docker/
│   ├── api.Dockerfile
│   └── dashboard.Dockerfile
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
└── README.md
```

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure
pnpm docker:dev

# 3. Run database migrations
pnpm db:migrate

# 4. Start dev servers
pnpm dev
```

## Modules

- **Auth** – JWT + OAuth2 + Sessions + 2FA
- **Licensing** – HWID locking, key management, blacklist
- **Database** – Auto-REST, RLS, GraphQL, Realtime
- **Storage** – MinIO buckets, chunked upload, image transforms
- **Functions** – Isolated serverless runtime
- **Realtime** – WebSocket channels, presence, broadcast
- **Messaging** – Email/SMS/Push with templates
- **Webhooks** – HMAC-signed event delivery

## License

MIT
