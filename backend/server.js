/* ============================================
   CZ Store — Backend Shopee (v2.2.0 production-ready)

   - helmet: headers de segurança
   - express-rate-limit: throttling anti-abuso
   - CORS restrito (config.ALLOWED_ORIGINS)
   - Bind em 127.0.0.1 por padrão
   - Token opcional via header X-CZ-Token
   - Graceful shutdown (SIGTERM/SIGINT)
   - Logs estruturados em logs/YYYY-MM-DD.log
   - Erros sanitizados (nunca vaza stack trace em prod)
   ============================================ */

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const config = require("./config");
const logger = require("./logger");
const shopeeRoutes = require("./routes/shopeeRoutes");
const shopeeService = require("./services/shopeeService");

const app = express();

// ==========================================================
// Segurança básica
// ==========================================================
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(express.json({ limit: "15mb" }));

// ==========================================================
// CORS
// ==========================================================
const defaultOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "null", // file:// envia Origin=null
];
const allowedOrigins = new Set([...defaultOrigins, ...config.ALLOWED_ORIGINS]);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.has(origin)) return cb(null, true);
      if (config.IS_PROD) {
        logger.warn("CORS bloqueado", { origin });
        return cb(new Error("Origem não permitida"), false);
      }
      logger.debug("CORS permitido (dev)", { origin });
      return cb(null, true);
    },
    credentials: false,
  })
);

// ==========================================================
// Rate limiting (aplicado só nas rotas de Shopee)
// ==========================================================
const shopeeLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Muitas requisições. Aguarde um instante e tente novamente.",
  },
});

// ==========================================================
// Request ID + log de cada chamada
// ==========================================================
app.use((req, res, next) => {
  req.id = Math.random().toString(36).slice(2, 10);
  const start = Date.now();
  res.on("finish", () => {
    logger.info("request", {
      id: req.id,
      method: req.method,
      url: req.url,
      status: res.statusCode,
      ms: Date.now() - start,
    });
  });
  next();
});

// ==========================================================
// Auth por token (se CZ_API_TOKEN estiver definido)
// ==========================================================
function requireToken(req, res, next) {
  if (!config.REQUIRE_AUTH) return next();
  const provided = req.headers["x-cz-token"];
  if (!provided || provided !== config.API_TOKEN) {
    logger.warn("auth: token ausente ou inválido", { id: req.id });
    return res.status(401).json({
      success: false,
      error: "Não autorizado. Configure o token no frontend.",
    });
  }
  next();
}

// ==========================================================
// Health check (público, sem token)
// ==========================================================
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    version: require("./package.json").version,
    mode: shopeeService.isMockMode() ? "mock" : "live",
    configured: shopeeService.isConfigured(),
    env: config.NODE_ENV,
    auth_required: config.REQUIRE_AUTH,
    timestamp: new Date().toISOString(),
  });
});

// ==========================================================
// Rotas Shopee (protegidas por token + rate limit)
// ==========================================================
app.use("/api/shopee", shopeeLimiter, requireToken, shopeeRoutes);

// ==========================================================
// 404
// ==========================================================
app.use((req, res) => {
  res.status(404).json({ success: false, error: "Rota não encontrada" });
});

// ==========================================================
// Error handler global — sanitiza em prod
// ==========================================================
app.use((err, req, res, next) => {
  logger.error("unhandled", {
    id: req.id,
    message: err.message,
    stack: config.IS_PROD ? undefined : err.stack,
  });
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: config.IS_PROD ? "Erro interno do servidor" : err.message,
  });
});

// ==========================================================
// Start
// ==========================================================
const server = app.listen(config.PORT, config.BIND_HOST, () => {
  const mode = shopeeService.isMockMode()
    ? "🧪 MOCK (simulação)"
    : "🔴 LIVE (Shopee real)";
  const publicBind = config.BIND_HOST === "0.0.0.0" ? " ⚠️ PÚBLICO" : "";

  logger.info("═══════════════════════════════════════════════════");
  logger.info(`  CZ Store Backend v${require("./package.json").version}`);
  logger.info("═══════════════════════════════════════════════════");
  logger.info(`  🚀 http://${config.BIND_HOST}:${config.PORT}${publicBind}`);
  logger.info(`  ⚙️  Modo:      ${mode}`);
  logger.info(`  🌍 Ambiente:  ${config.NODE_ENV}`);
  logger.info(`  🔐 Auth:      ${config.REQUIRE_AUTH ? "X-CZ-Token obrigatório" : "desabilitada (localhost)"}`);
  logger.info(`  🛡️  Rate:      ${config.RATE_LIMIT_MAX} req / ${config.RATE_LIMIT_WINDOW_MS / 1000}s`);
  logger.info(`  📜 Logs:      ${config.LOG_DIR}/`);
  logger.info("═══════════════════════════════════════════════════");

  if (shopeeService.isMockMode()) {
    logger.info("💡 Para sair do mock, preencha o .env e MOCK_MODE=false");
  }
});

// ==========================================================
// Graceful shutdown
// ==========================================================
function shutdown(signal) {
  logger.info(`Recebido ${signal}, encerrando graciosamente...`);
  server.close(() => {
    logger.info("HTTP server fechado. Bye.");
    process.exit(0);
  });
  setTimeout(() => {
    logger.error("Shutdown timeout — forçando saída");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("uncaughtException", (err) => {
  logger.error("uncaughtException", { message: err.message, stack: err.stack });
});
process.on("unhandledRejection", (reason) => {
  logger.error("unhandledRejection", { reason: String(reason) });
});
