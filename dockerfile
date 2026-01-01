# Real-Time Location Tracker
# Multi-stage build for production

# Stage 1: Build
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci --only=production

# Stage 2: Production
FROM node:20-alpine AS production

# Labels
LABEL maintainer="Mahmud R. Farhan"
LABEL description="Real-Time Location Tracker with WebRTC Audio Support"
LABEL version="4.0.0"

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application files
COPY --chown=nodejs:nodejs . .

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3007

# Expose port
EXPOSE 3007

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3007/ || exit 1

# Switch to non-root user
USER nodejs

# Start the application
CMD ["node", "app.js"]
