# syntax=docker/dockerfile:1
FROM oven/bun:alpine AS builder

WORKDIR /app

# Copy workspace config and root package files
COPY package.json pnpm-workspace.yaml .prettierrc eslint.config.js tsconfig.json ./
COPY apps/dashboard/package.json apps/dashboard/tsconfig.json ./apps/dashboard/
COPY packages/sdk/package.json packages/sdk/tsconfig.json ./packages/sdk/
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/

# Install pnpm and dependencies
RUN npm install -g pnpm@9
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/dashboard/src ./apps/dashboard/src
COPY apps/dashboard/index.html ./apps/dashboard/
COPY apps/dashboard/vite.config.ts ./apps/dashboard/
COPY apps/dashboard/tailwind.config.ts ./apps/dashboard/
COPY apps/dashboard/postcss.config.js ./apps/dashboard/
COPY packages/sdk/src ./packages/sdk/src
COPY packages/shared/src ./packages/shared/src

# Build workspace packages first, then the dashboard
RUN pnpm --filter @authify/shared build
RUN pnpm --filter @authify/sdk build
RUN pnpm --filter @authify/dashboard build

# Production stage: serve static files with nginx
FROM nginx:alpine AS production

COPY --from=builder /app/apps/dashboard/dist /usr/share/nginx/html
COPY docker/nginx-dashboard.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
