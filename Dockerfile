FROM node:18-alpine
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || true
COPY . .
RUN cd frontend && npm install && npm run build
RUN cd backend && npm install
RUN cp -r frontend/dist backend/public
EXPOSE 3010
ENV NODE_ENV=production
CMD ["node", "backend/server.js"]
