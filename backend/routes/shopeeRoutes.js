/* ============================================
   shopeeRoutes.js — Rotas HTTP do módulo Shopee
   ============================================ */

const express = require("express");
const router = express.Router();
const shopeeService = require("../services/shopeeService");

/**
 * POST /api/shopee/create-product
 * Cria um produto novo na loja Shopee.
 */
router.post("/create-product", async (req, res) => {
  try {
    const product = req.body;

    // Validação de campos obrigatórios
    const validation = shopeeService.validateProduct(product);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
      });
    }

    const result = await shopeeService.createProduct(product);
    res.json(result);
  } catch (error) {
    console.error("❌ create-product error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message || "Erro ao criar produto na Shopee",
    });
  }
});

/**
 * GET /api/shopee/status
 * Retorna o modo atual (mock/live) e estado da configuração.
 */
router.get("/status", (req, res) => {
  res.json({
    mode: shopeeService.isMockMode() ? "mock" : "live",
    configured: shopeeService.isConfigured(),
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
