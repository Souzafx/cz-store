/* ============================================
   CZ Store — Backend de Integração Shopee
   Servidor Express local para assinar e encaminhar
   requisições à Shopee Partner API v2.
   ============================================ */

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const shopeeRoutes = require("./routes/shopeeRoutes");
const shopeeService = require("./services/shopeeService");

const app = express();
const PORT = process.env.PORT || 3000;

// CORS — libera chamadas do frontend rodando via file:// ou localhost
app.use(
  cors({
    origin: true,
    credentials: false,
  })
);

// Aceita payloads com imagens base64 grandes
app.use(express.json({ limit: "15mb" }));

// Logs simples de cada requisição
app.use((req, res, next) => {
  const t = new Date().toISOString();
  console.log(`[${t}] ${req.method} ${req.url}`);
  next();
});

// ---- Rotas ----
app.use("/api/shopee", shopeeRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    mode: shopeeService.isMockMode() ? "mock" : "live",
    configured: shopeeService.isConfigured(),
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error("❌ Erro não tratado:", err);
  res.status(500).json({ error: err.message || "Erro interno do servidor" });
});

app.listen(PORT, () => {
  const mode = shopeeService.isMockMode()
    ? "🧪 MOCK (simulação)"
    : "🔴 LIVE (Shopee real)";
  console.log("");
  console.log("═══════════════════════════════════════════════════");
  console.log("  CZ Store Backend — Integração Shopee");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  🚀 Rodando em: http://localhost:${PORT}`);
  console.log(`  ⚙️  Modo:       ${mode}`);
  console.log(`  🔍 Health:     http://localhost:${PORT}/health`);
  console.log("═══════════════════════════════════════════════════");
  console.log("");
  if (shopeeService.isMockMode()) {
    console.log("💡 Para sair do modo simulação, preencha o .env");
    console.log("   com as credenciais da Shopee e defina MOCK_MODE=false");
    console.log("");
  }
});
