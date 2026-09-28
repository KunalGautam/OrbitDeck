# ==============================================================================
# OrbitDeck - Multi-stage Production Dockerfile
# ==============================================================================

# Stage 1: Build & Bundle
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Copy dependency manifests
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Clean install all dependencies (including devDependencies for building)
RUN npm ci

# Copy full monorepo source
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY apps/web ./apps/web

# Build all packages in topological order
RUN npm run build --workspace=@orbitdeck/shared
RUN npm run build --workspace=@orbitdeck/api
RUN npm run build --workspace=@orbitdeck/web

# Prune dev dependencies for lean production container
RUN npm prune --omit=dev

# ==============================================================================
# Stage 2: Minimal Production Runtime
# ==============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

# Install curl/wget for healthchecks
RUN apk add --no-cache wget

# Create non-root system user and data directory
RUN addgroup -S -g 10001 orbitdeck && \
    adduser -S -u 10001 -G orbitdeck orbitdeck && \
    mkdir -p /app/data && \
    chown -R orbitdeck:orbitdeck /app

# Copy root node_modules and package definitions
COPY --from=builder --chown=orbitdeck:orbitdeck /app/package.json /app/package.json
COPY --from=builder --chown=orbitdeck:orbitdeck /app/node_modules /app/node_modules

# Copy shared package
COPY --from=builder --chown=orbitdeck:orbitdeck /app/packages/shared/package.json /app/packages/shared/package.json
COPY --from=builder --chown=orbitdeck:orbitdeck /app/packages/shared/dist /app/packages/shared/dist

# Copy API service
COPY --from=builder --chown=orbitdeck:orbitdeck /app/apps/api/package.json /app/apps/api/package.json
COPY --from=builder --chown=orbitdeck:orbitdeck /app/apps/api/dist /app/apps/api/dist

# Copy Web client production bundle
COPY --from=builder --chown=orbitdeck:orbitdeck /app/apps/web/dist /app/apps/web/dist

USER orbitdeck

# Default runtime environment variables
ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0 \
    DB_ENGINE=sqlite \
    DB_PATH=/app/data/orbitdeck.sqlite \
    DB_RUN_MIGRATIONS=true \
    WEB_STATIC_PATH=/app/apps/web/dist

VOLUME ["/app/data"]

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

ENTRYPOINT ["node", "apps/api/dist/index.js"]
