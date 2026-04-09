/* ============================================
   app.js — Lógica principal da aplicação

   MODELO DE DADOS (v7):
   ---------------------
   product = {
     id, name, description, unitsPerKit, price, fee, link,
     photo,             // base64 de upload local (legado + novo)
     imageUrl,          // URL externa PRINCIPAL
     galleryImages,     // URLs extras (galeria)
     createdAt, updatedAt,
     purchases: [
       { id, date, qty, costProduct, costTax, note, origin }
     ]
   }

   Resolução de imagem: imageUrl → photo → galleryImages[0] → placeholder.

   Cada produto pode ter várias compras. Custos e quantidade
   totais são calculados pela SOMA das compras.

   origin: "nacional" | "importado"

   Versões anteriores migradas automaticamente.
   ============================================ */

// ---------- Helpers de DOM ----------
// Os helpers de formatação (BRL, PCT, formatDate, formatDateTime, todayISO,
// genId, purchaseSortKey, escapeHtml) vêm de js/utils/format.js.
// Os helpers de imagem (getProductImage, isValidImageUrl, normalizeImageUrl,
// isJunkImage, upgradeImageSize, dedupeImages) vêm de js/utils/images.js.
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ---------- Migração de produtos antigos ----------
/**
 * Converte produtos das versões antigas (v1, v2, v3) para v4 (purchases[]).
 */
function migrate(p) {
  if (Array.isArray(p.purchases)) return p; // já é v4

  // Determina os valores agregados com base na versão antiga
  let costProduct = 0;
  let costTax = 0;
  let qty = 1;

  if (p.costProduct !== undefined) {
    // v3
    costProduct = Number(p.costProduct) || 0;
    costTax = Number(p.costTax) || 0;
    qty = Number(p.qtyBought) || 1;
  } else if (p.costUnit !== undefined) {
    // v2
    qty = Number(p.qtyBought) || 1;
    costProduct = Number(p.costUnit) * qty;
    costTax = 0;
  } else if (p.cost !== undefined) {
    // v1
    qty = Number(p.qty) || 1;
    costProduct = Number(p.cost) * qty;
    costTax = 0;
  }

  const purchase = {
    id: genId(),
    date: (p.createdAt || new Date().toISOString()).slice(0, 10),
    qty: Math.max(1, Math.round(qty)),
    costProduct: Number(costProduct.toFixed(4)),
    costTax: Number(costTax.toFixed(4)),
    note: "",
    origin: costTax > 0 ? "importado" : "nacional",
  };

  // Remove campos legados e cria purchases[]
  const {
    cost, qty: _q, costUnit, costProduct: _cp, costTax: _ct, qtyBought,
    ...rest
  } = p;

  return { ...rest, purchases: [purchase] };
}

/** Migração em massa na inicialização. */
(function runMigration() {
  const list = Storage.getAll();
  let changed = false;
  const migrated = list.map((p) => {
    if (!Array.isArray(p.purchases)) {
      changed = true;
      p = migrate(p);
    }
    // Garante que toda purchase tenha createdAt (necessário para ordenar por hora)
    if (Array.isArray(p.purchases)) {
      p.purchases = p.purchases.map((pu, idx) => {
        if (!pu.createdAt) {
          changed = true;
          // Usa a data informada + horas fictícias incrementais para
          // preservar a ordem relativa que já existia.
          const pad = (n) => String(n).padStart(2, "0");
          const h = pad(Math.min(23, idx));
          return { ...pu, createdAt: `${pu.date || "2024-01-01"}T${h}:00:00.000Z` };
        }
        return pu;
      });
    }
    return p;
  });
  if (changed) Storage.saveAll(migrated);
})();

// ---------- Cálculos ----------
// calcProduct, calcPurchase e deriveOrigin estão em js/utils/calc.js

// ---------- State ----------
let editingId = null;
let photoDataUrl = null;     // arquivo upload em base64
let imageUrlValue = "";      // URL externa principal
let galleryImagesValue = []; // galeria (extras)
let candidateImages = [];    // grade de imagens disponíveis (importadas + já salvas)
let editingPurchaseId = null;
let editingPurchaseProductId = null;

// ---------- Navegação entre views ----------
$$(".nav-link").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const view = link.dataset.view;
    $$(".nav-link").forEach((l) => l.classList.remove("active"));
    link.classList.add("active");
    $("#view-dashboard").classList.toggle("hidden", view !== "dashboard");
    $("#view-produtos").classList.toggle("hidden", view !== "produtos");
    $("#view-historico").classList.toggle("hidden", view !== "historico");
    const titles = {
      dashboard: ["Dashboard", "Resumo financeiro da sua loja"],
      produtos: ["Produtos", "Gerencie seu catálogo completo"],
      historico: ["Histórico de Compras", "Linha do tempo de todas as compras"],
    };
    const [t, s] = titles[view] || titles.dashboard;
    $("#view-title").textContent = t;
    $("#view-subtitle").textContent = s;

    if (view === "historico") renderHistoryView();
  });
});

// ==============================================================
// MODAL PRODUTO
// ==============================================================
const modal = $("#modal");

function openModal(product = null) {
  editingId = product ? product.id : null;
  photoDataUrl = product ? product.photo || null : null;
  imageUrlValue = product ? (product.imageUrl || "") : "";
  galleryImagesValue = product && Array.isArray(product.galleryImages)
    ? [...product.galleryImages]
    : [];

  // Grade de candidatos começa com a galeria + principal já existentes
  const seed = [];
  if (imageUrlValue) seed.push(imageUrlValue);
  galleryImagesValue.forEach((u) => {
    if (!seed.includes(u)) seed.push(u);
  });
  candidateImages = seed;

  $("#modal-title").textContent = product ? "Editar Produto" : "Novo Produto";
  $("#product-id").value = product?.id || "";
  $("#f-name").value = product?.name || "";
  $("#f-units-per-kit").value = product?.unitsPerKit ?? 2;
  $("#f-price").value = product?.price ?? "";
  $("#f-fee").value = product?.fee ?? 0;
  $("#f-target-profit").value = 100;
  $("#f-link").value = product?.link || "";
  $("#f-description").value = product?.description || "";
  $("#f-photo").value = "";
  $("#f-image-url").value = imageUrlValue;
  $("#image-url-status").classList.add("hidden");
  $("#f-import-url").value = "";
  $("#import-status").classList.add("hidden");

  // Preview: prioridade URL → upload base64
  updateImagePreview();
  renderCandidateImages();

  // Campos da "primeira compra" — precisam ficar desabilitados no modo
  // edição, senão o navegador bloqueia o submit por causa do `required`
  // em inputs que estão escondidos.
  const firstPurchaseFields = [
    "f-fp-date", "f-fp-qty", "f-fp-cost-product",
    "f-fp-cost-tax", "f-fp-origin", "f-fp-note",
  ];

  if (product) {
    // Modo edição: esconde primeira compra, mostra histórico
    $("#first-purchase-section").classList.add("hidden");
    $("#history-section").classList.remove("hidden");
    firstPurchaseFields.forEach((id) => {
      document.getElementById(id).disabled = true;
    });
    renderProductPurchasesList(product);
  } else {
    // Modo criação: mostra primeira compra, esconde histórico
    $("#first-purchase-section").classList.remove("hidden");
    $("#history-section").classList.add("hidden");
    firstPurchaseFields.forEach((id) => {
      document.getElementById(id).disabled = false;
    });
    $("#f-fp-date").value = todayISO();
    $("#f-fp-qty").value = 1;
    $("#f-fp-cost-product").value = "";
    $("#f-fp-cost-tax").value = "";
    $("#f-fp-origin").value = "nacional";
    $("#f-fp-note").value = "";
  }

  updateLiveCalc();
  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
  editingId = null;
  photoDataUrl = null;
}

