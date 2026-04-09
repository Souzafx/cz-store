/* ============================================
   config.js — Configuração validada do backend

   Carrega o .env, valida valores obrigatórios e expõe
   um objeto imutável para o resto da aplicação.

   Fail-fast: se algo estiver errado em produção, derruba
   o processo com mensagem clara antes de aceitar requisições.
   ============================================ */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PROD = NODE_ENV === "production";

// ---- Mock vs Live ----
const MOCK_MODE_EXPLICIT = String(process.env.MOCK_MODE).toLowerCase() === "true";
const HAS_CREDS = !!(
  process.env.SHOPEE_PARTNER_ID &&
  process.env.SHOPEE_PARTNER_KEY &&
  process.env.SHOPEE_SHOP_ID
);
const MOCK_MODE = MOCK_MODE_EXPLICIT || !HAS_CREDS;

// ---- API token opcional (recomendado em prod) ----
// Se definido, o frontend precisa enviar este valor no header X-CZ-Token
// para chamar qualquer endpoint de Shopee. Gera um default se não definido.
let API_TOKEN = process.env.CZ_API_TOKEN || "";
const REQUIRE_AUTH = !!API_TOKEN;

// ---- CORS ----
// Default: só localhost. Em prod pode customizar via env
// ALLOWED_ORIGINS=https://meusite.com,https://outro.com
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ---- Rate limit ----
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX) || 60;
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000;

// ---- Porta e bind ----
const PORT = parseInt(process.env.PORT) || 3000;
// Por padrão só aceita conexões da própria máquina (segurança)
// Para expor em rede/cloud, defina BIND_HOST=0.0.0.0
const BIND_HOST = process.env.BIND_HOST || "127.0.0.1";

// ---- Paths ----
const ROOT = __dirname;
const LOG_DIR = path.join(ROOT, "logs");
const DATA_DIR = path.join(ROOT, "data");
const TOKEN_FILE = path.join(DATA_DIR, "shopee-tokens.json");

// Garante existência dos diretórios
[LOG_DIR, DATA_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ==========================================================
// Validação fail-fast (só em produção)
// ==========================================================
function validateProd() {
  const errors = [];

  if (!HAS_CREDS && !MOCK_MODE_EXPLICIT) {
    errors.push(
      "SHOPEE_PARTNER_ID/KEY/SHOP_ID ausentes — preencha o .env " +
      "ou defina MOCK_MODE=true explicitamente"
    );
  }
  if (!API_TOKEN) {
    errors.push(
      "CZ_API_TOKEN não definido — obrigatório em produção para autenticar o frontend"
    );
  }
  if (BIND_HOST === "0.0.0.0" && !API_TOKEN) {
    errors.push(
      "BIND_HOST=0.0.0.0 sem CZ_API_TOKEN é INSEGURO. " +
      "Defina um token ou volte para 127.0.0.1"
    );
  }
  if (BIND_HOST === "0.0.0.0" && ALLOWED_ORIGINS.length === 0) {
    errors.push(
      "ALLOWED_ORIGINS vazio em bind público — defina pelo menos uma origem"
    );
  }

  if (errors.length > 0) {
    console.error("\n❌ Configuração inválida para produção:\n");
    errors.forEach((e) => console.error("  • " + e));
    console.error(
      "\n💡 Revise o .env ou exporte NODE_ENV=development para afrouxar as checagens.\n"
    );
    process.exit(1);
  }
}

if (IS_PROD) validateProd();

// ==========================================================
// Exports
// ==========================================================
module.exports = Object.freeze({
  NODE_ENV,
  IS_PROD,
  MOCK_MODE,
  HAS_CREDS,
  API_TOKEN,
  REQUIRE_AUTH,
  ALLOWED_ORIGINS,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  PORT,
  BIND_HOST,
  LOG_DIR,
  DATA_DIR,
  TOKEN_FILE,
  SHOPEE: {
    PARTNER_ID: process.env.SHOPEE_PARTNER_ID || "",
    PARTNER_KEY: process.env.SHOPEE_PARTNER_KEY || "",
    SHOP_ID: process.env.SHOPEE_SHOP_ID || "",
    BASE_URL: process.env.SHOPEE_BASE_URL || "https://partner.shopeemobile.com",
    // access_token/refresh_token vêm do TOKEN_FILE, não do .env
    INITIAL_ACCESS_TOKEN: process.env.SHOPEE_ACCESS_TOKEN || "",
    INITIAL_REFRESH_TOKEN: process.env.SHOPEE_REFRESH_TOKEN || "",
  },
});
