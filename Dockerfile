# ── Stage 1: compilar el frontend React ─────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ── Stage 2: servidor Node.js ────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Sin better-sqlite3, no necesitamos python3/make/g++
COPY backend/package*.json ./
RUN npm install --omit=dev

COPY backend/server.js ./
COPY --from=frontend-build /app/frontend/dist ./public

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["node", "server.js"]
