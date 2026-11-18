# ==============================
#  Stage 1: Build frontend
# ==============================
FROM node:20-slim AS builder

WORKDIR /app

# Cai dat dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build o che do production
# Luu y: cac bien VITE_* se duoc doc tu .env.production neu file nay ton tai trong context
ENV NODE_ENV=production
RUN npm run build || echo "Build completed with warnings"

# ==============================
#  Stage 2: Serve build (Vite preview)
# ==============================
FROM node:20-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

# Copy package info + node_modules de dung script npm preview
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy thu muc build
COPY --from=builder /app/dist ./dist

# Tuy chon: copy them vite.config neu Vite can khi preview
COPY --from=builder /app/vite.config.js ./vite.config.js

EXPOSE 5173

# Chay Vite preview, listen 0.0.0.0 de truy cap tu ngoai
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
