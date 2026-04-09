# Changelog

Todas as mudanças importantes deste projeto são documentadas aqui.
O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e
o versionamento segue [SemVer](https://semver.org/lang/pt-BR/).

## [2.2.0] — Versão atual · Produção segura

### Adicionado
- 🛡️ **helmet** — headers de segurança (XSS, clickjacking, MIME sniffing)
- 🚦 **express-rate-limit** — 60 req/min por IP, configurável via env
- 🔐 **Auth por token** via header `X-CZ-Token` (opcional em dev, obrigatório em prod)
- 🌐 **CORS restrito** — lista de origens via `ALLOWED_ORIGINS`
- 🏠 **Bind 127.0.0.1 por padrão** — não aceita conexões externas
- 🔑 **OAuth Shopee completo** com refresh automático de `access_token`:
  - `GET  /api/shopee/auth-url` — URL para autorizar a loja
  - `GET  /api/shopee/oauth-callback` — recebe code e salva tokens
  - `POST /api/shopee/refresh-token` — refresh manual
  - Refresh automático 5 min antes de expirar
- 💾 **tokenStore** — persiste tokens em `data/shopee-tokens.json` com perms 0600
- 🔁 **Retry com exponential backoff** em falhas transitórias (3 tentativas)
- 🏷️ **Erros categorizados**: validation / transient / http_error / shopee_logic_error / network
- 📜 **Logger estruturado** com rotação diária e redação de campos sensíveis
- 🛑 **Graceful shutdown** (SIGTERM/SIGINT) com timeout de 10s
- ✅ **Health check expandido** com versão, modo, env, auth_required
- 🧹 **Sanitização de erros** em produção (nunca vaza stack trace)
- ⚙️ **Config validada com fail-fast** — processo morre se env está inseguro em prod
- 🐳 **Dockerfile** multi-stage (~60 MB) com user não-root e healthcheck nativo
- 🍎 **macOS LaunchAgent** para auto-start + install/uninstall scripts
- 📘 **PRODUCTION.md** — guia completo de deploy (LaunchAgent, Docker, PM2, Render, Fly.io, Railway)

### Frontend
- ⚙️ **Modal de configurações** na sidebar — configura URL + token
- 🟢 **Badge de status do backend** no rodapé da sidebar (MOCK / LIVE / offline)
- 🔄 **Auto-verificação** a cada 30s
- 🏷️ **Mensagens de erro categorizadas** com dicas por tipo de falha
- 🔌 **Teste de conexão** mostra versão, modo e auth status

### Segurança
- Backend bind default em `127.0.0.1`
- helmet em todas as respostas
- Rate limiting previne força-bruta no token
- Logs redatam `partner_key`, `access_token`, `refresh_token`, `authorization`, `x-cz-token`, `password`, `secret`
- Erros em prod não vazam stack trace
- `data/shopee-tokens.json` criado com permissão 0600
- Config aborta em prod se `BIND_HOST=0.0.0.0` sem `CZ_API_TOKEN`

---

## [2.1.0]

### Adicionado
- 🛒 **Integração com Shopee** via backend Node.js/Express dedicado
  - Botão "Enviar para Shopee" no modal de detalhes
  - Modo **mock** (padrão, sem credenciais) para testes locais — retorna `item_id` fictício
  - Modo **live** que assina requisições HMAC-SHA256 e chama `/api/v2/product/add_item`
  - Validação de campos obrigatórios (nome, descrição ≥ 20 chars, preço, estoque, imagem)
  - Mapeamento automático do modelo interno → payload Shopee (dimensão, peso, galeria)
- 🏷️ Novos campos no formulário de produto: SKU, marca, peso, ID categoria, dimensões (L×A×P)
- 🎯 Estado de sincronização no produto: `shopee_status`, `shopee_item_id`, `shopee_synced_at`, `shopee_error`
- 🏷️ Badge visual de status no canto superior esquerdo do card (pending/published/error)
- 📊 Seção "Integração Shopee" no modal de detalhes com ID do anúncio, data de sincronização, modo e eventuais erros
- 🖥️ Backend separado em `backend/` com rotas `POST /api/shopee/create-product` e `GET /api/shopee/status`

### Segurança
- Credenciais Shopee ficam apenas no `.env` do backend, **nunca no frontend**
- `.env` versionado apenas como `.env.example` (template sem valores)
- HMAC-SHA256 assinado server-side com `crypto` nativo do Node
- CORS liberado apenas para localhost

---

## [2.0.0]

### Adicionado
- 🌐 **Importar do link** — cola um link de produto (AliExpress, Shopee, Amazon, Mercado Livre, Magalu) e o sistema extrai nome, imagens, descrição e preço automaticamente via CORS proxy com fallback em cascata.
- 🖼️ **Galeria de múltiplas imagens** — extração inteligente de várias fotos (og:image, JSON-LD, `<img>` tags, regex, `imagePathList` do AliExpress, `images[]` do Shopee), com grade de seleção, imagem principal e galeria extra.
- 📝 **Descrição do produto** — textarea multilinha no cadastro, exibida na tela de detalhes com botão "Copiar descrição" para integração futura com marketplaces.
- 🪟 **Modal de detalhes do produto** — clique no card abre uma visão completa (foto grande, badges de origem, descrição, financeiro detalhado, estoque, histórico).
- 📜 **Histórico de compras por produto** — cada produto pode ter múltiplas compras, cada uma com data, quantidade, custo, imposto, origem (nacional/importado) e observação.
- 🕒 **Timeline global de compras** — nova aba "Histórico" com linha do tempo de todas as compras, ordenadas por hora de registro, destacando a última.
- 💰 **Modelo de custo nacional/importado** — separação entre "custo do produto" e "imposto / taxas adicionais".
- 🧮 **Lógica de kits/pares** — comprar em unidades avulsas e vender em kits/pares com cálculo correto de lucro.
- 🎯 **Sugestão de preço automática** — dado um % de lucro desejado, o sistema calcula o preço de venda ideal considerando taxas da plataforma.
- 🔗 **Campo URL de imagem externa** — prioridade sobre upload local, com preview ao vivo, botões "Testar" e "Limpar", validação http/https.

### Corrigido
- Modal não fecha mais ao clicar fora (evita perda de preenchimento).
- Campos obrigatórios escondidos no modo edição não bloqueiam mais o submit.
- Select "Origem" estilizado no tema dark (antes aparecia azul nativo do macOS).
- Padding interno do modal de compra corrigido.
- Ordenação de compras no mesmo dia agora usa timestamp hora/minuto.

### Mudado
- 🎨 Tema refeito para **dark gamer preto + vermelho**.
- 🗂️ Produtos agora exibidos em **grade de cards** (substitui a tabela).
- 📁 Código organizado em `js/utils/` (format, calc, images) para facilitar manutenção.

---

## [1.2.0]

### Adicionado
- Importação de planilha Excel (.xlsx) usando SheetJS empacotada localmente.
- Leitura inteligente de múltiplos nomes de colunas (Produto, Custo Total, Taxa Shopee, etc).
- Conversão automática de taxa em formato decimal (0.3216 → 32.16%).
- Divisão de custo total pelo número de unidades para obter custo unitário.

---

## [1.1.0]

### Adicionado
- Filtros (apenas lucrativos, prejuízo, alto lucro >50%).
- Ordenação (mais recentes, maior lucro, maior margem, nome).
- Destaque visual para os 3 produtos mais lucrativos.
- Dashboard com resumo (total investido, lucro, margem média, quantidade).
- Top 5 mais lucrativos no dashboard.

---

## [1.0.0]

### Adicionado
- Cadastro básico de produtos (nome, custo, preço, quantidade, taxa, link, foto).
- Cálculos automáticos de valor líquido, lucro por unidade, lucro total e margem.
- Upload de foto via base64.
- Persistência em localStorage.
- Interface dashboard com cards.
- Tabela de produtos com editar/excluir.
