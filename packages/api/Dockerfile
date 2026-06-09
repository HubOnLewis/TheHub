# packages/api/Dockerfile
# Production build for The Hub CRM API.
# ─────────────────────────────────────────────────────────────────
# Build:  docker build -f packages/api/Dockerfile -t hub-crm-api .
# Run:    docker run -p 3001:3001 --env-file .env hub-crm-api
# ─────────────────────────────────────────────────────────────────

# ── Stage 1: Builder ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json package-lock.json* ./
COPY packages/api/package.json     ./packages/api/
COPY packages/shared/package.json  ./packages/shared/
# web package.json needed by npm workspaces install
COPY packages/web/package.json     ./packages/web/

# Install all workspace deps (including devDeps — tsc lives here)
RUN npm install

# Copy source and config
COPY tsconfig.base.json            ./
COPY packages/shared/              ./packages/shared/
COPY packages/api/                 ./packages/api/

# Build shared first — API imports it at runtime
RUN npm run build --workspace=packages/shared

# Build API
RUN npm run build --workspace=packages/api


# ── Stage 2: Runner ──────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Copy workspace manifests
COPY package.json package-lock.json* ./
COPY packages/api/package.json     ./packages/api/
COPY packages/shared/package.json  ./packages/shared/
COPY packages/web/package.json     ./packages/web/

# Production deps only — no typescript/tsx/etc
RUN npm install --omit=dev

# Copy compiled outputs from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/api/dist    ./packages/api/dist

EXPOSE 3001

# Do NOT use `npm start` — that script includes --env-file=../../.env
# which crashes if .env doesn't exist (env vars injected by host/Render instead)
CMD ["node", "packages/api/dist/server.js"]