$("#btn-new").addEventListener("click", () => openModal());
$("#modal-close").addEventListener("click", closeModal);
$("#btn-cancel").addEventListener("click", closeModal);
// >>> clique fora do modal NÃO fecha mais (removido propositalmente) <<<

// ---------- Upload de foto (arquivo local) ----------
$("#f-photo").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    photoDataUrl = ev.target.result;
    updateImagePreview();
  };
  reader.readAsDataURL(file);
});

// ==============================================================
// IMPORTAR PRODUTO DE URL EXTERNA
// ==============================================================
/**
 * Lista de proxies CORS públicos usados como fallback quando o fetch
 * direto é bloqueado. Tentados em ordem até um funcionar.
 */
const CORS_PROXIES = [
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
];

/**
 * Busca o HTML de uma página. Primeiro tenta fetch direto (raro dar certo
 * por causa de CORS em marketplaces), depois cicla pelos CORS proxies.
 */
async function fetchPageHtml(url) {
  // 1) Fetch direto
  try {
    const res = await fetch(url, { mode: "cors" });
    if (res.ok) {
      const text = await res.text();
      if (text && text.length > 200) return text;
    }
  } catch (_) { /* segue para proxy */ }

  // 2) Fallback via proxies CORS
  let lastErr;
  for (const makeUrl of CORS_PROXIES) {
    try {
      const res = await fetch(makeUrl(url));
      if (!res.ok) { lastErr = new Error(`Status ${res.status}`); continue; }
      const text = await res.text();
      if (text && text.length > 200) return text;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Nenhum proxy respondeu");
}

/**
 * Extrai nome, imagens (lista), descrição e preço do HTML.
 * Tenta múltiplas fontes e devolve uma galeria deduplicada.
 */
function extractProductMeta(html, baseUrl = "") {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const getMeta = (selectors) => {
    for (const sel of selectors) {
      const el = doc.querySelector(sel);
      if (el) {
        const val = el.getAttribute("content") || el.textContent;
        if (val && val.trim()) return val.trim();
      }
    }
    return "";
  };

  // --- Título ---
  let title = getMeta([
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
    'meta[name="title"]',
    "title",
  ]);
  title = title
    .replace(/\s*[-|–]\s*(AliExpress|Shopee(?: Brasil)?|Amazon(?:\.com(?:\.br)?)?|Mercado Livre|MercadoLivre|Magazine Luiza|Magalu).*$/i, "")
    .replace(/^Compre\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();

  // --- Descrição ---
  const description = getMeta([
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
    'meta[name="description"]',
  ]);

  // --- Preço ---
  const price = getMeta([
    'meta[property="product:price:amount"]',
    'meta[property="og:price:amount"]',
    'meta[itemprop="price"]',
  ]);

  // ===== IMAGENS =====
  const rawImages = [];

  // 1) Meta tags OG (podem ter várias og:image)
  doc.querySelectorAll(
    'meta[property="og:image"],' +
    'meta[property="og:image:secure_url"],' +
    'meta[name="twitter:image"],' +
    'meta[name="twitter:image:src"]'
  ).forEach((el) => {
    const v = el.getAttribute("content");
    if (v) rawImages.push(v);
  });
  const linkImageSrc = doc.querySelector('link[rel="image_src"]');
  if (linkImageSrc) {
    const v = linkImageSrc.getAttribute("href");
    if (v) rawImages.push(v);
  }

  // 2) JSON-LD estruturado (<script type="application/ld+json">)
  doc.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
    try {
      const data = JSON.parse(s.textContent);
      const collect = (v) => {
        if (!v) return;
        if (typeof v === "string") rawImages.push(v);
        else if (Array.isArray(v)) v.forEach(collect);
        else if (typeof v === "object") {
          if (v.image) collect(v.image);
          if (v.contentUrl) collect(v.contentUrl);
          if (v.url && (v.contentUrl || v["@type"] === "ImageObject")) collect(v.url);
        }
      };
      collect(data);
    } catch (_) { /* ignora JSON inválido */ }
  });

  // 3) Tags <img> do documento
  doc.querySelectorAll("img").forEach((img) => {
    ["src", "data-src", "data-original", "data-lazy-src", "data-srcset"].forEach((attr) => {
      const v = img.getAttribute(attr);
      if (v) {
        // srcset pode ter várias URLs separadas por vírgula
        v.split(",").forEach((part) => {
          const url = part.trim().split(/\s+/)[0];
          if (url) rawImages.push(url);
        });
      }
    });
  });

  // 4) Regex varredura no HTML bruto — pega URLs de imagens
  //    em JSON embutido (AliExpress runParams, Shopee __INITIAL_STATE__, etc).
  const imgRegex = /https?:\/\/[^\s"'<>]+?\.(?:jpg|jpeg|png|webp)(?:[?#][^\s"'<>]*)?/gi;
  (html.match(imgRegex) || []).forEach((u) => rawImages.push(u));

  // 5) Específico AliExpress: "imagePathList":["url1","url2"]
  const aliMatch = html.match(/"imagePathList"\s*:\s*\[([^\]]+)\]/);
  if (aliMatch) {
    (aliMatch[1].match(/"([^"]+)"/g) || [])
      .forEach((q) => rawImages.push(q.replace(/"/g, "")));
  }

  // 6) Específico Shopee: "images":["hash1","hash2"]
  // Shopee usa hashes; a URL base é https://cf.shopee.com.br/file/{hash}
  const shopeeMatch = html.match(/"images"\s*:\s*\[((?:"[a-f0-9]+",?\s*)+)\]/i);
  if (shopeeMatch) {
    (shopeeMatch[1].match(/"([a-f0-9]+)"/g) || []).forEach((q) => {
      const hash = q.replace(/"/g, "");
      if (hash.length >= 20) {
        rawImages.push(`https://cf.shopee.com.br/file/${hash}`);
      }
    });
  }

  // --- Normalização + filtros ---
  let images = rawImages
    .map((u) => normalizeImageUrl(u, baseUrl))
    .filter(Boolean)
    .filter((u) => /^https?:\/\//i.test(u))
    .filter((u) => !isJunkImage(u))
    .map(upgradeImageSize);

  images = dedupeImages(images);

  // Limita a 40 para não poluir a UI
  if (images.length > 40) images = images.slice(0, 40);

  // A "principal" é a primeira (geralmente og:image, que é a melhor)
  const mainImage = images[0] || "";

  return { title, mainImage, images, description, price };
}

/** Detecta o marketplace pelo hostname para mensagens amigáveis. */
function detectMarketplace(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("aliexpress")) return "AliExpress";
    if (host.includes("shopee"))     return "Shopee";
    if (host.includes("amazon"))     return "Amazon";
    if (host.includes("mercadoli"))  return "Mercado Livre";
    if (host.includes("magalu") || host.includes("magazineluiza")) return "Magalu";
    return host;
  } catch { return "site"; }
}

/**
 * Função principal: importa dados do link e preenche o formulário.
 */
async function importProductFromUrl(url) {
  const statusEl = $("#import-status");
  const btn = $("#btn-import-url");
  const market = detectMarketplace(url);

  if (!isValidImageUrl(url)) {
    statusEl.className = "image-status error";
    statusEl.textContent = "⚠️ URL inválida — precisa começar com http:// ou https://";
    statusEl.classList.remove("hidden");
    return;
  }

  statusEl.className = "image-status loading";
  statusEl.innerHTML = `<span class="cz-spinner"></span> Buscando dados do produto no ${escapeHtml(market)}...`;
  statusEl.classList.remove("hidden");
  btn.disabled = true;
  const originalBtnText = btn.textContent;
  btn.textContent = "Buscando...";

  try {
    const html = await fetchPageHtml(url);
    const meta = extractProductMeta(html, url);

    if (!meta.title && meta.images.length === 0) {
      throw new Error("Nenhum dado reconhecível na página");
    }

    // Preenche os campos automaticamente
    let filled = [];
    if (meta.title) {
      $("#f-name").value = meta.title;
      filled.push("nome");
    }

    if (meta.images.length > 0) {
      // Mescla com candidatos existentes (caso o usuário importe mais de uma vez)
      candidateImages = dedupeImages([...candidateImages, ...meta.images]);

      // Define principal se ainda não houver uma
      if (!imageUrlValue && meta.mainImage) {
        imageUrlValue = meta.mainImage;
        $("#f-image-url").value = meta.mainImage;
      }

      // Adiciona a principal à galeria automaticamente
      if (imageUrlValue && !galleryImagesValue.includes(imageUrlValue)) {
        galleryImagesValue.push(imageUrlValue);
      }

      renderCandidateImages();
      updateImagePreview();
      filled.push(`${meta.images.length} imagens`);
    }

    if (meta.description && !$("#f-description").value.trim()) {
      $("#f-description").value = meta.description;
      filled.push("descrição");
    }
    $("#f-link").value = url;
    filled.push("link");

    if (meta.price && !$("#f-price").value) {
      const parsed = parseFloat(String(meta.price).replace(",", "."));
      if (!isNaN(parsed) && parsed > 0) {
        $("#f-price").value = parsed.toFixed(2);
        filled.push("preço");
        updateLiveCalc();
      }
    }

    statusEl.className = "image-status ok";
    statusEl.textContent = `✓ Dados carregados! (${filled.join(", ")})`;
  } catch (err) {
    console.error("Import error:", err);
    statusEl.className = "image-status error";
    statusEl.innerHTML =
      `❌ Não foi possível extrair automaticamente do ${escapeHtml(market)} ` +
      `(${escapeHtml(err.message || "bloqueio do site")}).<br>` +
      `<small style="opacity:0.8">Você ainda pode preencher manualmente ou colar só a URL da imagem abaixo.</small>`;
  } finally {
    btn.disabled = false;
    btn.textContent = originalBtnText;
  }
}

$("#btn-import-url").addEventListener("click", () => {
  const url = $("#f-import-url").value.trim();
  if (!url) {
    const statusEl = $("#import-status");
    statusEl.className = "image-status error";
    statusEl.textContent = "⚠️ Cole um link de produto primeiro.";
    statusEl.classList.remove("hidden");
    return;
  }
  importProductFromUrl(url);
});

// Permite submeter com Enter dentro do campo de import
$("#f-import-url").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    $("#btn-import-url").click();
  }
});

// ---------- URL de imagem externa ----------
let imageUrlTestTimer = null;

$("#f-image-url").addEventListener("input", (e) => {
  imageUrlValue = e.target.value.trim();
  // Debounce: só testa 400ms depois da última tecla
  clearTimeout(imageUrlTestTimer);
  imageUrlTestTimer = setTimeout(() => testImageUrlLive(), 400);
});

$("#btn-test-image").addEventListener("click", () => {
  imageUrlValue = $("#f-image-url").value.trim();
  testImageUrlLive(true);
});

$("#btn-clear-image").addEventListener("click", () => {
  imageUrlValue = "";
  photoDataUrl = null;
  $("#f-image-url").value = "";
  $("#f-photo").value = "";
  $("#image-url-status").classList.add("hidden");
  updateImagePreview();
});

/**
 * Atualiza o elemento de preview usando a regra de prioridade:
 * imageUrl → photo (upload) → esconde.
 */
function updateImagePreview() {
  const preview = $("#photo-preview");
  const wrap = $(".preview-wrap");
  const src = imageUrlValue || photoDataUrl || "";
  if (src) {
    preview.src = src;
    wrap.classList.add("show");
  } else {
    preview.removeAttribute("src");
    wrap.classList.remove("show");
  }
}

/**
 * Tenta carregar a URL da imagem num elemento Image em memória.
 * Mostra status (carregando / ok / erro) abaixo do input.
 * Se explicit=true, sempre mostra status (mesmo quando vazio).
 */
// ---------- Grade de imagens candidatas (seleção da galeria) ----------
/**
 * Renderiza a grade de miniaturas mostrando:
 * - Todas as URLs em `candidateImages`
 * - Destaca as que estão em `galleryImagesValue` (selecionadas)
 * - Destaca a `imageUrlValue` como principal
 */
function renderCandidateImages() {
  const box = $("#image-candidates");
  const grid = $("#candidates-grid");
  const countEl = $("#candidates-count");
  const selEl = $("#candidates-selected");

  if (!candidateImages || candidateImages.length === 0) {
    box.classList.add("hidden");
    grid.innerHTML = "";
    return;
  }

  box.classList.remove("hidden");
  countEl.textContent = candidateImages.length;
  selEl.textContent = galleryImagesValue.length;

  grid.innerHTML = candidateImages
    .map((url) => {
      const isSelected = galleryImagesValue.includes(url);
      const isMain = url === imageUrlValue;
      return `
        <div class="candidate-thumb ${isSelected ? "selected" : ""} ${isMain ? "main" : ""}"
             data-url="${escapeHtml(url)}">
          <img src="${escapeHtml(url)}" alt="" referrerpolicy="no-referrer"
               onerror="this.closest('.candidate-thumb').classList.add('broken')" />
          ${isMain ? `<span class="main-badge">⭐ PRINCIPAL</span>` : ""}
          <div class="thumb-actions">
            <button type="button" class="thumb-btn star" data-action="main" title="Definir como principal">⭐</button>
            <button type="button" class="thumb-btn check" data-action="toggle" title="Adicionar/remover da galeria">${isSelected ? "✓" : "+"}</button>
          </div>
        </div>
      `;
    })
    .join("");

  grid.querySelectorAll(".candidate-thumb").forEach((thumb) => {
    const url = thumb.dataset.url;
    // Clique no corpo = toggle galeria
    thumb.addEventListener("click", (e) => {
      if (e.target.closest("[data-action]")) return;
      toggleGalleryImage(url);
    });
    thumb.querySelector('[data-action="toggle"]').addEventListener("click", (e) => {
      e.stopPropagation();
      toggleGalleryImage(url);
    });
    thumb.querySelector('[data-action="main"]').addEventListener("click", (e) => {
      e.stopPropagation();
      setMainImage(url);
    });
  });
}

/** Adiciona/remove uma URL da galeria. */
function toggleGalleryImage(url) {
  const idx = galleryImagesValue.indexOf(url);
  if (idx >= 0) {
    galleryImagesValue.splice(idx, 1);
    // Se removeu a principal, limpa (ou cai para outra)
    if (url === imageUrlValue) {
      imageUrlValue = galleryImagesValue[0] || "";
      $("#f-image-url").value = imageUrlValue;
      updateImagePreview();
    }
  } else {
    galleryImagesValue.push(url);
    // Se nenhuma principal definida, vira a principal
    if (!imageUrlValue) {
      imageUrlValue = url;
      $("#f-image-url").value = url;
      updateImagePreview();
    }
  }
  renderCandidateImages();
}

/** Define uma URL como imagem principal (e garante que está na galeria). */
function setMainImage(url) {
  imageUrlValue = url;
  $("#f-image-url").value = url;
  if (!galleryImagesValue.includes(url)) {
    galleryImagesValue.push(url);
  }
  updateImagePreview();
  renderCandidateImages();
}

// Botões de ação da grade
$("#btn-select-all-imgs").addEventListener("click", () => {
  galleryImagesValue = [...candidateImages];
  if (!imageUrlValue && candidateImages.length > 0) {
    imageUrlValue = candidateImages[0];
    $("#f-image-url").value = imageUrlValue;
    updateImagePreview();
  }
  renderCandidateImages();
});

$("#btn-clear-imgs").addEventListener("click", () => {
  galleryImagesValue = [];
  imageUrlValue = "";
  $("#f-image-url").value = "";
  updateImagePreview();
  renderCandidateImages();
});

// Quando o usuário digita uma URL no campo principal manualmente,
// adiciona ao grid de candidatos para poder virar principal/galeria
$("#f-image-url").addEventListener("change", () => {
  const url = $("#f-image-url").value.trim();
  if (url && isValidImageUrl(url) && !candidateImages.includes(url)) {
    candidateImages.push(url);
    renderCandidateImages();
  }
});

function testImageUrlLive(explicit = false) {
  const statusEl = $("#image-url-status");
  const url = imageUrlValue;

  if (!url) {
    statusEl.classList.add("hidden");
    updateImagePreview();
    return;
  }

  if (!isValidImageUrl(url)) {
    statusEl.className = "image-status error";
    statusEl.textContent = "⚠️ URL inválida — precisa começar com http:// ou https://";
    statusEl.classList.remove("hidden");
    return;
  }

  statusEl.className = "image-status loading";
  statusEl.textContent = "⏳ Carregando imagem...";
  statusEl.classList.remove("hidden");

  const img = new Image();
  img.onload = () => {
    statusEl.className = "image-status ok";
    statusEl.textContent = `✓ Imagem carregada (${img.naturalWidth}×${img.naturalHeight})`;
    updateImagePreview();
    if (!explicit) {
      // Esconde depois de 2.5s quando é automático
      setTimeout(() => statusEl.classList.add("hidden"), 2500);
    }
  };
  img.onerror = () => {
    statusEl.className = "image-status error";
    statusEl.textContent = "❌ Não foi possível carregar esta imagem. Verifique a URL.";
    // Mantém o src no preview para feedback visual, mas marca erro
  };
  img.src = url;
}

// ---------- Cálculo ao vivo no modal produto ----------
// Campos que podem afetar o cálculo ao vivo. No modo criação também incluem os
// campos da primeira compra; no modo edição, os valores vêm do storage.
const LIVE_CALC_FIELDS = [
  "f-units-per-kit", "f-price", "f-fee", "f-target-profit",
  "f-fp-qty", "f-fp-cost-product", "f-fp-cost-tax",
];
LIVE_CALC_FIELDS.forEach((id) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", updateLiveCalc);
});

