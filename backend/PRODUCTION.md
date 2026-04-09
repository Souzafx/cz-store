# 🚀 CZ Store — Guia de Produção

Este documento cobre como colocar o backend em produção de forma **segura**,
com três cenários suportados:

1. **Local always-on** no seu Mac (LaunchAgent) — mais simples, zero custo
2. **Docker** em VPS ou cloud (Render, Fly.io, Railway) — acessível de qualquer lugar
3. **PM2** num servidor Linux tradicional

---

## 🛡️ Checklist de segurança (obrigatório antes de prod)

Antes de defer `NODE_ENV=production`, garanta:

- [ ] `.env` criado com `MOCK_MODE=false` e credenciais reais da Shopee
- [ ] `CZ_API_TOKEN` gerado forte: `openssl rand -hex 32`
- [ ] `BIND_HOST=127.0.0.1` (ou `0.0.0.0` atrás de um proxy reverso com HTTPS)
- [ ] `ALLOWED_ORIGINS` com o domínio exato do frontend (se usar)
- [ ] `RATE_LIMIT_MAX` adequado ao volume esperado (default 60/min)
- [ ] Diretório `logs/` com permissões 700 (só o dono lê)
- [ ] Arquivo `data/shopee-tokens.json` NUNCA versionado (já está no gitignore)
- [ ] Backup do `data/` em local seguro
- [ ] Shopee: aplicação Partner aprovada e autorizada para sua loja

### Gerar token forte
```bash
openssl rand -hex 32
# Exemplo: 8f3a4b2c1d9e5f7a0b8c6d4e3f2a1b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a
```

### Autorizar a Shopee (fluxo OAuth)

Com o backend rodando e as credenciais `PARTNER_ID/KEY/SHOP_ID` preenchidas:

```bash
# 1. Pegue a URL de autorização
curl http://localhost:3000/api/shopee/auth-url \
  -H "X-CZ-Token: SEU_TOKEN"

# Resposta: { "auth_url": "https://partner.shopeemobile.com/api/v2/shop/auth_partner?..." }
```

2. Abra essa URL num navegador e autorize a loja
3. A Shopee redireciona de volta para `http://localhost:3000/api/shopee/oauth-callback`
4. O backend automaticamente troca o `code` por `access_token` + `refresh_token`
5. Os tokens são salvos em `data/shopee-tokens.json`
6. A partir daí, o access_token é **renovado automaticamente** 5 minutos antes de expirar

---

## 📦 Cenário 1: LaunchAgent no macOS (recomendado para uso pessoal)

O backend roda em background desde o login, reinicia sozinho se cair.

### Instalar
```bash
cd "/Users/davyd.dg12gmail.com/Documents/CZ automação/backend"
./launchd/install.sh
```

O script:
- Detecta o `node` instalado
- Instala dependências se necessário
- Gera o `.plist` com os paths corretos
- Carrega o LaunchAgent via `launchctl`
- Confirma que está rodando

### Verificar status
```bash
launchctl list | grep czstore
curl http://localhost:3000/health
tail -f logs/$(date +%Y-%m-%d).log
```

### Logs
- **Aplicação:** `backend/logs/YYYY-MM-DD.log` (rotação diária)
- **stdout do launchd:** `backend/logs/launchd.out.log`
- **stderr do launchd:** `backend/logs/launchd.err.log`

### Parar temporariamente
```bash
launchctl unload ~/Library/LaunchAgents/com.czstore.backend.plist
```

### Reiniciar
```bash
launchctl unload ~/Library/LaunchAgents/com.czstore.backend.plist
launchctl load ~/Library/LaunchAgents/com.czstore.backend.plist
```

### Remover
```bash
./launchd/uninstall.sh
```

---

## 🐳 Cenário 2: Docker (qualquer servidor/cloud)

### Build local
```bash
cd backend
docker build -t cz-store-backend .
```

### Rodar localmente
```bash
docker run -d \
  --name cz-backend \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  cz-store-backend
```

> ⚠️ Monte `data/` e `logs/` como volumes para **persistir tokens** entre restarts
> do container.

### Deploy em cloud (3 opções simples)

#### Render (free tier disponível)
1. Crie um Web Service em https://dashboard.render.com/
2. Conecte seu repo GitHub (`Souzafx/cz-store`)
3. **Root Directory:** `backend`
4. **Runtime:** Docker
5. **Environment:** adicione todas as variáveis do `.env`
6. **Disk:** crie um disco persistente em `/app/data`
7. Deploy

#### Fly.io (free tier disponível)
```bash
cd backend
fly launch              # gera fly.toml interativo
fly secrets set SHOPEE_PARTNER_ID=... SHOPEE_PARTNER_KEY=... CZ_API_TOKEN=...
fly volumes create cz_data --size 1
fly deploy
```

