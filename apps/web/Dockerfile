# Frontend Dockerfile
FROM node:20-alpine AS base

FROM base AS builder
WORKDIR /app

ARG BUILD_VERSION=dev
ENV NEXT_PUBLIC_BUILD_VERSION=$BUILD_VERSION

COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
RUN npm install
COPY . .
RUN npm run build --workspace=apps/web

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/package*.json ./
RUN npm install --omit=dev
EXPOSE 3000
CMD ["npm", "start"]
