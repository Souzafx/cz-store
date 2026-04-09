/* ============================================
   shopeeService.js (frontend) — Cliente do backend Shopee

   Encapsula as chamadas HTTP para o backend local que
   conversa com a Shopee Partner API.

   Endpoint padrão: http://localhost:3000/api/shopee
   Pode ser sobrescrito em runtime via:
     window.CZ_BACKEND_URL = "http://outra:porta"
   ============================================ */

const SHOPEE_BACKEND_URL =
  (typeof window !== "undefined" && window.CZ_BACKEND_URL) ||
  "http://localhost:3000/api/shopee";

/**
 * Converte um produto do CZ Store no payload que o backend espera.
 *
 * Campos obrigatórios na Shopee:
 * - name, description (≥20 chars), price, stock, imagem
 * - dimensions (default razoável se ausente)
 * - weight (default 0.1kg se ausente)
 */
function buildShopeePayload(product) {
  const calc = calcProduct(product);

  // Estoque = kits disponíveis (unidade vendável na loja)
  const stock = calc.kits;

  // Galeria: principal + galleryImages, sem duplicatas
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
    images: images.slice(1), // as extras
    condition: (product.condition || "NEW").toUpperCase(),
  };
}

/**
 * Envia um produto do CZ Store para a Shopee via backend.
 * Retorna o resultado com { success, item_id, status, synced_at, ... }.
 * Lança Error se o backend não estiver rodando ou retornar falha.
 */
async function sendProductToShopee(product) {
  const payload = buildShopeePayload(product);

  let res;
  try {
    res = await fetch(`${SHOPEE_BACKEND_URL}/create-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new Error(
      "Backend offline. Inicie o servidor em backend/ com `npm start`."
    );
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Resposta inválida do backend (HTTP ${res.status})`);
  }

  if (!res.ok || data.success === false) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data;
}

/**
 * Consulta o status do backend (mock ou live).
 * Retorna null se o backend não estiver rodando.
 */
async function getShopeeBackendStatus() {
  try {
    const res = await fetch(`${SHOPEE_BACKEND_URL}/status`, {
      method: "GET",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
