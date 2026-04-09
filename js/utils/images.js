/* ============================================
   images.js — Helpers puros de manipulação de URLs de imagem
   Sem dependências de DOM. Carregado antes de app.js.
   ============================================ */

/**
 * Resolve qual imagem mostrar para um produto.
 * Prioridade: imageUrl → photo (upload base64) → galleryImages[0] → null.
 */
function getProductImage(p) {
  if (!p) return null;
  const url = (p.imageUrl || "").trim();
  if (url) return url;
  if (p.photo) return p.photo;
  if (Array.isArray(p.galleryImages) && p.galleryImages.length > 0) {
    return p.galleryImages[0];
  }
  return null;
}

/** Valida uma string como URL de imagem (http/https). */
function isValidImageUrl(s) {
  if (!s) return false;
  const trimmed = s.trim();
  return /^https?:\/\/.+/i.test(trimmed);
}

/** Normaliza URL de imagem (resolve //, /, relativas, escapes). */
function normalizeImageUrl(u, baseUrl) {
  if (!u) return null;
  u = String(u).trim().replace(/\\\//g, "/");
  if (u.startsWith("data:")) return null;
  if (u.startsWith("//")) return "https:" + u;
  if (u.startsWith("/") && baseUrl) {
    try {
      return new URL(u, baseUrl).href;
    } catch { return null; }
  }
  return u;
}

/** Detecta URLs que provavelmente NÃO são fotos de produto. */
function isJunkImage(u) {
  const lower = u.toLowerCase();
  if (/\b(icon|logo|sprite|pixel|tracking|beacon|avatar|flag|favicon|placeholder|loading|badge|rating|star-|arrow|btn|button)\b/i.test(lower)) return true;
  if (/\.(svg|gif)(\?|$)/i.test(lower)) return true;
  if (/_(?:20|24|30|32|40|48|50|60)x(?:20|24|30|32|40|48|50|60)(?:q\d+)?\./i.test(lower)) return true;
  if (/\.(js|css|json|html|xml|mp4|webm)(\?|$)/i.test(lower)) return true;
  return false;
}

/**
 * Tenta "upgradar" URL para o tamanho original. Marketplaces usam
 * padrões como _XYZxYZqN.jpg / _tn / _S / @XYZ para redimensionar.
 */
function upgradeImageSize(u) {
  return u
    // AliExpress: foo.jpg_220x220q75.jpg_.webp → foo.jpg
    .replace(/(\.(?:jpg|jpeg|png|webp))_\d+x\d+[^.]*\.(?:jpg|jpeg|png|webp)(?:_\.[a-z]+)?$/i, "$1")
    // Variações simples: foo_640x640.jpg → foo.jpg
    .replace(/_(\d{2,4})x(\1)(\.(?:jpg|jpeg|png|webp))$/i, "$3")
    // Shopee: arquivo_tn → arquivo
    .replace(/_tn(\?|$)/i, "$1")
    // Sufixos Amazon _SX300_, _SL500_
    .replace(/\._(?:S|SS|SX|SY|SL|AC)(\d+|_)?_\./i, ".")
    // Query de resize comum
    .replace(/([?&])(?:w|width|h|height|size|resize)=\d+/gi, "$1")
    .replace(/[?&]$/, "");
}

/** Remove duplicatas da lista de imagens (por URL normalizada sem query). */
function dedupeImages(arr) {
  const seen = new Set();
  const out = [];
  for (const u of arr) {
    if (!u) continue;
    const key = u.replace(/^https?:/i, "").split("?")[0].toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
  }
  return out;
}