/** Monta um objeto product "virtual" para alimentar calcProduct ao vivo. */
function buildFormProduct() {
  const base = {
    unitsPerKit: $("#f-units-per-kit").value,
    price: $("#f-price").value,
    fee: $("#f-fee").value,
  };

  if (editingId) {
    // No modo edição, os custos vêm das compras já salvas
    const p = Storage.get(editingId);
    return { ...base, purchases: p?.purchases || [] };
  }

  // Modo criação: a primeira compra está sendo preenchida no formulário
  return {
    ...base,
    purchases: [
      {
        qty: $("#f-fp-qty").value,
        costProduct: $("#f-fp-cost-product").value,
        costTax: $("#f-fp-cost-tax").value,
      },
    ],
  };
}

function updateLiveCalc() {
  const target = parseFloat($("#f-target-profit").value) || 0;
  const c = calcProduct(buildFormProduct(), target);

  // Custos
  $("#c-cost-product").textContent = BRL(c.costProduct);
  $("#c-cost-tax").textContent = BRL(c.costTax);
  $("#c-invested").textContent = BRL(c.totalInvested);
  $("#c-tax-pct").textContent = PCT(c.taxPct);
  $("#c-cost-unit").textContent = BRL(c.costUnit);
  $("#c-cost-kit").textContent = BRL(c.costPerKit);

  // Estoque
  $("#c-qty-total").textContent = `${c.qtyBought} un`;
  $("#c-kits").textContent = c.kits;
  $("#c-leftover").textContent = c.leftover;
  $("#c-net").textContent = BRL(c.netPerKit);
  $("#c-unit-profit").textContent = BRL(c.profitPerKit);

  // Resultado
  const totalEl = $("#c-total");
  const pcEl = $("#c-profit-cost");
  const nmEl = $("#c-net-margin");
  totalEl.textContent = BRL(c.totalProfit);
  pcEl.textContent = PCT(c.profitOnCost);
  nmEl.textContent = PCT(c.netMargin);
  const isLoss = c.profitPerKit < 0;
  [totalEl, pcEl, nmEl].forEach((el) => el.classList.toggle("loss", isLoss));
  const resultSection = pcEl.closest(".calc-section");
  if (resultSection) resultSection.classList.toggle("is-loss", isLoss);

  // Sugestão
  $("#c-target-label").textContent = `${target}%`;
  $("#c-suggested").textContent = BRL(c.suggestedPrice);

  // Aviso de sobra
  const unitsPerKit = parseInt($("#f-units-per-kit").value) || 1;
  const warn = $("#leftover-warning");
  if (c.leftover > 0 && unitsPerKit > 1) {
    warn.classList.remove("hidden");
    $("#warn-text").textContent =
      `${c.kits} kits completos, sobra(m) ${c.leftover} unidade(s) avulsa(s).`;
  } else {
    warn.classList.add("hidden");
  }
}

