# ── Stage 1: compilar el frontend React ─────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

# Instalar dependencias primero (aprovecha caché de Docker)
COPY frontend/package*.json ./
RUN npm ci

# Copiar el resto del código y compilar
COPY frontend/ ./
RUN npm run build


# ── Stage 2: servidor Node.js en producción ──────────
FROM node:20-alpine AS production

WORKDIR /app

# Instalar solo dependencias de producción
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copiar el servidor
COPY backend/server.js ./

# Copiar el frontend compilado al directorio que sirve Express
COPY --from=frontend-build /app/frontend/dist ./public

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000
# DB_PATH se puede sobreescribir en Coolify para apuntar al volumen
ENV DB_PATH=/app/data/qr.db

# Crear directorio del volumen de datos
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "server.js"]