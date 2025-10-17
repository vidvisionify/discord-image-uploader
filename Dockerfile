# Use Node 20 for full ES module and modern JS support
FROM node:20-bullseye

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json first for caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the code
COPY . .

# Expose optional ports (not strictly needed here)
# EXPOSE 3000

# Default command
CMD ["node", "index.js"]
