# Use Node 20 (Debian-based)
FROM node:20-bullseye

# Set working directory
WORKDIR /app

# Install system dependencies for sharp and build tools
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
 && rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy rest of the app
COPY . .

# Health check: ensures node process is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD pgrep -f "node index.js" || exit 1

# Start the bot
CMD ["node", "index.js"]
