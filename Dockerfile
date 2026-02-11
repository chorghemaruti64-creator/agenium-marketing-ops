# Marketing Agent Swarm Dockerfile
# Single-stage build using tsx for TypeScript

FROM node:20-alpine

WORKDIR /app

# Add curl for health checks
RUN apk add --no-cache curl

# Copy package files first for layer caching
COPY package*.json ./
COPY shared/package*.json ./shared/

# Install all dependencies (including dev for tsx)
WORKDIR /app/shared
RUN npm install

WORKDIR /app

# Copy source files
COPY shared ./shared
COPY agents ./agents

# Build shared library
WORKDIR /app/shared
RUN npm run build

# Create non-root user
RUN addgroup -g 1000 agent && adduser -u 1000 -G agent -s /bin/sh -D agent

# Create directories
RUN mkdir -p /workspace /moltbook /logs /config && \
    chown -R agent:agent /app /workspace /moltbook /logs /config

USER agent

WORKDIR /app

# Health check (overridden per service)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Default command (overridden per service)
CMD ["npx", "tsx", "agents/orchestrator/index.ts"]
