FROM node:22-slim

WORKDIR /app

# ============================================================
# DEPENDENCIES
# ============================================================

COPY package.json package-lock.json ./

RUN npm ci --omit=dev


# ============================================================
# SHOPIFY WORKER SOURCE
# ============================================================

COPY server.js ./
COPY shopify-context.js ./
COPY shopify-auth.js ./
COPY shopify-api.js ./
COPY shopify-writer.js ./
COPY shopify-bulk.js ./
COPY shopify-backfill-state.js ./
COPY shopify-bulk-loader.js ./


# ============================================================
# RUNTIME
# ============================================================

ENV NODE_ENV=production

CMD ["npm", "start"]