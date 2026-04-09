/* ============================================
   calc.js — Funções puras de cálculo financeiro

   Suporta DOIS tipos de produto:

   1) "resale"   — produto comprado para revenda
      Custos somados de purchases[]:
        totalInvested = Σ (costProduct + costTax)
        costUnit      = totalInvested / Σ qty
        costPerKit    = costUnit × unitsPerKit
        kits          = floor(qtyBought / unitsPerKit)

   2) "3d_print" — produto fabricado em impressão 3D
      Custos calculados de productionHistory[]:
        filamentCost(batch)  = (weightGrams / 1000) × filamentCostPerKg
        energyCost(batch)    = energyKwh × energyCostPerKwh
        batchCostUnit        = filamentCost + energyCost + extraCosts
        totalInvested        = Σ (batchCostUnit × quantity)
        costUnit             = totalInvested / Σ quantity
        kits                 = Σ quantity   (cada unidade é vendida sozinha)

   Ambos devolvem a MESMA forma de saída — assim cards, dashboard e
   detalhes funcionam uniformemente independente do tipo.

   Fórmulas comuns a partir daí:
     netPerKit    = price × (1 - fee/100)
     profitPerKit = netPerKit - costPerKit
     totalProfit  = profitPerKit × kits
     profitOnCost%= (profitPerKit / costPerKit) × 100
     netMargin%   = (profitPerKit / netPerKit)  × 100
     suggestedPrice = (costPerKit × (1 + X/100)) / (1 - fee/100)
   ============================================ */

/** Dispatcher: roteia para a lógica correta com base em p.type. */
function calcProduct(p, targetProfitPct = 100) {
  if (p && p.type === "3d_print") {
    return calcProduct3D(p, targetProfitPct);
  }
  return calcProductResale(p, targetProfitPct);
}

// ==========================================================
// RESALE — lógica original baseada em purchases[]
// ==========================================================
function calcProductResale(p, targetProfitPct = 100) {
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
    type: "resale",
    costProduct, costTax, totalInvested, costUnit, costPerKit, taxPct,
    qtyBought, kits, leftover,
    netPerKit, profitPerKit, totalProfit, profitOnCost, netMargin,
    suggestedPrice,
    purchasesCount: purchases.length,
    unitsPerKit,
  };
}

// ==========================================================
// 3D PRINT — agregação de productionHistory[]
// ==========================================================

/** Calcula custos de UM batch de produção 3D. */
function calcProductionBatch(batch) {
  const weight = Number(batch.weightGrams) || 0;
  const filKg = Number(batch.filamentCostPerKg) || 0;
  const energyKwh = Number(batch.energyKwh) || 0;
  const energyPrice = Number(batch.energyCostPerKwh) || 0;
  const extras = Number(batch.extraCosts) || 0;
  const qty = Math.max(1, Number(batch.quantity) || 1);
  const hours = Number(batch.printHours) || 0;
  const minutes = Number(batch.printMinutes) || 0;

  const filamentCost = (weight / 1000) * filKg;
  const energyCost = energyKwh * energyPrice;
  const costUnit = filamentCost + energyCost + extras;
  const costTotal = costUnit * qty;
  const totalMinutes = hours * 60 + minutes;

  return {
    filamentCost,
    energyCost,
    extraCosts: extras,
    costUnit,
    costTotal,
    quantity: qty,
    weightGrams: weight,
    totalMinutes,
  };
}

function calcProduct3D(p, targetProfitPct = 100) {
  const history = Array.isArray(p.productionHistory) ? p.productionHistory : [];

  let totalInvested = 0;
  let totalQty = 0;
  let totalFilamentCost = 0;
  let totalEnergyCost = 0;
  let totalExtras = 0;
  let totalWeight = 0;
  let totalMinutes = 0;

  history.forEach((b) => {
    const c = calcProductionBatch(b);
    totalInvested += c.costTotal;
    totalQty += c.quantity;
    totalFilamentCost += c.filamentCost * c.quantity;
    totalEnergyCost += c.energyCost * c.quantity;
    totalExtras += c.extraCosts * c.quantity;
    totalWeight += c.weightGrams * c.quantity;
    totalMinutes += c.totalMinutes;
  });

  const costUnit = totalQty > 0 ? totalInvested / totalQty : 0;
  const price = Number(p.price) || 0;
  const fee = Number(p.fee) || 0;
  const feeFactor = 1 - fee / 100;

  const netPerKit = price * feeFactor;
  const profitPerKit = netPerKit - costUnit;
  const totalProfit = profitPerKit * totalQty;

  const profitOnCost = costUnit > 0 ? (profitPerKit / costUnit) * 100 : 0;
  const netMargin = netPerKit > 0 ? (profitPerKit / netPerKit) * 100 : 0;

  const suggestedPrice =
    feeFactor > 0
      ? (costUnit * (1 + targetProfitPct / 100)) / feeFactor
      : 0;

  return {
    type: "3d_print",
    // Compatibilidade com a forma comum (cards/details reaproveitam)
    costProduct: totalFilamentCost + totalExtras,
    costTax: totalEnergyCost,
    totalInvested,
    costUnit,
    costPerKit: costUnit,   // em 3D, 1 unidade = 1 venda
    taxPct: 0,
    qtyBought: totalQty,
    kits: totalQty,
    leftover: 0,
    netPerKit,
    profitPerKit,
    totalProfit,
    profitOnCost,
    netMargin,
    suggestedPrice,
    purchasesCount: history.length,
    unitsPerKit: 1,
    // Campos específicos de 3D
    is3D: true,
    totalFilamentCost,
    totalEnergyCost,
    totalExtras,
    totalWeight,       // gramas somadas
    totalMinutes,      // tempo de impressão total
    avgWeightPerUnit: totalQty > 0 ? totalWeight / totalQty : 0,
    batchCount: history.length,
  };
}

// ==========================================================
// Helpers compartilhados
// ==========================================================

/** Calcula total e custo/un de UMA compra individual (resale). */
function calcPurchase(purchase) {
  const costProduct = Number(purchase.costProduct) || 0;
  const costTax = Number(purchase.costTax) || 0;
  const qty = Number(purchase.qty) || 0;
  const total = costProduct + costTax;
  const unitCost = qty > 0 ? total / qty : 0;
  return { total, unitCost };
}

/** Deriva a "origem dominante" de um produto resale. */
function deriveOrigin(purchases) {
  if (!purchases || purchases.length === 0) return "nacional";
  const origins = new Set(purchases.map((x) => x.origin || "nacional"));
  if (origins.size === 1) return [...origins][0];
  return "misto";
}

/** Formata tempo de impressão (minutos totais) como "2h 30min". */
function formatPrintTime(totalMinutes) {
  if (!totalMinutes || totalMinutes <= 0) return "—";
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}
