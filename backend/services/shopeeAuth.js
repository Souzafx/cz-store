/* ============================================
   shopeeAuth.js — Fluxo OAuth da Shopee Partner API

   Responsabilidades:
   - Gerar URL de autorização inicial (para o lojista autorizar o app)
   - Trocar o "code" da callback por access_token + refresh_token
   - Renovar automaticamente o access_token usando o refresh_token
   - Assegurar que cada chamada ao Shopee use um token válido

   Endpoints oficiais:
   - /api/v2/auth/token/get             (troca code por tokens)
   - /api/v2/auth/access_token/get      (refresh do access_token)

   Documentação:
   https://open.shopee.com/documents/v2/v2.auth.shop_authorization_partner
   ============================================ */

const crypto = require("crypto");
const axios = require("axios");

const config = require("../config");
const tokenStore = require("./tokenStore");
const logger = require("../logger");

// ==========================================================
// Assinatura
// ==========================================================
// Para endpoints de auth (sem access_token), a base da assinatura é:
//   base = partner_id + path + timestamp
function signPublic(path, timestamp) {
  const base = `${config.SHOPEE.PARTNER_ID}${path}${timestamp}`;
  return crypto
    .createHmac("sha256", config.SHOPEE.PARTNER_KEY)
    .update(base)
    .digest("hex");
}

// Para endpoints de shop autenticados:
//   base = partner_id + path + timestamp + access_token + shop_id
function signShop(path, timestamp, accessToken, shopId) {
  const base = `${config.SHOPEE.PARTNER_ID}${path}${timestamp}${accessToken}${shopId}`;
  return crypto
    .createHmac("sha256", config.SHOPEE.PARTNER_KEY)
    .update(base)
    .digest("hex");
}

// ==========================================================
// URL de autorização inicial
// ==========================================================
/**
 * Gera a URL que o lojista precisa abrir uma vez para autorizar o app
 * a mexer na conta dele. Após autorizar, a Shopee redireciona de volta
 * para "redirectUrl" com ?code=... e ?shop_id=...
 */
function buildAuthorizeUrl(redirectUrl) {
  const path = "/api/v2/shop/auth_partner";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = signPublic(path, timestamp);
  const params = new URLSearchParams({
    partner_id: config.SHOPEE.PARTNER_ID,
    timestamp: String(timestamp),
    sign,
    redirect: redirectUrl,
  });
  return `${config.SHOPEE.BASE_URL}${path}?${params.toString()}`;
}

// ==========================================================
// Troca code → tokens (primeira autorização)
// ==========================================================
async function exchangeCodeForTokens(code, shopId) {
  const path = "/api/v2/auth/token/get";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = signPublic(path, timestamp);

  const url =
    `${config.SHOPEE.BASE_URL}${path}` +
    `?partner_id=${config.SHOPEE.PARTNER_ID}` +
    `&timestamp=${timestamp}` +
    `&sign=${sign}`;

  const body = {
    code,
    shop_id: Number(shopId),
    partner_id: Number(config.SHOPEE.PARTNER_ID),
  };

  logger.info("shopeeAuth: trocando code por tokens", { shopId });
  const res = await axios.post(url, body, { timeout: 15000 });
  const data = res.data;

  if (data.error) {
    throw new Error(`Shopee auth error: ${data.error} — ${data.message || ""}`);
  }

  const stored = tokenStore.write({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (data.expire_in || 14400),
    shop_id: String(shopId),
    source: "oauth_exchange",
  });
  logger.info("shopeeAuth: tokens obtidos via OAuth", {
    expires_at: stored.expires_at,
  });
  return stored;
}

// ==========================================================
// Refresh do access_token
// ==========================================================
/**
 * Renova o access_token usando o refresh_token atual.
 * A Shopee também retorna um NOVO refresh_token — precisa ser atualizado.
 */
async function refreshAccessToken() {
  const current = tokenStore.read();
  if (!current || !current.refresh_token) {
    throw new Error(
      "Sem refresh_token salvo. Execute o fluxo de autorização inicial primeiro."
    );
  }

  const path = "/api/v2/auth/access_token/get";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = signPublic(path, timestamp);

  const url =
    `${config.SHOPEE.BASE_URL}${path}` +
    `?partner_id=${config.SHOPEE.PARTNER_ID}` +
    `&timestamp=${timestamp}` +
    `&sign=${sign}`;

  const body = {
    refresh_token: current.refresh_token,
    partner_id: Number(config.SHOPEE.PARTNER_ID),
    shop_id: Number(current.shop_id || config.SHOPEE.SHOP_ID),
  };

  logger.info("shopeeAuth: renovando access_token");
  try {
    const res = await axios.post(url, body, { timeout: 15000 });
    const data = res.data;

    if (data.error) {
      throw new Error(`Shopee refresh error: ${data.error} — ${data.message || ""}`);
    }

    const stored = tokenStore.write({
      access_token: data.access_token,
      refresh_token: data.refresh_token || current.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + (data.expire_in || 14400),
      shop_id: current.shop_id,
      source: "refresh",
    });
    logger.info("shopeeAuth: access_token renovado com sucesso");
    return stored;
  } catch (err) {
    const detail = err.response?.data || err.message;
    logger.error("shopeeAuth: falha ao renovar token", { detail });
    throw new Error(
      "Falha ao renovar access_token. Pode ser necessário re-autorizar a loja. " +
      (typeof detail === "object" ? JSON.stringify(detail) : detail)
    );
  }
}

// ==========================================================
// Garante token válido antes de uma chamada
// ==========================================================
/**
 * Retorna um access_token válido, renovando se necessário.
 * Deve ser chamado antes de cada request autenticada à Shopee.
 */
async function ensureValidAccessToken() {
  if (config.MOCK_MODE) return "mock-token";
  const current = tokenStore.read();
  if (!current) {
    throw new Error(
      "Shopee ainda não autorizada. Rode o fluxo OAuth primeiro (ver README)."
    );
  }
  if (tokenStore.isExpired()) {
    await refreshAccessToken();
  }
  return tokenStore.getAccessToken();
}

module.exports = {
  signPublic,
  signShop,
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  ensureValidAccessToken,
};
