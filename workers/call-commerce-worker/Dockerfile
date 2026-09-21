FROM node:22-slim

WORKDIR /app

# ============================================================
# DEPENDENCIES
# ============================================================

COPY package.json package-lock.json ./

RUN npm ci --omit=dev


# ============================================================
# CALL COMMERCE WORKER SOURCE
# ============================================================

COPY server.js ./
COPY call-commerce-mapping.js ./
COPY call-commerce-repository.js ./
COPY call-commerce-meta-worker.js ./
COPY call-commerce-queue.js ./


# ============================================================
# RUNTIME
# ============================================================

ENV NODE_ENV=production

CMD ["npm", "start"]
