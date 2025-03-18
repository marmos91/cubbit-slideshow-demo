# ---------------------------
# Stage 1: Build the Next.js app
# ---------------------------
FROM node:18-alpine AS builder

# Create app directory
WORKDIR /app

# Install dependencies using npm ci (reproducible installs)
COPY package*.json ./
RUN npm ci

# Copy all source files
COPY . .

# Build the Next.js app (output: standalone in next.config.js)
RUN npm run build

# ---------------------------
# Stage 2: Create a minimal production image
# ---------------------------
FROM node:18-alpine AS runner

WORKDIR /app

# Set production environment variable
ENV NODE_ENV=production

# Copy the standalone build from the builder
# .next/standalone includes the compiled server and necessary node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Expose Next.js default port
EXPOSE 3000

# Run the standalone server directly
CMD ["node", "server.js"]
