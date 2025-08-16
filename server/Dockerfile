FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy pre-built client files (should be built locally first)
COPY client-build ./client-build

# Copy server package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy server source code
COPY src ./src
COPY tsconfig.json ./

# Build TypeScript only (client already built)
RUN npx tsc && npm run copy:client

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1

# Start the application
CMD ["npm", "start"]