# Use Node 20 for ES module & modern JS support 
FROM node:20-bullseye

# Set working directory
WORKDIR /app

# Install system dependencies for sharp
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
 && rm -rf /var/lib/apt/lists/*

# Copy package.json first to leverage Docker cache
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your project files
COPY . .

# Health check: make sure node process is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD pgrep -f "node index.js" || exit 1

# Start the bot
CMD ["node", "index.js"]
