/**
 * Ценообразование: себестоимость товара = сырьё (по весу) + упаковка + доля логистики на единицу.
 * Розничная цена = себестоимость с наценкой (маржа в процентах).
 */

function costPrice(variant) {
  const rawCost = (variant.raw_cost_per_kg * variant.weight_g) / 1000;
  return rawCost + variant.packaging_cost + variant.logistics_cost_per_unit;
}

function retailPrice(variant) {
  const cost = costPrice(variant);
  const price = cost * (1 + variant.margin_pct / 100);
  // округляем вверх до целого рубля/тенге — так удобнее ценникам и клиенту
  return Math.ceil(price);
}

function profitPerUnit(variant) {
  return retailPrice(variant) - costPrice(variant);
}

function breakdown(variant) {
  const rawCost = (variant.raw_cost_per_kg * variant.weight_g) / 1000;
  const cost = costPrice(variant);
  const price = retailPrice(variant);
  return {
    weight_g: variant.weight_g,
    raw_cost: round2(rawCost),
    packaging_cost: round2(variant.packaging_cost),
    logistics_cost: round2(variant.logistics_cost_per_unit),
    cost_price: round2(cost),
    margin_pct: variant.margin_pct,
    retail_price: price,
    profit: round2(price - cost),
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { costPrice, retailPrice, profitPerUnit, breakdown };
