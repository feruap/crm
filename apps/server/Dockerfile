# Backend Dockerfile
FROM node:20-alpine AS base

FROM base AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/server/package*.json ./apps/server/
RUN npm install
COPY . .
RUN npm run build --workspace=apps/server

FROM base AS runner
WORKDIR /app
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/package*.json ./
RUN npm install --omit=dev
EXPOSE 3001
CMD ["node", "dist/index.js"]
