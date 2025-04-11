# Stage 1: Build dependencies and serve for development
FROM node:18-alpine AS development

WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
# Do this first to leverage Docker cache for dependencies
COPY package*.json ./
# Or if using yarn: COPY package.json yarn.lock ./

# Install dependencies
RUN npm install
# Or if using yarn: RUN yarn install

# Copy the rest of the application code
# This will be overwritten by the volume mount in dev, but good practice
COPY . .

# Default command for development stage (React Dev Server)
EXPOSE 3000
CMD ["npm", "start"]

# --- SEPARATOR ---

# Stage 2: Build React application for production
FROM development AS builder
# We inherit from the 'development' stage to get dependencies and code

WORKDIR /app
# We already have code and node_modules from the 'development' stage

# Build the application for production
RUN npm run build

# --- SEPARATOR ---

# Stage 3: Serve application with Nginx (Production Stage)
FROM nginx:stable-alpine AS production

# Copy built assets from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Expose port 80 (Nginx default)
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]