$("#btn-apply-suggest").addEventListener("click", () => {
  const target = parseFloat($("#f-target-profit").value) || 0;
  const c = calcProduct(buildFormProduct(), target);
  if (c.suggestedPrice > 0) {
    $("#f-price").value = c.suggestedPrice.toFixed(2);
    updateLiveCalc();
  }
});

// ---------- Lista de compras dentro do modal produto ----------
function renderProductPurchasesList(product) {
  const container = $("#product-purchases-list");
  container.innerHTML = "";

  const purchases = [...(product.purchases || [])].sort(
    (a, b) => purchaseSortKey(b).localeCompare(purchaseSortKey(a))
  );

  if (purchases.length === 0) {
    container.innerHTML = `<p class="purchase-empty">Nenhuma compra registrada.</p>`;
    return;
  }

  purchases.forEach((pu, idx) => {
    const { total, unitCost } = calcPurchase(pu);
    const item = document.createElement("div");
    item.className = "purchase-item" + (idx === 0 ? " latest" : "");
    item.innerHTML = `
      <div class="pi-date">
        ${formatDate(pu.date)}
        ${pu.createdAt ? `<div class="pi-time">${formatDateTime(pu.createdAt).slice(-5)}</div>` : ""}
        ${idx === 0 ? `<div class="pi-latest-tag">ÚLTIMA</div>` : ""}
      </div>
      <div class="pi-info">
        <span class="pi-main">${pu.qty} un • ${BRL(pu.costProduct)} produto${
          pu.costTax > 0 ? ` + ${BRL(pu.costTax)} imposto` : ""
        }</span>
        <span class="pi-sub">
          Custo/un ${BRL(unitCost)}
          ${pu.note ? ` • ${escapeHtml(pu.note)}` : ""}
        </span>
      </div>
      <div>
        <span class="pi-origin ${pu.origin || "nacional"}">${pu.origin || "nacional"}</span>
        <div class="pi-total">${BRL(total)}</div>
      </div>
      <div class="pi-actions">
        <button type="button" data-edit-purchase="${pu.id}" title="Editar">✏️</button>
        <button type="button" data-del-purchase="${pu.id}" title="Excluir">🗑️</button>
      </div>
    `;
    container.appendChild(item);
  });

  container.querySelectorAll("[data-edit-purchase]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const purchase = product.purchases.find(
        (x) => x.id === btn.dataset.editPurchase
      );
      if (purchase) openPurchaseModal(product.id, purchase);
    });
  });

  container.querySelectorAll("[data-del-purchase]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (product.purchases.length <= 1) {
        alert("Um produto precisa ter ao menos uma compra. Exclua o produto em vez disso.");
        return;
      }
      if (!confirm("Excluir esta compra do histórico?")) return;
      const updated = {
        ...product,
        purchases: product.purchases.filter((x) => x.id !== btn.dataset.delPurchase),
      };
      Storage.update(product.id, { purchases: updated.purchases });
      renderProductPurchasesList(Storage.get(product.id));
      updateLiveCalc();
      render();
    });
  });
}

