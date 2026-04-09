/* ============================================
   shopeeService.js (frontend) — Cliente do backend Shopee

   Encapsula as chamadas HTTP para o backend local que
   conversa com a Shopee Partner API.

   Config persistida em localStorage:
     cz_backend_url    → URL do backend (default: http://localhost:3000/api/shopee)
     cz_api_token      → token X-CZ-Token (opcional, exigido em produção)
   ============================================ */

const CZ_BACKEND_DEFAULT = "http://localhost:3000/api/shopee";

function getBackendUrl() {
  return (
    (typeof window !== "undefined" && window.CZ_BACKEND_URL) ||
    localStorage.getItem("cz_backend_url") ||
    CZ_BACKEND_DEFAULT
  );
}

function getApiToken() {
  return localStorage.getItem("cz_api_token") || "";
}

function setBackendConfig({ url, token }) {
  if (url !== undefined) {
    if (url) localStorage.setItem("cz_backend_url", url);
    else localStorage.removeItem("cz_backend_url");
  }
  if (token !== undefined) {
    if (token) localStorage.setItem("cz_api_token", token);
    else localStorage.removeItem("cz_api_token");
  }
}

/**
 * Converte um produto do CZ Store no payload que o backend espera.
 */
function buildShopeePayload(product) {
  const calc = calcProduct(product);
  const stock = calc.kits;

  const images = [];
  const main = getProductImage(product);
  if (main) images.push(main);
  if (Array.isArray(product.galleryImages)) {
    product.galleryImages.forEach((u) => {
      if (u && !images.includes(u)) images.push(u);
    });
  }

  return {
    name: product.name || "",
    description: product.description || "",
    price: Number(product.price) || 0,
    stock,
    sku: product.sku || "",
    category_id: product.categoryId || 0,
    brand: product.brand || "",
    weight: Number(product.weight) || 0.1,
    dimensions: {
      length: product.dimensions?.length || 10,
      width: product.dimensions?.width || 10,
      height: product.dimensions?.height || 5,
    },
    image: images[0] || "",
    images: images.slice(1),
    condition: (product.condition || "NEW").toUpperCase(),
  };
}

/** Headers incluindo X-CZ-Token quando configurado. */
function buildHeaders() {
  const headers = { "Content-Type": "application/json" };
  const token = getApiToken();
  if (token) headers["X-CZ-Token"] = token;
  return headers;
}

/**
 * Envia um produto para a Shopee via backend.
 * Lança Error com .category para o frontend categorizar:
 *   "network" | "validation" | "transient" | "http_error" |
 *   "shopee_logic_error" | "parse_error" | "server_error" | "unknown"
 */
async function sendProductToShopee(product) {
  const payload = buildShopeePayload(product);

  let res;
  try {
    res = await fetch(`${getBackendUrl()}/create-product`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    });
  } catch (err) {
    const e = new Error(
      "Backend offline. Inicie o servidor ou confira a URL em Configurações."
    );
    e.category = "network";
    throw e;
  }

  let data;
  try {
    data = await res.json();
  } catch {
    const e = new Error(`Resposta inválida do backend (HTTP ${res.status})`);
    e.category = "parse_error";
    throw e;
  }

  if (!res.ok || data.success === false) {
    const e = new Error(data.error || `HTTP ${res.status}`);
    e.category = data.category || (res.status === 401 ? "unauthorized" : "server_error");
    e.status = res.status;
    throw e;
  }

  return data;
}

/** Consulta o status do backend. Retorna null se offline. */
async function getShopeeBackendStatus() {
  try {
    const res = await fetch(`${getBackendUrl()}/status`, {
      method: "GET",
      headers: buildHeaders(),
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, ...(await res.json()) };
  } catch {
    return null;
  }
}

/** Health check público (sem token). */
async function getBackendHealth() {
  try {
    const baseRoot = getBackendUrl().replace(/\/api\/shopee\/?$/, "");
    const res = await fetch(`${baseRoot}/health`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
