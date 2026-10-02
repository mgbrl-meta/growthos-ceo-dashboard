FROM node:22-slim

WORKDIR /app

# ============================================================
# DEPENDENCIES
#
# npm install is intentional here: the migration bundle updates the worker
# dependency manifest and the installer refreshes package-lock.json on the
# operator workstation. Cloud Run source builds remain self-contained even
# before that refreshed lockfile is committed.
# ============================================================

COPY package.json package-lock.json ./
RUN npm install --omit=dev --no-audit --no-fund

# ============================================================
# CALL COMMERCE WORKER SOURCE
# ============================================================

COPY server.js ./
COPY postgres.js ./
COPY call-commerce-mapping.js ./
COPY call-commerce-lifecycle.js ./
COPY call-commerce-repository.js ./
COPY call-commerce-meta-worker.js ./
COPY call-commerce-meta-publisher.js ./
COPY call-commerce-analytics-worker.js ./
COPY call-commerce-queue.js ./

# ============================================================
# RUNTIME
# ============================================================

ENV NODE_ENV=production
CMD ["npm", "start"]
