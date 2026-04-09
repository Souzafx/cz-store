# ============================================
# CZ Store Backend — Dockerfile
# Multi-stage build para imagem enxuta (~60 MB)
# ============================================

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- Runtime ----
FROM node:20-alpine
WORKDIR /app

# Usuário não-root para segurança
RUN addgroup -g 1001 -S cz && adduser -u 1001 -S cz -G cz

# Copia dependências e código
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=cz:cz package.json ./
COPY --chown=cz:cz server.js config.js logger.js ./
COPY --chown=cz:cz routes ./routes
COPY --chown=cz:cz services ./services

# Cria diretórios de runtime (logs, data) com permissão adequada
RUN mkdir -p logs data && chown -R cz:cz logs data

USER cz

# Variáveis padrão
ENV NODE_ENV=production
ENV PORT=3000
ENV BIND_HOST=0.0.0.0
ENV LOG_LEVEL=info

EXPOSE 3000

# Healthcheck para orquestradores (Docker, K8s, Render, Fly.io)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
