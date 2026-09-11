FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl poppler-utils ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npm cache clean --force
COPY . .
RUN mkdir -p /data/documents && chown -R node:node /data /app
USER node
ENV NODE_ENV=production PORT=3400 STORAGE_DIR=/data/documents
EXPOSE 3400
CMD ["node", "server.mjs"]
