# Real-Time Location Tracker
# Production image - single stage (no build step is required for this app)

FROM node:20-alpine

LABEL maintainer="Mahmud R. Farhan"
LABEL description="Real-Time Location Tracker with WebRTC Audio Support"

# Set working directory
WORKDIR /app

# Install production dependencies only.
# `npm ci` requires a clean lockfile state and gives reproducible installs.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy application files
COPY --chown=nodejs:nodejs . .

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3007

# Expose port
EXPOSE 3007

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3007/health || exit 1

# Switch to non-root user
USER nodejs

# Start the application
CMD ["node", "src/app.js"]
