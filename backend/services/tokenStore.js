/* ============================================
   tokenStore.js — Persistência de access/refresh tokens Shopee

   Os tokens da Shopee têm vida curta:
   - access_token:  4 horas
   - refresh_token: 30 dias (troca a cada uso)

   Este módulo guarda os valores atuais em disco (data/shopee-tokens.json)
   e oferece helpers para ler/gravar atomicamente.
   ============================================ */

const fs = require("fs");
const path = require("path");
const config = require("../config");
const logger = require("../logger");

const TOKEN_FILE = config.TOKEN_FILE;

/**
 * Estrutura persistida:
 * {
 *   access_token:  "...",
 *   refresh_token: "...",
 *   expires_at:    1735000000,   // epoch seconds quando o access expira
 *   shop_id:       "...",
 *   updated_at:    "2026-04-09T18:00:00.000Z"
 * }
 */

function read() {
  try {
    if (!fs.existsSync(TOKEN_FILE)) {
      // Primeiro boot: usa valores do .env se existirem
      if (config.SHOPEE.INITIAL_ACCESS_TOKEN) {
        const seed = {
          access_token: config.SHOPEE.INITIAL_ACCESS_TOKEN,
          refresh_token: config.SHOPEE.INITIAL_REFRESH_TOKEN || "",
          // Se não souber a validade, assume 4h a partir de agora
          expires_at: Math.floor(Date.now() / 1000) + 4 * 60 * 60,
          shop_id: config.SHOPEE.SHOP_ID,
          updated_at: new Date().toISOString(),
          source: "env",
        };
        write(seed);
        logger.info("tokenStore: inicializado a partir do .env");
        return seed;
      }
      return null;
    }
    const raw = fs.readFileSync(TOKEN_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    logger.error("tokenStore: falha ao ler arquivo de tokens", { error: err.message });
    return null;
  }
}

function write(data) {
  try {
    const payload = {
      ...data,
      updated_at: new Date().toISOString(),
    };
    // Escrita atômica: grava em temp e renomeia
    const tmp = TOKEN_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), {
      encoding: "utf8",
      mode: 0o600, // apenas o dono pode ler/escrever
    });
    fs.renameSync(tmp, TOKEN_FILE);
    // Garante permissões restritas no arquivo final também
    try { fs.chmodSync(TOKEN_FILE, 0o600); } catch (_) {}
    return payload;
  } catch (err) {
    logger.error("tokenStore: falha ao gravar tokens", { error: err.message });
    throw err;
  }
}

/** Retorna true se o access_token está prestes a expirar (menos de 5 min). */
function isExpired() {
  const data = read();
  if (!data || !data.expires_at) return true;
  const now = Math.floor(Date.now() / 1000);
  return data.expires_at - now < 300; // 5 minutos de margem
}

/** Atalho: pega o access_token atual (pode estar expirado). */
function getAccessToken() {
  const data = read();
  return data?.access_token || "";
}

module.exports = {
  read,
  write,
  isExpired,
  getAccessToken,
};
