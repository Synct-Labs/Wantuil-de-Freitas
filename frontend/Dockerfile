# ─── Estagio 1: build ────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build estatico do Vite
ENV NODE_ENV=production
RUN npm run build

# ─── Estagio 2: nginx servindo estatico ─────────────────────
FROM nginx:1.27-alpine AS production

# Remove configuracao default
RUN rm /etc/nginx/conf.d/default.conf

# Configuracao otimizada para SPA (rotas client-side)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia o build do estagio anterior
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
