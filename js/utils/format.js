/* ============================================
   format.js — Helpers puros de formatação e IDs
   Sem dependências de DOM. Carregado antes de app.js.
   ============================================ */

/** Formata número em Real brasileiro (R$). */
const BRL = (n) =>
  (Number(n) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

/** Formata número como porcentagem com 1 casa decimal. */
const PCT = (n) => `${(Number(n) || 0).toFixed(1)}%`;

/** Formata uma data ISO (yyyy-mm-dd ou ISO completa) para "dd/mm/yyyy". */
function formatDate(iso) {
  if (!iso) return "—";
  const d = iso.length >= 10 ? iso.slice(0, 10) : iso;
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

/**
 * Formata "dd/mm/yyyy HH:mm" quando há hora, só "dd/mm/yyyy" quando não há.
 * Aceita ISO com timezone (do toISOString()) e interpreta no fuso local.
 */
function formatDateTime(iso) {
  if (!iso) return "—";
  if (iso.length <= 10) return formatDate(iso);
  const d = new Date(iso);
  if (isNaN(d.getTime())) return formatDate(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Extrai apenas a hora "HH:mm" de um ISO timestamp com fuso local.
 * Retorna string vazia se não houver parte de hora ou se o input for inválido.
 */
function formatTime(iso) {
  if (!iso || typeof iso !== "string" || iso.length <= 10) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Chave para ordenar compras cronologicamente.
 * Usa createdAt (timestamp completo) ou cai na date (yyyy-mm-dd).
 */
function purchaseSortKey(pu) {
  if (pu.createdAt) return pu.createdAt;
  if (pu.date) return pu.date + "T00:00:00.000Z";
  return "";
}

/** Data de hoje no formato yyyy-mm-dd (para input[type=date]). */
function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Gera id único curto. */
function genId() {
  return Date.now().toString() + Math.random().toString(36).slice(2, 7);
}

/** Escapa HTML para evitar XSS ao inserir textos via innerHTML. */
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