#### Railway
1. https://railway.app/ → New Project → Deploy from GitHub
2. Selecione o repo e aponte o root para `backend/`
3. Adicione as variáveis em Variables
4. Adicione um volume persistente montado em `/app/data`
5. Deploy

### Depois do deploy remoto
- Aponte o **frontend** para a nova URL (via Configurações no app)
- **Obrigatório:** definir `CZ_API_TOKEN` e colocar em Configurações também
- **Obrigatório:** `BIND_HOST=0.0.0.0` (já é o default do Docker)
- **Obrigatório:** `ALLOWED_ORIGINS` com o domínio do frontend

---

## 🟢 Cenário 3: PM2 em VPS Linux

```bash
npm install -g pm2
cd backend
pm2 start server.js --name cz-backend
pm2 save
pm2 startup  # gera comando para iniciar no boot
```

### Comandos úteis
```bash
pm2 status          # ver processos
pm2 logs cz-backend # logs em tempo real
pm2 restart cz-backend
pm2 monit           # dashboard interativo
```

---

## 🔐 Variáveis de ambiente em produção (referência)

```env
# OBRIGATÓRIOS EM PROD
NODE_ENV=production
MOCK_MODE=false
CZ_API_TOKEN=<gere com openssl rand -hex 32>
SHOPEE_PARTNER_ID=<do painel Shopee>
SHOPEE_PARTNER_KEY=<do painel Shopee>
SHOPEE_SHOP_ID=<da sua loja>

# OPCIONAIS
PORT=3000
BIND_HOST=127.0.0.1                    # ou 0.0.0.0 em Docker/cloud
ALLOWED_ORIGINS=https://seu-dominio.com
RATE_LIMIT_MAX=60
RATE_LIMIT_WINDOW_MS=60000
LOG_LEVEL=info
SHOPEE_BASE_URL=https://partner.shopeemobile.com
```

---

## 🩺 Monitoramento

### Health check
```bash
curl http://localhost:3000/health
```

Retorna status, versão, modo, ambiente e se há tokens válidos.

### Logs estruturados
Todos os logs ficam em `logs/YYYY-MM-DD.log` no formato:
```
[2026-04-09T19:09:20.915Z] INFO  request {"id":"vgweh57z","method":"POST","url":"/create-product","status":401,"ms":3}
```

Cada request tem um `id` único de 8 chars para correlação.

### Campos sensíveis redatados
O logger redata automaticamente qualquer chave contendo:
- `partner_key`, `access_token`, `refresh_token`
- `authorization`, `x-cz-token`
- `password`, `secret`

### Integração com serviços externos
Para enviar os logs para Datadog/Sentry/LogDNA etc, basta fazer tail do
arquivo e pipe para a CLI do serviço — o formato JSON já está pronto.

---

## 🆘 Troubleshooting

### "Configuração inválida para produção" ao iniciar
O `config.js` validou e encontrou problemas. A mensagem lista o que falta.
Corrija o `.env` e reinicie.

### 401 em todas as chamadas
- Confira se `CZ_API_TOKEN` no frontend = `CZ_API_TOKEN` no backend
- Abra **Configurações** no app → **Testar conexão**

### "Falha ao renovar access_token"
O `refresh_token` expirou (30 dias sem uso) ou foi invalidado. Refaça o
fluxo de autorização via `/api/shopee/auth-url`.

### Backend fica reiniciando (LaunchAgent)
```bash
tail -100 backend/logs/launchd.err.log
```

Erros comuns:
- Node não encontrado no PATH → reinstale o LaunchAgent (ele detecta o node atual)
- Permissão em `data/` → `chmod 700 backend/data`

### Rate limit atingido
Por padrão 60 requests/minuto. Aumente via `RATE_LIMIT_MAX` se necessário,
ou investigue loops no frontend.

---

## 🔄 Atualização do backend

### Com LaunchAgent
```bash
cd backend
git pull
npm install
launchctl unload ~/Library/LaunchAgents/com.czstore.backend.plist
launchctl load ~/Library/LaunchAgents/com.czstore.backend.plist
```

### Com Docker
```bash
docker pull cz-store-backend:latest   # se usar registry
# ou: docker build -t cz-store-backend .
docker stop cz-backend && docker rm cz-backend
docker run -d ... (mesmo comando de antes)
```

### Com PM2
```bash
git pull
npm install
pm2 restart cz-backend
```

---

## 📊 Métricas de produção (v2.2.0)

Em testes locais (MacBook M1, modo mock):

| Métrica | Valor |
|---|---|
| Latência p50 (create-product) | ~650ms (simulando latência Shopee) |
| Latência p50 (health) | <5ms |
| Memória idle | ~50 MB |
| Memória sob carga | ~80 MB |
| Requests/s sustentado | 100+ (limitado pelo rate limit) |
| Tempo de boot | ~180ms |
| Tempo de shutdown | <100ms |

Com o endpoint real da Shopee, latência fica em 400-1200ms dependendo da região.
