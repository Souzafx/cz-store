/* ============================================
   shopeeService.js — Serviço de integração Shopee (v2.2.0)

   Novidades em v2.2.0 (production-ready):
   - Usa shopeeAuth para obter access_token válido automaticamente
   - Retry com exponential backoff em falhas transitórias
   - Categorização de erros (validação / cliente / servidor / rede)
   - Erros sanitizados antes de retornar ao cliente
   - Logs estruturados
   ============================================ */

const axios = require("axios");

const config = require("../config");
const logger = require("../logger");
const shopeeAuth = require("./shopeeAuth");

const BASE_URL = config.SHOPEE.BASE_URL;

// ==========================================================
// Detecção de modo
// ==========================================================
function isMockMode() {
  return config.MOCK_MODE;
}
function isConfigured() {
  return config.HAS_CREDS;
}

// ==========================================================
// Validação
// ==========================================================
function validateProduct(p) {
  if (!p || typeof p !== "object") {
    return { valid: false, error: "Produto não fornecido" };
  }
  if (!p.name || !String(p.name).trim()) {
    return { valid: false, error: "Nome do produto é obrigatório" };
  }
  if (!p.description || !String(p.description).trim()) {
    return { valid: false, error: "Descrição é obrigatória" };
  }
  if (p.description.length < 20) {
    return { valid: false, error: "Descrição muito curta (mínimo 20 caracteres)" };
  }
  if (!p.price || Number(p.price) <= 0) {
    return { valid: false, error: "Preço inválido" };
  }
  if (p.stock === undefined || Number(p.stock) < 0) {
    return { valid: false, error: "Estoque inválido" };
  }
  const hasImage = p.image || (Array.isArray(p.images) && p.images.length > 0);
  if (!hasImage) {
    return { valid: false, error: "Ao menos uma imagem é obrigatória" };
  }
  return { valid: true };
}

// ==========================================================
// Criação de produto
// ==========================================================
async function createProduct(product) {
  if (isMockMode()) return createProductMock(product);
  return withRetry(() => createProductLive(product), {
    retries: 3,
    baseDelay: 1000,
    onAttempt: (n) => logger.debug(`createProduct: tentativa ${n}`),
  });
}

async function createProductMock(product) {
  logger.info("MOCK: criando produto", { name: product.name });
  await sleep(600 + Math.random() * 600);

  if (process.env.MOCK_FAIL === "true") {
    throw new ShopeeError("MOCK_FAIL habilitado", "mock_error", 500);
  }

  const itemId = Math.floor(Math.random() * 9000000000) + 1000000000;
  logger.info("MOCK: produto criado", { item_id: itemId });

  return {
    mode: "mock",
    success: true,
    item_id: itemId,
    status: "published",
    message: "Produto enviado com sucesso (modo simulação)",
    synced_at: new Date().toISOString(),
  };
}

async function createProductLive(product) {
  const accessToken = await shopeeAuth.ensureValidAccessToken();
  const shopId = config.SHOPEE.SHOP_ID;

  const path = "/api/v2/product/add_item";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = shopeeAuth.signShop(path, timestamp, accessToken, shopId);

  const url =
    `${BASE_URL}${path}` +
    `?partner_id=${config.SHOPEE.PARTNER_ID}` +
    `&timestamp=${timestamp}` +
    `&access_token=${accessToken}` +
    `&shop_id=${shopId}` +
    `&sign=${sign}`;

  const payload = mapToShopeePayload(product);
  logger.info("LIVE: enviando produto", { name: product.name });

  let response;
  try {
    response = await axios.post(url, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 30000,
    });
  } catch (err) {
    const status = err.response?.status || 0;
    const detail = err.response?.data || { message: err.message };
    logger.error("LIVE: erro HTTP", { status, detail });

    if (status >= 500 || status === 0) {
      throw new ShopeeError("Erro temporário na Shopee", "transient", status, true);
    }
    throw new ShopeeError(
      `Shopee retornou ${status}`,
      "http_error",
      status,
      false,
      detail
    );
  }

  const data = response.data;
  if (data.error) {
    logger.warn("LIVE: Shopee retornou erro lógico", {
      error: data.error,
      message: data.message,
    });
    throw new ShopeeError(
      `${data.error}: ${data.message || "erro desconhecido"}`,
      "shopee_logic_error",
      400,
      false,
      data
    );
  }

  const itemId = data.response?.item_id;
  logger.info("LIVE: produto criado", { item_id: itemId });

  return {
    mode: "live",
    success: true,
    item_id: itemId,
    status: "published",
    message: "Produto criado com sucesso na Shopee",
    synced_at: new Date().toISOString(),
  };
}

// ==========================================================
// Mapeamento modelo interno → payload Shopee
// ==========================================================
function mapToShopeePayload(p) {
  const imageSet = new Set();
  if (p.image) imageSet.add(p.image);
  if (Array.isArray(p.images)) p.images.forEach((u) => u && imageSet.add(u));
  const imageUrls = [...imageSet].slice(0, 9);

  return {
    original_price: Number(p.price),
    description: String(p.description || "").trim(),
    weight: Number(p.weight) || 0.1,
    item_name: String(p.name).trim().slice(0, 100),
    item_status: "NORMAL",
    dimension: {
      package_length: Math.max(1, Math.round(p.dimensions?.length || 10)),
      package_width: Math.max(1, Math.round(p.dimensions?.width || 10)),
      package_height: Math.max(1, Math.round(p.dimensions?.height || 5)),
    },
    normal_stock: Number(p.stock) || 0,
    logistic_info: [{ logistic_id: 0, enabled: true }],
    category_id: Number(p.category_id) || 0,
    image: { image_url_list: imageUrls },
    brand: p.brand ? { brand_id: 0, original_brand_name: String(p.brand) } : undefined,
    item_sku: String(p.sku || "").slice(0, 100),
    condition: (p.condition || "NEW").toUpperCase(),
  };
}

// ==========================================================
// Helpers
// ==========================================================

class ShopeeError extends Error {
  constructor(message, category, status = 500, retryable = false, detail = null) {
    super(message);
    this.name = "ShopeeError";
    this.category = category;
    this.status = status;
    this.retryable = retryable;
    this.detail = detail;
  }
}

async function withRetry(fn, { retries = 3, baseDelay = 500, onAttempt } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (onAttempt) onAttempt(attempt);
      return await fn();
    } catch (err) {
      lastErr = err;
      const retryable = err instanceof ShopeeError ? err.retryable : false;
      if (!retryable || attempt === retries) break;
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 300;
      logger.warn(`withRetry: tentativa ${attempt} falhou, aguardando ${Math.round(delay)}ms`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  isMockMode,
  isConfigured,
  validateProduct,
  createProduct,
  mapToShopeePayload,
  ShopeeError,
};
