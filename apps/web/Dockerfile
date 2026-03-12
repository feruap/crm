# Frontend Dockerfile
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS builder
# Copy root package.json and workspace package.json files
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY apps/server/package*.json ./apps/server/
# Install dependencies
RUN npm install

# Copy everything
COPY . .

# Build the web app
# Enforce the API URL directly into the Dockerfile for the Next.js production bundle
ENV NEXT_PUBLIC_SERVER_URL=https://api-crm.botonmedico.com
RUN npm run build --workspace=apps/web

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy necessary files for production
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/package*.json ./
# Install only production dependencies
RUN npm install --omit=dev

EXPOSE 3000
CMD ["npm", "start"]

