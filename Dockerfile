# ── Stage 1: compilar el frontend React ─────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build


# ── Stage 2: servidor Node.js en producción ──────────
FROM node:20-alpine AS production

WORKDIR /app

# Herramientas necesarias para compilar better-sqlite3
RUN apk add --no-cache python3 make g++

COPY backend/package*.json ./
RUN npm install --omit=dev

COPY backend/server.js ./
COPY --from=frontend-build /app/frontend/dist ./public

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/qr.db

RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "server.js"]