$("#btn-add-purchase").addEventListener("click", () => {
  if (!editingId) return;
  openPurchaseModal(editingId, null);
});

// ---------- Salvar produto ----------
$("#product-form").addEventListener("submit", (e) => {
  e.preventDefault();

  const productData = {
    name: $("#f-name").value.trim(),
    description: $("#f-description").value.trim(),
    unitsPerKit: Math.max(1, parseInt($("#f-units-per-kit").value) || 1),
    price: parseFloat($("#f-price").value) || 0,
    fee: parseFloat($("#f-fee").value) || 0,
    link: $("#f-link").value.trim(),
    photo: photoDataUrl,
    imageUrl: imageUrlValue || "",
    galleryImages: [...galleryImagesValue],
    updatedAt: new Date().toISOString(),
  };

  if (editingId) {
    Storage.update(editingId, productData);
  } else {
    const firstPurchase = {
      id: genId(),
      createdAt: new Date().toISOString(),
      date: $("#f-fp-date").value || todayISO(),
      qty: Math.max(1, parseInt($("#f-fp-qty").value) || 1),
      costProduct: parseFloat($("#f-fp-cost-product").value) || 0,
      costTax: parseFloat($("#f-fp-cost-tax").value) || 0,
      origin: $("#f-fp-origin").value || "nacional",
      note: $("#f-fp-note").value.trim(),
    };
    Storage.add({ ...productData, purchases: [firstPurchase] });
  }

  closeModal();
  render();
});

// ==============================================================
// MODAL COMPRA (nova/editar compra individual)
// ==============================================================
const purchaseModal = $("#purchase-modal");

function openPurchaseModal(productId, purchase = null) {
  editingPurchaseProductId = productId;
  editingPurchaseId = purchase ? purchase.id : null;

  $("#purchase-modal-title").textContent = purchase ? "Editar Compra" : "Nova Compra";
  $("#purchase-id").value = purchase?.id || "";
  $("#purchase-product-id").value = productId;
  $("#f-p-date").value = purchase?.date || todayISO();
  $("#f-p-qty").value = purchase?.qty || 1;
  $("#f-p-cost-product").value = purchase?.costProduct ?? "";
  $("#f-p-cost-tax").value = purchase?.costTax ? purchase.costTax : "";
  $("#f-p-origin").value = purchase?.origin || "nacional";
  $("#f-p-note").value = purchase?.note || "";

  updatePurchaseLiveCalc();
  purchaseModal.classList.remove("hidden");
}

function closePurchaseModal() {
  purchaseModal.classList.add("hidden");
  editingPurchaseId = null;
  editingPurchaseProductId = null;
}

$("#purchase-modal-close").addEventListener("click", closePurchaseModal);
$("#btn-p-cancel").addEventListener("click", closePurchaseModal);
// >>> clique fora também NÃO fecha <<<

// Live calc no modal de compra
["f-p-qty", "f-p-cost-product", "f-p-cost-tax"].forEach((id) => {
  document.getElementById(id).addEventListener("input", updatePurchaseLiveCalc);
});

function updatePurchaseLiveCalc() {
  const { total, unitCost } = calcPurchase({
    qty: $("#f-p-qty").value,
    costProduct: $("#f-p-cost-product").value,
    costTax: $("#f-p-cost-tax").value,
  });
  $("#cp-total").textContent = BRL(total);
  $("#cp-unit").textContent = BRL(unitCost);
}

$("#purchase-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const productId = editingPurchaseProductId;
  if (!productId) return;

  const product = Storage.get(productId);
  if (!product) return;

  // Preserva createdAt original ao editar; cria um novo ao criar
  let originalCreatedAt = null;
  if (editingPurchaseId) {
    const existing = product.purchases.find((x) => x.id === editingPurchaseId);
    originalCreatedAt = existing?.createdAt || null;
  }

  const purchaseData = {
    id: editingPurchaseId || genId(),
    createdAt: originalCreatedAt || new Date().toISOString(),
    date: $("#f-p-date").value || todayISO(),
    qty: Math.max(1, parseInt($("#f-p-qty").value) || 1),
    costProduct: parseFloat($("#f-p-cost-product").value) || 0,
    costTax: parseFloat($("#f-p-cost-tax").value) || 0,
    origin: $("#f-p-origin").value || "nacional",
    note: $("#f-p-note").value.trim(),
  };

  let newPurchases;
  if (editingPurchaseId) {
    newPurchases = product.purchases.map((x) =>
      x.id === editingPurchaseId ? purchaseData : x
    );
  } else {
    newPurchases = [...(product.purchases || []), purchaseData];
  }

  Storage.update(productId, { purchases: newPurchases });

  closePurchaseModal();

  // Se o modal de produto está aberto em modo edição, atualiza a lista
  if (editingId === productId) {
    renderProductPurchasesList(Storage.get(productId));
    updateLiveCalc();
  }
  render();
});

// ==============================================================
// FILTROS / BUSCA / ORDENAÇÃO
// ==============================================================
$("#search").addEventListener("input", render);
$("#sort").addEventListener("change", render);
$("#filter-profit").addEventListener("change", render);

function getFilteredProducts() {
  let list = Storage.getAll().map(migrate);

  const q = $("#search").value.toLowerCase().trim();
  if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));

  const filter = $("#filter-profit").value;
  list = list.filter((p) => {
    const c = calcProduct(p);
    if (filter === "positive") return c.totalProfit > 0;
    if (filter === "loss") return c.totalProfit < 0;
    if (filter === "high") return c.profitOnCost > 50;
    return true;
  });

  const sort = $("#sort").value;
  list.sort((a, b) => {
    const ca = calcProduct(a);
    const cb = calcProduct(b);
    switch (sort) {
      case "profit-desc": return cb.totalProfit - ca.totalProfit;
      case "profit-asc":  return ca.totalProfit - cb.totalProfit;
      case "margin-desc": return cb.profitOnCost - ca.profitOnCost;
      case "name":        return a.name.localeCompare(b.name);
      default:            return (b.createdAt || "").localeCompare(a.createdAt || "");
    }
  });
  return list;
}

// ==============================================================
// RENDER
// ==============================================================
function render() {
  renderCatalog();
  renderDashboard();
  if (!$("#view-historico").classList.contains("hidden")) {
    renderHistoryView();
  }
}

