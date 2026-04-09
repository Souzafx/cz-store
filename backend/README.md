# 🛒 CZ Store — Backend Shopee

Servidor Express local que faz a ponte entre o frontend (vanilla JS) e a
**Shopee Partner API v2**. Necessário porque a API da Shopee exige assinatura
HMAC-SHA256 com chave secreta, que não pode ficar exposta no navegador.

---

## 🚀 Como rodar

### Pré-requisitos
- **Node.js 18+** (para rodar `node --watch`) — verifique com `node -v`

### Passo a passo

```bash
cd backend

# 1. Instale as dependências
npm install

# 2. Copie o .env de exemplo e edite
cp .env.example .env

# 3. Inicie o servidor
npm start
```

O servidor sobe em `http://localhost:3000`.

### Modo de desenvolvimento (auto-reload)
```bash
npm run dev
```

---

## ⚙️ Modos de operação

### 🧪 Mock (padrão)
Sem nenhuma configuração, o backend já funciona em **modo simulação** —
ele aceita requisições do frontend e retorna um `item_id` fictício, sem
chamar a Shopee real. Perfeito para testar o fluxo completo de UI sem
precisar de credenciais.

Verifique o modo atual em `http://localhost:3000/health`:

```json
{
  "status": "ok",
  "mode": "mock",
  "configured": false
}
```

### 🔴 Live (Shopee real)
Para enviar de verdade para a Shopee:

1. Cadastre-se em https://partner.shopeemobile.com/
2. Crie uma aplicação Partner
3. Obtenha as credenciais:
   - `SHOPEE_PARTNER_ID`
   - `SHOPEE_PARTNER_KEY`
4. Autorize sua loja e obtenha:
   - `SHOPEE_SHOP_ID`
   - `SHOPEE_ACCESS_TOKEN` (via OAuth — o token expira e precisa ser renovado)
5. Preencha o `.env` e defina `MOCK_MODE=false`
6. Reinicie: `npm start`

> ⚠️ O `access_token` da Shopee expira em 4 horas. Para produção você
> precisa implementar também o refresh_token flow, que não está incluído
> nesta primeira versão. Para desenvolvimento, basta gerar um token novo
> manualmente quando expirar.

---

## 📡 Endpoints

### `POST /api/shopee/create-product`
Cria um produto novo na Shopee.

**Body:**
```json
{
  "name": "Micro Switch Kailh GM 8.0",
  "description": "Micro switch de alta precisão para mouses gamers...",
  "price": 32.90,
  "stock": 50,
  "sku": "GM8-CZSTORE",
  "category_id": 100012,
  "brand": "Kailh",
  "weight": 0.1,
  "dimensions": { "length": 10, "width": 10, "height": 5 },
  "image": "https://exemplo.com/principal.jpg",
  "images": [
    "https://exemplo.com/1.jpg",
    "https://exemplo.com/2.jpg"
  ],
  "condition": "NEW"
}
```

**Resposta (sucesso):**
```json
{
  "mode": "mock",
  "success": true,
  "item_id": 1234567890,
  "status": "published",
  "message": "Produto enviado com sucesso (modo simulação)",
  "synced_at": "2026-04-09T18:22:31.000Z"
}
```

**Resposta (erro de validação):**
```json
{
  "success": false,
  "error": "Descrição muito curta (mínimo 20 caracteres)"
}
```

### `GET /api/shopee/status`
Retorna o modo atual do backend.

### `GET /health`
Health check genérico.

---

## 🔒 Segurança

- `.env` **nunca é versionado** (está no `.gitignore`).
- Chave secreta (`SHOPEE_PARTNER_KEY`) nunca chega ao frontend.
- Todas as chamadas à Shopee são assinadas com HMAC-SHA256 no backend.
- CORS liberado para `localhost` (ajuste se publicar em servidor).

---

## 🐛 Debug

- Logs completos aparecem no terminal onde o servidor está rodando
- Cada requisição imprime método + URL
- Criação de produto imprime nome + item_id resultante
- Erros da Shopee são logados com detalhes

### Forçar erro simulado
Para testar o fluxo de erro no frontend, sem precisar quebrar nada:

```bash
MOCK_FAIL=true npm start
```

Isso faz o modo mock sempre responder com erro.

---

## 📁 Estrutura

```
backend/
├── package.json
├── .env.example          # template — copie para .env
├── .env                  # (criado por você, não versionado)
├── server.js             # bootstrap Express
├── routes/
│   └── shopeeRoutes.js   # POST /create-product, GET /status
└── services/
    └── shopeeService.js  # validação, assinatura HMAC, mapeamento, fetch
```

---

## 🔮 Roadmap futuro

- [ ] Refresh automático do `access_token`
- [ ] Endpoint `PUT /update-product` para atualizar produtos existentes
- [ ] Endpoint `DELETE /unlist-product` para desativar anúncios
- [ ] Busca de categorias via `/api/v2/product/get_category`
- [ ] Upload de imagens via `/api/v2/media_space/upload_image` (quando o CDN
      da URL direta não é aceito pela Shopee)
- [ ] Webhook de confirmação de status
