# Stage 1: Build the React application
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Provide API URL as a build argument and inject into environment
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Build the Vite application for production
RUN npm run build

# Stage 2: Serve the application using Nginx
FROM nginx:alpine

# Copy the build output to Nginx's default public directory
# Note: Vite builds to 'dist' by default
COPY --from=builder /app/dist /usr/share/nginx/html

# Replace default Nginx configuration with our SPA handler
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