function renderCatalog() {
  const list = getFilteredProducts();
  const catalog = $("#catalog");
  catalog.innerHTML = "";
  $("#empty-catalog").classList.toggle("hidden", list.length > 0);

  const topIds = new Set(
    Storage.getAll()
      .map(migrate)
      .map((p) => ({ id: p.id, total: calcProduct(p).totalProfit }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3)
      .filter((p) => p.total > 0)
      .map((p) => p.id)
  );

  list.forEach((p) => {
    const c = calcProduct(p);
    const isHot = topIds.has(p.id);
    const isLoss = c.totalProfit < 0;
    const kitLabel = p.unitsPerKit > 1 ? `kit de ${p.unitsPerKit}` : "unidade";

    const card = document.createElement("article");
    card.className = "product-card" + (isHot ? " hot" : "");
    card.dataset.productId = p.id;
    const imgSrc = getProductImage(p);
    card.innerHTML = `
      ${
        imgSrc
          ? `<img class="product-photo" src="${escapeHtml(imgSrc)}" alt="${escapeHtml(p.name)}" onerror="this.outerHTML='<div class=\\'product-photo-empty\\'>📦</div>'">`
          : `<div class="product-photo-empty">📦</div>`
      }
      <div class="product-body">
        <h4 class="product-name">${escapeHtml(p.name)}</h4>

        <div class="product-specs">
          <div class="spec"><span>Invest. total</span><b>${BRL(c.totalInvested)}</b></div>
          <div class="spec"><span>${c.costTax > 0 ? `Imposto (${PCT(c.taxPct)})` : "Imposto"}</span><b>${BRL(c.costTax)}</b></div>
          <div class="spec"><span>Custo/un</span><b>${BRL(c.costUnit)}</b></div>
          <div class="spec"><span>Custo/${kitLabel}</span><b>${BRL(c.costPerKit)}</b></div>
          <div class="spec"><span>Venda/${kitLabel}</span><b>${BRL(p.price)}</b></div>
          <div class="spec"><span>Taxa</span><b>${PCT(p.fee)}</b></div>
          <div class="spec"><span>Comprado</span><b>${c.qtyBought} un</b></div>
          <div class="spec"><span>Kits</span><b>${c.kits}${c.leftover ? ` <small style="color:#f59e0b">+${c.leftover}</small>` : ""}</b></div>
          <div class="spec"><span>Compras</span><b>${c.purchasesCount}</b></div>
          <div class="spec"><span>Lucro/kit</span><b>${BRL(c.profitPerKit)}</b></div>
        </div>

        <div class="product-profit-block">
          <span class="label">Lucro Total</span>
          <span class="value ${isLoss ? "loss" : ""}">${BRL(c.totalProfit)}</span>
          <span class="margin-tag ${isLoss ? "loss" : ""}">
            ${PCT(c.profitOnCost)} sobre custo • ${PCT(c.netMargin)} margem
          </span>
        </div>

        <div class="product-actions">
          ${
            p.link
              ? `<a class="btn-link" href="${escapeHtml(p.link)}" target="_blank">🔗 Link</a>`
              : `<span class="btn-link" style="opacity:0.4;cursor:default">Sem link</span>`
          }
          <button class="btn-edit" data-edit="${p.id}" title="Editar">✏️</button>
          <button class="btn-delete" data-del="${p.id}" title="Excluir">🗑️</button>
        </div>
      </div>
    `;
    catalog.appendChild(card);
  });

  // Clique no card → abre detalhes. Botões internos param a propagação.
  catalog.querySelectorAll(".product-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".product-actions")) return; // cliques na barra de ações não abrem detalhes
      const prod = Storage.get(card.dataset.productId);
      if (prod) openDetailsModal(migrate(prod));
    });
  });

  catalog.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openModal(migrate(Storage.get(btn.dataset.edit)));
    });
  });
  catalog.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm("Tem certeza que deseja excluir este produto e todo o histórico de compras dele?")) {
        Storage.remove(btn.dataset.del);
        render();
      }
    });
  });
  catalog.querySelectorAll(".btn-link[href]").forEach((a) => {
    a.addEventListener("click", (e) => e.stopPropagation());
  });
}

function renderDashboard() {
  const all = Storage.getAll().map(migrate);
  let totalInvested = 0;
  let totalProfit = 0;
  let marginSum = 0;
  let marginCount = 0;

  const enriched = all.map((p) => {
    const c = calcProduct(p);
    totalInvested += c.totalInvested;
    totalProfit += c.totalProfit;
    if (c.costPerKit > 0) {
      marginSum += c.profitOnCost;
      marginCount++;
    }
    return { ...p, ...c };
  });

  $("#stat-invested").textContent = BRL(totalInvested);
  $("#stat-profit").textContent = BRL(totalProfit);
  $("#stat-margin").textContent = PCT(marginCount ? marginSum / marginCount : 0);
  $("#stat-count").textContent = all.length;

  const top = enriched.sort((a, b) => b.totalProfit - a.totalProfit).slice(0, 5);
  const topEl = $("#top-products");
  if (top.length === 0) {
    topEl.innerHTML = `<p class="empty">Nenhum produto cadastrado ainda.</p>`;
    return;
  }
  topEl.innerHTML = top
    .map(
      (p) => {
        const src = getProductImage(p);
        return `
    <div class="top-item">
      ${
        src
          ? `<img src="${escapeHtml(src)}" alt="" onerror="this.outerHTML='<div class=\\'thumb-empty\\' style=\\'width:48px;height:48px\\'>📦</div>'">`
          : `<div class="thumb-empty" style="width:48px;height:48px">📦</div>`
      }
      <div class="info">
        <b>${escapeHtml(p.name)}</b>
        <span>${p.kits} ${p.unitsPerKit > 1 ? "kits" : "un"} • ${PCT(p.profitOnCost)} lucro</span>
      </div>
      <div class="profit">${BRL(p.totalProfit)}</div>
    </div>
  `;
      }
    )
    .join("");
}

// ==============================================================
// VIEW HISTÓRICO
// ==============================================================
$("#timeline-filter-product")?.addEventListener("change", renderHistoryView);
$("#timeline-filter-origin")?.addEventListener("change", renderHistoryView);

function getAllPurchasesFlat() {
  const all = Storage.getAll().map(migrate);
  const flat = [];
  all.forEach((p) => {
    (p.purchases || []).forEach((pu) => {
      flat.push({
        ...pu,
        productId: p.id,
        productName: p.name,
        productPhoto: getProductImage(p),
      });
    });
  });
  // Ordena por timestamp (createdAt) decrescente, com fallback para date
  flat.sort((a, b) => purchaseSortKey(b).localeCompare(purchaseSortKey(a)));
  return flat;
}

function renderHistoryView() {
  // Preenche filtro de produtos (uma vez mantendo seleção)
  const allProducts = Storage.getAll().map(migrate);
  const productFilter = $("#timeline-filter-product");
  const currentSel = productFilter.value;
  productFilter.innerHTML = `<option value="all">Todos os produtos</option>` +
    allProducts
      .map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
      .join("");
  productFilter.value = currentSel && [...productFilter.options].some(o => o.value === currentSel) ? currentSel : "all";

  const selProduct = productFilter.value;
  const selOrigin = $("#timeline-filter-origin").value;

  let flat = getAllPurchasesFlat();
  if (selProduct !== "all") flat = flat.filter((x) => x.productId === selProduct);
  if (selOrigin !== "all") flat = flat.filter((x) => (x.origin || "nacional") === selOrigin);

  // ---- Card "última compra" ----
  const panel = $("#last-purchase-panel");
  const lpEmpty = flat.length === 0;
  panel.classList.toggle("hidden", lpEmpty);

  if (!lpEmpty) {
    const last = flat[0];
    const { total, unitCost } = calcPurchase(last);
    $("#lp-product-name").textContent = last.productName;
    // Mostra data escolhida + hora em que foi registrada no sistema
    const regTime = last.createdAt ? formatDateTime(last.createdAt).slice(-5) : "";
    $("#lp-date").textContent =
      formatDate(last.date) + (regTime ? ` • registrado às ${regTime}` : "");
    $("#lp-note").textContent = last.note || "";
    $("#lp-cost-product").textContent = BRL(last.costProduct);
    $("#lp-cost-tax").textContent = BRL(last.costTax);
    $("#lp-total").textContent = BRL(total);
    $("#lp-qty").textContent = `${last.qty} un`;
    $("#lp-unit-cost").textContent = BRL(unitCost);
    $("#lp-origin").textContent = last.origin || "nacional";

    const img = $("#lp-photo");
    const empty = $("#lp-photo-empty");
    if (last.productPhoto) {
      img.src = last.productPhoto;
      img.style.display = "";
      empty.style.display = "none";
    } else {
      img.style.display = "none";
      empty.style.display = "";
    }
  }

  // ---- Timeline ----
  const tl = $("#global-timeline");
  tl.innerHTML = "";
  $("#empty-timeline").classList.toggle("hidden", flat.length > 0);

  flat.forEach((pu) => {
    const { total, unitCost } = calcPurchase(pu);
    const item = document.createElement("div");
    item.className = "timeline-item";
    item.innerHTML = `
      <div class="timeline-top">
        <div class="timeline-left">
          ${
            pu.productPhoto
              ? `<img class="timeline-thumb" src="${pu.productPhoto}" alt="">`
              : `<div class="timeline-thumb-empty">📦</div>`
          }
          <div class="timeline-title">
            <b>${escapeHtml(pu.productName)}</b>
            <small>
              <span class="pi-origin ${pu.origin || "nacional"}">${pu.origin || "nacional"}</span>
              • ${pu.qty} un
            </small>
          </div>
        </div>
        <div class="timeline-right">
          <div class="t-total">${BRL(total)}</div>
          <div class="t-date">${formatDate(pu.date)}</div>
          ${pu.createdAt ? `<div class="t-time">${formatDateTime(pu.createdAt).slice(-5)}</div>` : ""}
        </div>
      </div>
      <div class="timeline-metrics">
        <div><span>Produto</span><b>${BRL(pu.costProduct)}</b></div>
        <div><span>Imposto</span><b>${BRL(pu.costTax)}</b></div>
        <div><span>Custo/un</span><b>${BRL(unitCost)}</b></div>
        <div><span>Quantidade</span><b>${pu.qty} un</b></div>
      </div>
      ${pu.note ? `<div class="timeline-note">💬 ${escapeHtml(pu.note)}</div>` : ""}
    `;
    tl.appendChild(item);
  });
}

