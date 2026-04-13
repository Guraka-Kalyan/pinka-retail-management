FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm install

# Copy application files
COPY . .

# Set environment to production
ENV NODE_ENV=production

# Expose backend port
EXPOSE 5000

# Start server
CMD ["node", "server.js"]
