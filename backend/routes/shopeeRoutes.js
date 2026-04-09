/* ============================================
   shopeeRoutes.js — Rotas HTTP do módulo Shopee
   ============================================ */

const express = require("express");
const router = express.Router();

const config = require("../config");
const logger = require("../logger");
const shopeeService = require("../services/shopeeService");
const shopeeAuth = require("../services/shopeeAuth");
const tokenStore = require("../services/tokenStore");

/**
 * POST /api/shopee/create-product
 * Cria um produto novo na loja Shopee.
 */
router.post("/create-product", async (req, res) => {
  try {
    const product = req.body;

    const validation = shopeeService.validateProduct(product);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        category: "validation",
        error: validation.error,
      });
    }

    const result = await shopeeService.createProduct(product);
    res.json(result);
  } catch (err) {
    logger.error("create-product failed", {
      id: req.id,
      category: err.category || "unknown",
      message: err.message,
    });
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    res.status(status).json({
      success: false,
      category: err.category || "unknown",
      error: config.IS_PROD ? sanitizeError(err) : err.message,
    });
  }
});

/**
 * GET /api/shopee/status
 * Retorna o modo atual + estado dos tokens.
 */
router.get("/status", (req, res) => {
  const tokens = tokenStore.read();
  res.json({
    mode: shopeeService.isMockMode() ? "mock" : "live",
    configured: shopeeService.isConfigured(),
    has_tokens: !!tokens,
    token_expired: tokens ? tokenStore.isExpired() : null,
    shop_id: tokens?.shop_id || config.SHOPEE.SHOP_ID || null,
  });
});

/**
 * GET /api/shopee/auth-url
 * Gera a URL de autorização inicial (OAuth).
 */
router.get("/auth-url", (req, res) => {
  if (shopeeService.isMockMode()) {
    return res.status(400).json({
      success: false,
      error: "OAuth indisponível em modo mock",
    });
  }
  const redirect = req.query.redirect ||
    `http://localhost:${config.PORT}/api/shopee/oauth-callback`;
  const url = shopeeAuth.buildAuthorizeUrl(redirect);
  res.json({ auth_url: url });
});

/**
 * GET /api/shopee/oauth-callback
 * Callback chamado pela Shopee após o lojista autorizar.
 */
router.get("/oauth-callback", async (req, res) => {
  try {
    const { code, shop_id } = req.query;
    if (!code || !shop_id) {
      return res.status(400).json({
        success: false,
        error: "Parâmetros code/shop_id ausentes",
      });
    }
    const result = await shopeeAuth.exchangeCodeForTokens(code, shop_id);
    res.send(`
      <html><head><meta charset="utf-8"><title>CZ Store - Autorização Shopee</title>
      <style>body{font-family:sans-serif;background:#0a0a0a;color:#f5f5f5;padding:40px;text-align:center}
      h1{color:#22c55e}code{background:#1a1a1a;padding:2px 6px;border-radius:4px}</style></head>
      <body>
        <h1>✅ Autorização concluída!</h1>
        <p>Shop ID: <code>${result.shop_id}</code></p>
        <p>Token válido até: <code>${new Date(result.expires_at * 1000).toLocaleString("pt-BR")}</code></p>
        <p>Pode fechar esta janela e voltar ao sistema.</p>
      </body></html>
    `);
  } catch (err) {
    logger.error("oauth-callback failed", { message: err.message });
    res.status(500).send(`❌ Erro: ${err.message}`);
  }
});

/**
 * POST /api/shopee/refresh-token
 * Força renovação manual do access_token.
 */
router.post("/refresh-token", async (req, res) => {
  try {
    if (shopeeService.isMockMode()) {
      return res.status(400).json({ success: false, error: "Refresh indisponível em mock" });
    }
    const result = await shopeeAuth.refreshAccessToken();
    res.json({
      success: true,
      expires_at: result.expires_at,
      expires_in_seconds: result.expires_at - Math.floor(Date.now() / 1000),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================================
// Sanitização de erro em produção
// ==========================================================
function sanitizeError(err) {
  const category = err.category || "unknown";
  switch (category) {
    case "validation":
      return err.message;
    case "transient":
      return "Shopee temporariamente indisponível. Tente novamente em alguns instantes.";
    case "http_error":
      return "Erro ao comunicar com a Shopee. Verifique as credenciais.";
    case "shopee_logic_error":
      return err.message;
    case "mock_error":
      return err.message;
    default:
      return "Erro interno. Consulte os logs do servidor.";
  }
}

module.exports = router;