// ==============================================================
// MODAL DE DETALHES DO PRODUTO
// ==============================================================
const detailsModal = $("#details-modal");
let detailsProductId = null;

function openDetailsModal(product) {
  if (!product) return;
  detailsProductId = product.id;

  const c = calcProduct(product);
  const origin = deriveOrigin(product.purchases);
  const isLoss = c.totalProfit < 0;

  // ---- Título e foto ----
  $("#dm-modal-title").textContent = "Detalhes do Produto";
  $("#dm-name").textContent = product.name || "—";
  const img = $("#dm-photo");
  const empty = $("#dm-photo-empty");
  const imgSrc = getProductImage(product);
  if (imgSrc) {
    img.src = imgSrc;
    img.style.display = "";
    empty.style.display = "none";
    // Se a URL externa falhar, cai no placeholder
    img.onerror = () => {
      img.style.display = "none";
      empty.style.display = "";
    };
  } else {
    img.removeAttribute("src");
    img.style.display = "none";
    empty.style.display = "";
  }

  // ---- Badges: origem + lucro/prejuízo + top ----
  const badges = $("#dm-badges");
  badges.innerHTML = "";
  const addBadge = (cls, text) => {
    const b = document.createElement("span");
    b.className = `badge ${cls}`;
    b.textContent = text;
    badges.appendChild(b);
  };
  addBadge(`badge-${origin}`, origin);
  if (c.totalProfit > 0) addBadge("badge-hot", `🔥 ${PCT(c.profitOnCost)} lucro`);
  if (isLoss) addBadge("badge-loss", "⚠️ Prejuízo");

  // ---- Datas ----
  const created = product.createdAt ? formatDate(product.createdAt) : "—";
  const updated = product.updatedAt ? formatDate(product.updatedAt) : created;
  $("#dm-dates").innerHTML =
    `Cadastrado em <b>${created}</b> • Atualizado em <b>${updated}</b>`;

  // ---- Link ----
  const linkEl = $("#dm-link");
  if (product.link) {
    linkEl.href = product.link;
    linkEl.classList.remove("hidden");
  } else {
    linkEl.classList.add("hidden");
  }

  // ---- Galeria de imagens ----
  const gallerySection = $("#dm-gallery-section");
  const galleryEl = $("#dm-gallery");
  const galleryList = Array.isArray(product.galleryImages) ? product.galleryImages : [];
  // Monta lista começando pela principal, depois a galeria sem duplicar
  const allImages = [];
  if (imgSrc) allImages.push(imgSrc);
  galleryList.forEach((u) => { if (!allImages.includes(u)) allImages.push(u); });

  if (allImages.length > 1) {
    gallerySection.classList.remove("hidden");
    galleryEl.innerHTML = allImages
      .map((u, i) =>
        `<img src="${escapeHtml(u)}" data-url="${escapeHtml(u)}" alt="" ` +
        `class="${i === 0 ? "active" : ""}" onerror="this.remove()" />`
      )
      .join("");
    galleryEl.querySelectorAll("img").forEach((el) => {
      el.addEventListener("click", () => {
        const newSrc = el.dataset.url;
        $("#dm-photo").src = newSrc;
        $("#dm-photo").style.display = "";
        $("#dm-photo-empty").style.display = "none";
        galleryEl.querySelectorAll("img").forEach((x) => x.classList.remove("active"));
        el.classList.add("active");
      });
    });
  } else {
    gallerySection.classList.add("hidden");
  }

  // ---- Descrição ----
  const descEl = $("#dm-description");
  if (product.description && product.description.trim()) {
    descEl.textContent = product.description;
    descEl.classList.remove("empty");
  } else {
    descEl.textContent = "Nenhuma descrição cadastrada. Clique em Editar para adicionar.";
    descEl.classList.add("empty");
  }

  // ---- Financeiro ----
  $("#dm-cost-product").textContent = BRL(c.costProduct);
  $("#dm-cost-tax").textContent = BRL(c.costTax);
  $("#dm-invested").textContent = BRL(c.totalInvested);
  $("#dm-cost-unit").textContent = BRL(c.costUnit);
  $("#dm-cost-kit").textContent = BRL(c.costPerKit);
  $("#dm-price").textContent = BRL(product.price);
  $("#dm-fee").textContent = PCT(product.fee);
  $("#dm-net").textContent = BRL(c.netPerKit);
  $("#dm-profit-kit").textContent = BRL(c.profitPerKit);
  $("#dm-profit-total").textContent = BRL(c.totalProfit);
  $("#dm-margin").textContent = PCT(c.netMargin);
  $("#dm-profit-cost").textContent = PCT(c.profitOnCost);

  const profitEl = $("#dm-profit-total").closest(".dg-item");
  profitEl.classList.toggle("loss", isLoss);

  // ---- Estoque ----
  $("#dm-qty").textContent = `${c.qtyBought} un`;
  $("#dm-units-per-kit").textContent = product.unitsPerKit || 1;
  $("#dm-kits").textContent = c.kits;
  $("#dm-leftover").textContent = c.leftover;

  // ---- Histórico ----
  const history = $("#dm-history");
  history.innerHTML = "";
  const purchases = [...(product.purchases || [])].sort(
    (a, b) => purchaseSortKey(b).localeCompare(purchaseSortKey(a))
  );
  if (purchases.length === 0) {
    history.innerHTML = `<p class="purchase-empty">Nenhuma compra registrada.</p>`;
    $("#dm-last-purchase-info").textContent = "";
  } else {
    const last = purchases[0];
    const { total: lastTotal } = calcPurchase(last);
    const lastReg = last.createdAt ? ` às ${formatDateTime(last.createdAt).slice(-5)}` : "";
    $("#dm-last-purchase-info").textContent =
      `Última compra: ${formatDate(last.date)}${lastReg} • ${BRL(lastTotal)}`;

    purchases.forEach((pu, idx) => {
      const { total, unitCost } = calcPurchase(pu);
      const item = document.createElement("div");
      item.className = "purchase-item" + (idx === 0 ? " latest" : "");
      item.innerHTML = `
        <div class="pi-date">
          ${formatDate(pu.date)}
          ${pu.createdAt ? `<div class="pi-time">${formatDateTime(pu.createdAt).slice(-5)}</div>` : ""}
          ${idx === 0 ? `<div class="pi-latest-tag">ÚLTIMA</div>` : ""}
        </div>
        <div class="pi-info">
          <span class="pi-main">${pu.qty} un • ${BRL(pu.costProduct)} produto${
            pu.costTax > 0 ? ` + ${BRL(pu.costTax)} imposto` : ""
          }</span>
          <span class="pi-sub">
            Custo/un ${BRL(unitCost)}
            ${pu.note ? ` • ${escapeHtml(pu.note)}` : ""}
          </span>
        </div>
        <div>
          <span class="pi-origin ${pu.origin || "nacional"}">${pu.origin || "nacional"}</span>
          <div class="pi-total">${BRL(total)}</div>
        </div>
        <div></div>
      `;
      history.appendChild(item);
    });
  }

  detailsModal.classList.remove("hidden");
}

