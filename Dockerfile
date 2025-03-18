# Stage 1: Build
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies (using npm ci for reproducible installs)
COPY package*.json ./
RUN npm ci

# Copy all files and build the Next.js app
COPY . .
RUN npm run build

# Stage 2: Production image
FROM node:18-alpine AS runner

WORKDIR /app

# Set environment variable for production
ENV NODE_ENV=production

# Copy built app and necessary files from builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/node_modules ./node_modules

# Expose the port Next.js listens on (default 3000)
EXPOSE 3000

# Start the Next.js server
CMD ["npm", "run", "start"]
