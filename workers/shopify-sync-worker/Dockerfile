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
COPY shopify-customer-writer.js ./
COPY shopify-product-writer.js ./

COPY shopify-bulk.js ./
COPY shopify-backfill-state.js ./
COPY shopify-bulk-loader.js ./
COPY shopify-gcs.js ./
COPY shopify-bq-stage.js ./
COPY shopify-bulk-warehouse.js ./
COPY shopify-customer-bulk-warehouse.js ./
COPY shopify-product-bulk-warehouse.js ./
COPY shopify-backfill-processor.js ./
COPY shopify-backfill-supervisor.js ./

# ============================================================
# SHOPIFY INCREMENTAL ORCHESTRATION
# ============================================================

# Orders
COPY shopify-incremental-state.js ./
COPY shopify-incremental-supervisor.js ./

# Customers
COPY shopify-customer-incremental-state.js ./
COPY shopify-customer-incremental-supervisor.js ./

# Products
COPY shopify-product-incremental-state.js ./
COPY shopify-product-incremental-supervisor.js ./


# ============================================================
# RUNTIME
# ============================================================

ENV NODE_ENV=production

CMD ["npm", "start"]