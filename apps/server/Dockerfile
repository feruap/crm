# Backend Dockerfile
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS builder
# Copy root package.json and workspace package.json files
COPY package*.json ./
COPY apps/server/package*.json ./apps/server/
COPY apps/web/package*.json ./apps/web/
# Install dependencies for the whole workspace
RUN npm install

# Copy everything
COPY . .

# Build the server
RUN npm run build --workspace=apps/server

FROM base AS runner
WORKDIR /app
# Copy built artifacts and necessary files
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/package*.json ./
# Install only production dependencies
RUN npm install --omit=dev

EXPOSE 3001
CMD ["node", "dist/index.js"]

