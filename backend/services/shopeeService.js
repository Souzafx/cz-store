/* ============================================
   shopeeService.js — Serviço de integração Shopee

   Responsabilidades:
   - Detectar se está em modo mock ou live
   - Validar dados do produto antes de enviar
   - Assinar as requisições com HMAC-SHA256 (Shopee Partner API v2)
   - Mapear modelo interno → payload esperado pela Shopee
   - Chamar o endpoint /api/v2/product/add_item
   - Retornar resultado padronizado para o frontend
   ============================================ */

const crypto = require("crypto");
const axios = require("axios");

const BASE_URL =
  process.env.SHOPEE_BASE_URL || "https://partner.shopeemobile.com";

// ==========================================================
// Detecção de modo
// ==========================================================

/**
 * Verifica se o backend está em modo mock (simulação).
 * Mock é ativado quando:
 * - MOCK_MODE=true no .env, OU
 * - Qualquer credencial obrigatória está faltando
 */
function isMockMode() {
  if (String(process.env.MOCK_MODE).toLowerCase() === "true") return true;
  return !isConfigured();
}

/** Verifica se TODAS as credenciais estão preenchidas. */
function isConfigured() {
  return !!(
    process.env.SHOPEE_PARTNER_ID &&
    process.env.SHOPEE_PARTNER_KEY &&
    process.env.SHOPEE_SHOP_ID &&
    process.env.SHOPEE_ACCESS_TOKEN
  );
}

// ==========================================================
// Validação do produto
// ==========================================================

/**
 * Valida os campos mínimos necessários para a Shopee.
 * Retorna { valid: true } ou { valid: false, error: "mensagem" }.
 */
function validateProduct(p) {
  if (!p || typeof p !== "object") {
    return { valid: false, error: "Produto não fornecido" };
  }
  if (!p.name || !String(p.name).trim()) {
    return { valid: false, error: "Nome do produto é obrigatório" };
  }
  if (!p.description || !String(p.description).trim()) {
    return { valid: false, error: "Descrição é obrigatória (mínimo 20 caracteres na Shopee)" };
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
// Assinatura HMAC-SHA256 (Shopee Partner API v2)
// ==========================================================

/**
 * Gera a assinatura exigida pela Shopee Partner API v2.
 * Fórmula (shop endpoints autenticados):
 *   base = partner_id + path + timestamp + access_token + shop_id
 *   sign = HMAC-SHA256(partner_key, base)
 */
function generateSignature(path, timestamp, accessToken, shopId) {
  const base = `${process.env.SHOPEE_PARTNER_ID}${path}${timestamp}${accessToken}${shopId}`;
  return crypto
    .createHmac("sha256", process.env.SHOPEE_PARTNER_KEY)
    .update(base)
    .digest("hex");
}

// ==========================================================
// Criação de produto
// ==========================================================

async function createProduct(product) {
  if (isMockMode()) {
    return createProductMock(product);
  }
  return createProductLive(product);
}

/** Modo simulação — retorna um item_id fictício. */
async function createProductMock(product) {
  console.log(`🧪 [MOCK] Criando produto: "${product.name}"`);
  // Simula latência de rede
  await new Promise((r) => setTimeout(r, 800 + Math.random() * 700));

  // 10% de chance de "erro" simulado para testar o fluxo de erro no frontend
  if (process.env.MOCK_FAIL === "true") {
    throw new Error("Erro simulado para teste");
  }

  const itemId = Math.floor(Math.random() * 9000000000) + 1000000000;
  console.log(`✅ [MOCK] Produto criado com item_id=${itemId}`);

  return {
    mode: "mock",
    success: true,
    item_id: itemId,
    status: "published",
    message: "Produto enviado com sucesso (modo simulação)",
    synced_at: new Date().toISOString(),
    sent_payload: mapToShopeePayload(product),
  };
}

/** Modo live — chama a Shopee Partner API real. */
async function createProductLive(product) {
  const path = "/api/v2/product/add_item";
  const timestamp = Math.floor(Date.now() / 1000);
  const accessToken = process.env.SHOPEE_ACCESS_TOKEN;
  const shopId = process.env.SHOPEE_SHOP_ID;

  const signature = generateSignature(path, timestamp, accessToken, shopId);

  const url =
    `${BASE_URL}${path}` +
    `?partner_id=${process.env.SHOPEE_PARTNER_ID}` +
    `&timestamp=${timestamp}` +
    `&access_token=${accessToken}` +
    `&shop_id=${shopId}` +
    `&sign=${signature}`;

  const payload = mapToShopeePayload(product);

  console.log(`🔴 [LIVE] Enviando "${product.name}" para Shopee...`);

  try {
    const response = await axios.post(url, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 30000,
    });

    const data = response.data;

    // Shopee retorna { error, message, response } — error vazio = sucesso
    if (data.error) {
      throw new Error(`Shopee API: ${data.error} — ${data.message || ""}`);
    }

    const itemId = data.response?.item_id;
    console.log(`✅ [LIVE] Produto criado na Shopee com item_id=${itemId}`);

    return {
      mode: "live",
      success: true,
      item_id: itemId,
      status: "published",
      message: "Produto criado com sucesso na Shopee",
      synced_at: new Date().toISOString(),
      raw: data,
    };
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error("❌ [LIVE] Erro Shopee:", detail);
    throw new Error(
      `Falha na API da Shopee: ${typeof detail === "object" ? JSON.stringify(detail) : detail}`
    );
  }
}

// ==========================================================
// Mapeamento modelo interno → payload Shopee
// ==========================================================

/**
 * Converte o produto do CZ Store no formato esperado pela
 * Shopee Partner API v2 (endpoint /product/add_item).
 *
 * Referência oficial:
 * https://open.shopee.com/documents/v2/v2.product.add_item
 */
function mapToShopeePayload(p) {
  // Reúne imagens (principal + galeria), remove duplicatas
  const imageSet = new Set();
  if (p.image) imageSet.add(p.image);
  if (Array.isArray(p.images)) p.images.forEach((u) => u && imageSet.add(u));
  const imageUrls = [...imageSet].slice(0, 9); // Shopee aceita até 9 imagens

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
// Exports
// ==========================================================

module.exports = {
  isMockMode,
  isConfigured,
  validateProduct,
  createProduct,
  mapToShopeePayload,
};