function closeDetailsModal() {
  detailsModal.classList.add("hidden");
  detailsProductId = null;
}

$("#dm-close").addEventListener("click", closeDetailsModal);
$("#dm-close2").addEventListener("click", closeDetailsModal);
// >>> clique fora do modal NÃO fecha <<<

$("#dm-edit").addEventListener("click", () => {
  if (!detailsProductId) return;
  const p = migrate(Storage.get(detailsProductId));
  closeDetailsModal();
  openModal(p);
});

$("#dm-delete").addEventListener("click", () => {
  if (!detailsProductId) return;
  if (confirm("Tem certeza que deseja excluir este produto e todo o histórico de compras dele?")) {
    Storage.remove(detailsProductId);
    closeDetailsModal();
    render();
  }
});

/** Copia a descrição do produto para a área de transferência. */
$("#dm-copy-desc").addEventListener("click", async () => {
  if (!detailsProductId) return;
  const p = Storage.get(detailsProductId);
  const btn = $("#dm-copy-desc");
  const original = btn.textContent;

  // Monta o texto a ser copiado. Se não houver descrição, gera um
  // template simples com os dados do produto (útil para anúncios).
  let text = (p?.description || "").trim();
  if (!text) {
    text =
`${p.name}

• Preço: ${BRL(p.price)}
${p.link ? `• Link: ${p.link}` : ""}`.trim();
  }

  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = "✓ Copiado!";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove("copied");
    }, 1800);
  } catch (err) {
    // Fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    btn.textContent = "✓ Copiado!";
    setTimeout(() => (btn.textContent = original), 1800);
  }
});

// ==============================================================
// IMPORTAÇÃO DE EXCEL (.xlsx)
// ==============================================================
$("#import-file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (typeof XLSX === "undefined") {
    alert("⚠️ Biblioteca xlsx não encontrada (confira lib/xlsx.full.min.js).");
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = new Uint8Array(ev.target.result);
      const wb = XLSX.read(data, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      let count = 0;
      let skipped = 0;

      rows.forEach((row) => {
        const name = pick(row, [
          "produto", "nome", "name", "item", "descrição", "descricao",
        ]);
        if (!name || String(name).trim() === "") {
          skipped++;
          return;
        }

        const qtyBought =
          parseFloat(pick(row, ["quantidade comprada", "unidades compradas", "qtd comprada"])) ||
          parseFloat(pick(row, ["quantidade", "qtd", "qty"])) ||
          1;

        const unitsPerKit =
          parseFloat(pick(row, [
            "unidades por venda", "unidades por kit", "unidades por par",
            "itens por venda", "itens por kit", "tamanho do kit",
          ])) || 1;

        // Custo produto + imposto
        let costProduct = parseFloat(pick(row, [
          "custo total compra", "custo do produto", "custo produto",
          "valor pago", "total compra",
        ]));
        let costTax = parseFloat(pick(row, [
          "impostos / taxas importacao", "impostos/taxas importacao",
          "impostos taxas importacao", "impostos", "imposto",
          "taxas importacao", "taxa importacao", "taxas",
        ]));
        if (isNaN(costTax)) costTax = 0;

        if (isNaN(costProduct) || costProduct <= 0) {
          const custoUnit = parseFloat(pick(row, [
            "custo unitário", "custo unitario", "custo por unidade",
            "custo", "cost", "preço de custo", "preco de custo",
          ]));
          const custoTotalGeral = parseFloat(pick(row, ["custo total"]));
          if (!isNaN(custoTotalGeral) && custoTotalGeral > 0) {
            costProduct = custoTotalGeral - costTax;
            if (costProduct < 0) { costProduct = custoTotalGeral; costTax = 0; }
          } else if (!isNaN(custoUnit) && custoUnit > 0 && qtyBought > 0) {
            costProduct = custoUnit * qtyBought;
          } else {
            costProduct = 0;
          }
        }

        const price =
          parseFloat(pick(row, [
            "valor de revenda", "revenda", "preço do kit", "preco do kit",
            "venda", "preço de venda", "preco de venda", "preço", "preco", "price",
          ])) || 0;

        let fee = parseFloat(pick(row, [
          "taxa shopee (%)", "taxa shopee", "taxa mercado livre",
          "taxa plataforma", "taxa", "comissão", "comissao", "fee", "%",
        ]));
        if (isNaN(fee)) fee = 0;
        if (fee > 0 && fee <= 1) fee = fee * 100;

        const link = String(pick(row, ["link", "url"]) || "").trim();

        // Data da compra (se vier na planilha)
        const dateRaw = pick(row, ["data", "data compra", "date"]);
        let date = todayISO();
        if (dateRaw instanceof Date) {
          date = dateRaw.toISOString().slice(0, 10);
        } else if (typeof dateRaw === "string" && dateRaw.length >= 8) {
          // tenta dd/mm/yyyy ou yyyy-mm-dd
          const m = dateRaw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
          if (m) date = `${m[3]}-${m[2]}-${m[1]}`;
          else if (/^\d{4}-\d{2}-\d{2}/.test(dateRaw)) date = dateRaw.slice(0, 10);
        }

        Storage.add({
          name: String(name).trim(),
          unitsPerKit: Math.max(1, Math.round(unitsPerKit)),
          price: Number(price.toFixed(4)),
          fee: Number(fee.toFixed(2)),
          link,
          photo: null,
          purchases: [{
            id: genId(),
            createdAt: new Date().toISOString(),
            date,
            qty: Math.max(1, Math.round(qtyBought)),
            costProduct: Number(costProduct.toFixed(4)),
            costTax: Number(costTax.toFixed(4)),
            origin: costTax > 0 ? "importado" : "nacional",
            note: "",
          }],
        });
        count++;
      });

      let msg = `✅ ${count} produto(s) importado(s) com sucesso!`;
      if (skipped > 0) msg += `\n⚠️ ${skipped} linha(s) vazia(s) ignorada(s).`;
      alert(msg);
      render();
    } catch (err) {
      console.error(err);
      alert("❌ Erro ao importar arquivo: " + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
  e.target.value = "";
});

function pick(row, keys) {
  const normalize = (s) =>
    String(s)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const normalized = {};
  Object.keys(row).forEach((k) => {
    normalized[normalize(k)] = row[k];
  });

  for (const k of keys) {
    const nk = normalize(k);
    if (normalized[nk] !== undefined && normalized[nk] !== "") {
      return normalized[nk];
    }
  }
  return "";
}

// ==============================================================
// INIT
// ==============================================================
render();
