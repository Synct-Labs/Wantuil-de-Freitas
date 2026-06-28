# ─── Estagio 1: build ────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Instala deps (cacheado se package.json nao mudar)
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# Copia codigo e compila
COPY tsconfig*.json ./
COPY src ./src
COPY assets ./assets

RUN npx prisma generate
RUN npm run build

# ─── Estagio 2: producao ─────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Instala SO deps de producao
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npm cache clean --force
RUN npx prisma generate

# Copia build, assets e prisma client
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/assets ./assets

# Health check do Docker (alem do health endpoint da app)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q --spider http://localhost:3000/health/ping || exit 1

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
