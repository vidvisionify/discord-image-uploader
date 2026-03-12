# Use Node 20 for ES module & modern JS support
FROM node:20-bullseye

# Set working directory
WORKDIR /app

# Install system dependencies required by sharp
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
 && rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json first (better caching)
COPY package*.json ./

# Install node dependencies
RUN npm install

# Copy application files
COPY . .

# Set production environment
ENV NODE_ENV=production

# Health check to ensure bot process is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD pgrep -f "node index.js" || exit 1

# Start the bot
CMD ["node", "index.js"]
