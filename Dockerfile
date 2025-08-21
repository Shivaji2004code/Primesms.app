# ============================================================================
# DOCKERFILE FOR PRIME SMS - WHATSAPP BUSINESS API
# Multi-stage build: Build client + server, then run production
# ============================================================================

# Stage 1: Build the client (React/Vite)
FROM node:18-alpine AS client-builder

WORKDIR /app/client
COPY client/package*.json ./
RUN npm install

COPY client/ ./
RUN npm run build

# Stage 2: Build the server (Node.js/TypeScript)
FROM node:18-alpine AS server-builder

WORKDIR /app/server
COPY server/package*.json ./
RUN npm install

COPY server/ ./
RUN npm run build

# Stage 3: Production runtime
FROM node:18-alpine AS production

# Install curl for health checks (Coolify compatible)
RUN apk add --no-cache curl

WORKDIR /app

# Install only production dependencies
COPY server/package*.json ./
RUN npm install --only=production

# Copy built server
COPY --from=server-builder /app/server/dist ./dist
COPY --from=server-builder /app/server/ecosystem.config.js ./

# Copy built client from server/client-build (where Vite always builds)
# Vite builds to /app/server/client-build from the client-builder stage
COPY --from=client-builder /app/server/client-build ./client-build

# Copy database migration files for initialization
COPY migration_add_app_secret.sql ./
COPY migration_fix_campaign_logs_constraints.sql ./
COPY database_schema.sql ./

# Create uploads directory
RUN mkdir -p uploads

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S prime -u 1001 -G nodejs

# Change ownership
RUN chown -R prime:nodejs /app

USER prime

# Health check (Coolify compatible with curl and fallback)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/health || node -e "require('http').get('http://localhost:'+(process.env.PORT||3000)+'/health', (res) => { \
    if (res.statusCode === 200) process.exit(0); \
    else process.exit(1); \
  }).on('error', () => process.exit(1))"

# Expose port (Coolify uses PORT env var)
EXPOSE 3000

# Environment variables for Coolify
ENV NODE_ENV=production
ENV PORT=3000
ENV SERVE_STATIC=true

# Start the application
CMD ["node", "dist/index.js"]