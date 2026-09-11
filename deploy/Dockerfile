FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --ignore-scripts
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_UPLOAD_TRANSPORT=local NEXT_PUBLIC_BASE_URL=https://invest.scalio.app NEXTAUTH_URL=https://invest.scalio.app NODE_OPTIONS=--max-old-space-size=4096
RUN npx prisma generate && npm run build
FROM node:24-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates poppler-utils && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3400 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/node_modules/prisma ./node_modules/prisma
COPY --from=build --chown=node:node /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build --chown=node:node /app/deploy ./deploy
RUN mkdir -p /data/documents && chown node:node /data/documents
USER node
CMD ["node","server.js"]
