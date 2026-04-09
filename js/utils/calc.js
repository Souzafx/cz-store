/* ============================================
   calc.js — Funções puras de cálculo financeiro
   Sem dependências de DOM. Carregado antes de app.js.

   Fórmulas:
     totalInvested = Σ (costProduct + costTax)
     costUnit      = totalInvested / Σ qty
     costPerKit    = costUnit × unitsPerKit
     kits          = floor(qtyTotal / unitsPerKit)
     netPerKit     = price × (1 - fee/100)
     profitPerKit  = netPerKit - costPerKit
     totalProfit   = profitPerKit × kits
     profitOnCost% = (profitPerKit / costPerKit) × 100
     netMargin%    = (profitPerKit / netPerKit) × 100

   Sugestão de preço para atingir X% de lucro sobre custo:
     suggestedPrice = (costPerKit × (1 + X/100)) / (1 - fee/100)
   ============================================ */

/**
 * Agrega todas as compras de um produto e devolve os totais.
 * Aceita objeto com `purchases[]` (modelo v4+) e também produtos
 * "virtuais" do formulário com array inline.
 */
function calcProduct(p, targetProfitPct = 100) {
  const purchases = Array.isArray(p.purchases) ? p.purchases : [];

  let costProduct = 0;
  let costTax = 0;
  let qtyBought = 0;
  purchases.forEach((x) => {
    costProduct += Number(x.costProduct) || 0;
    costTax += Number(x.costTax) || 0;
    qtyBought += Number(x.qty) || 0;
  });

  const unitsPerKit = Math.max(1, Number(p.unitsPerKit) || 1);
  const price = Number(p.price) || 0;
  const fee = Number(p.fee) || 0;

  const totalInvested = costProduct + costTax;
  const costUnit = qtyBought > 0 ? totalInvested / qtyBought : 0;
  const costPerKit = costUnit * unitsPerKit;
  const taxPct = costProduct > 0 ? (costTax / costProduct) * 100 : 0;

  const kits = Math.floor(qtyBought / unitsPerKit);
  const leftover = qtyBought - kits * unitsPerKit;

  const feeFactor = 1 - fee / 100;
  const netPerKit = price * feeFactor;
  const profitPerKit = netPerKit - costPerKit;
  const totalProfit = profitPerKit * kits;

  const profitOnCost = costPerKit > 0 ? (profitPerKit / costPerKit) * 100 : 0;
  const netMargin = netPerKit > 0 ? (profitPerKit / netPerKit) * 100 : 0;

  const suggestedPrice =
    feeFactor > 0
      ? (costPerKit * (1 + targetProfitPct / 100)) / feeFactor
      : 0;

  return {
    costProduct, costTax, totalInvested, costUnit, costPerKit, taxPct,
    qtyBought, kits, leftover,
    netPerKit, profitPerKit, totalProfit, profitOnCost, netMargin,
    suggestedPrice,
    purchasesCount: purchases.length,
  };
}

/** Calcula total e custo/un de UMA compra individual. */
function calcPurchase(purchase) {
  const costProduct = Number(purchase.costProduct) || 0;
  const costTax = Number(purchase.costTax) || 0;
  const qty = Number(purchase.qty) || 0;
  const total = costProduct + costTax;
  const unitCost = qty > 0 ? total / qty : 0;
  return { total, unitCost };
}

/**
 * Deriva a "origem dominante" de um produto a partir das compras.
 * Retorna "nacional", "importado" ou "misto".
 */
function deriveOrigin(purchases) {
  if (!purchases || purchases.length === 0) return "nacional";
  const origins = new Set(purchases.map((x) => x.origin || "nacional"));
  if (origins.size === 1) return [...origins][0];
  return "misto";
}
