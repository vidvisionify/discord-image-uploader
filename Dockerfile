# Use Node 20 with Debian for sharp compatibility
FROM node:20-bullseye

# Set working directory
WORKDIR /app

# Install system dependencies required for sharp
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
 && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests first (better build caching)
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Set environment
ENV NODE_ENV=production

# Health check to ensure bot is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD pgrep -f "node index.js" || exit 1

# Start the bot
CMD ["node", "index.js"]
