# ============================================================================
# DOCKERFILE FOR PRIME SMS - WHATSAPP BUSINESS API
# Multi-stage build: Build client + server, then run production
# Optimized for Coolify deployment with health checks and security
# ============================================================================

# Stage 1: Build the client (React/Vite)
FROM node:20-alpine AS client-builder

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app/client

# Copy package files and install dependencies
COPY client/package*.json ./
RUN npm ci --only=production --ignore-scripts && \
    npm ci --only=development --ignore-scripts

# Copy source and build
COPY client/ ./
RUN npm run build

# Stage 2: Build the server (Node.js/TypeScript)
FROM node:20-alpine AS server-builder

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app/server

# Copy package files and install all dependencies
COPY server/package*.json ./
RUN npm ci --ignore-scripts

# Copy source code and build
COPY server/ ./
RUN npm run build

# Stage 3: Production runtime
FROM node:20-alpine AS production

# Install runtime dependencies and security tools
RUN apk add --no-cache \
    curl \
    dumb-init \
    ca-certificates \
    tzdata

# Set timezone
ENV TZ=Asia/Kolkata
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S primesms && \
    adduser -S primesms -u 1001 -G primesms

# Install only production dependencies
COPY server/package*.json ./
RUN npm ci --only=production --ignore-scripts && \
    npm cache clean --force

# Copy built server with proper ownership
COPY --from=server-builder --chown=primesms:primesms /app/server/dist ./dist

# Copy built client with proper ownership
COPY --from=client-builder --chown=primesms:primesms /app/client/dist ./client-build

# Create necessary directories with proper ownership
RUN mkdir -p uploads logs tmp && \
    chown -R primesms:primesms /app

# Switch to non-root user
USER primesms

# Expose port
EXPOSE 3000

# Environment variables for production
ENV NODE_ENV=production
ENV PORT=3000
ENV STATIC_DIR=./client-build
ENV CORS_ORIGINS=*
ENV APP_VERSION=1.2.0
ENV MAX_REQUEST_SIZE=10mb
ENV SESSION_TIMEOUT=86400000
ENV LOG_LEVEL=info

# Health check optimized for Coolify
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:$PORT/healthz || exit 1

# Security labels
LABEL maintainer="Prime SMS Team" \
      version="1.2.0" \
      description="Prime SMS WhatsApp Business API with Pricing System" \
      security.scan="enabled"

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]