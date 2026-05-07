# syntax=docker/dockerfile:1
FROM oven/bun:alpine AS base

# Install dependencies for native modules
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy workspace config and root package files
COPY package.json pnpm-workspace.yaml .prettierrc eslint.config.js tsconfig.json ./
COPY apps/api/package.json apps/api/tsconfig.json ./apps/api/
COPY packages/db/package.json packages/db/tsconfig.json ./packages/db/
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/

# Install pnpm and all dependencies
RUN npm install -g pnpm@9
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/api/src ./apps/api/src
COPY packages/db/src ./packages/db/src
COPY packages/shared/src ./packages/shared/src

# Build workspace packages first, then the API
RUN pnpm --filter @authify/shared build
RUN pnpm --filter @authify/db build
RUN pnpm --filter @authify/api build

# Production stage
FROM oven/bun:alpine AS production

WORKDIR /app

# Copy built artifacts and node_modules from base
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/apps/api/dist ./apps/api/dist
COPY --from=base /app/packages/db/dist ./packages/db/dist
COPY --from=base /app/packages/shared/dist ./packages/shared/dist
COPY --from=base /app/apps/api/package.json ./apps/api/
COPY --from=base /app/packages/db/package.json ./packages/db/
COPY --from=base /app/packages/shared/package.json ./packages/shared/
COPY package.json pnpm-workspace.yaml ./

ENV NODE_ENV=production
ENV API_PORT=3000

EXPOSE 3000

CMD ["bun", "run", "apps/api/dist/index.js"]
