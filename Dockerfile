# Marketing Agent Swarm Dockerfile
# Single-stage build using tsx for TypeScript

FROM node:20-alpine

WORKDIR /app

# Add curl for health checks
RUN apk add --no-cache curl

# Copy package files first for layer caching
COPY package*.json ./
COPY shared/package*.json ./shared/

# Install tsx globally for running TypeScript
RUN npm install -g tsx

# Install shared module dependencies
WORKDIR /app/shared
RUN npm install

WORKDIR /app

# Copy source files
COPY shared ./shared
COPY agents ./agents

# Build shared library
WORKDIR /app/shared
RUN npm run build

# Create non-root user (use available gid/uid)
RUN addgroup agent 2>/dev/null || true && adduser -G agent -s /bin/sh -D agent 2>/dev/null || true

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
