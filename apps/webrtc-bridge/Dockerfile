# Use Debian-based image (not Alpine) because @roamhq/wrtc prebuilt binaries
# target glibc. Alpine uses musl and would require recompiling native addons.
FROM node:20-slim

WORKDIR /app

# Copy manifests first for layer caching
COPY package*.json ./

# Install dependencies (including native addons)
RUN npm ci --omit=dev || npm install --omit=dev

# Copy source and build
COPY . .
RUN npm run build

# HTTP port
EXPOSE 4000
# UDP range for WebRTC media (must match docker-compose + coturn)
EXPOSE 10000-10100/udp

CMD ["node", "dist/index.js"]
