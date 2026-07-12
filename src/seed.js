const db = require('./db');
const { retailPrice } = require('./pricing');

// Стартовый ассортимент: 5 орехов + 5 сухофруктов.
// raw_cost_per_kg — ПЛЕЙСХОЛДЕРЫ, замените на свои реальные закупочные цены
// (в вашей валюте) через админ-бота командой /setcost.
const PRODUCTS = [
  { name: 'Грецкий орех', category: 'nut', raw_cost_per_kg: 900 },
  { name: 'Фундук', category: 'nut', raw_cost_per_kg: 1100 },
  { name: 'Миндаль', category: 'nut', raw_cost_per_kg: 1300 },
  { name: 'Кешью', category: 'nut', raw_cost_per_kg: 1400 },
  { name: 'Фисташка', category: 'nut', raw_cost_per_kg: 1800 },
  { name: 'Курага', category: 'dried_fruit', raw_cost_per_kg: 700 },
  { name: 'Инжир сушёный', category: 'dried_fruit', raw_cost_per_kg: 900 },
  { name: 'Вишня сушёная', category: 'dried_fruit', raw_cost_per_kg: 1000 },
  { name: 'Апельсиновые цукаты', category: 'dried_fruit', raw_cost_per_kg: 600 },
  { name: 'Изюм', category: 'dried_fruit', raw_cost_per_kg: 500 },
];

// Плейсхолдеры по умолчанию для фасовки/упаковки/логистики/маржи —
// тоже правятся через /setcost, ничего не высечено в камне.
const DEFAULT_WEIGHT_G = 200;
const DEFAULT_PACKAGING_COST = 40;
const DEFAULT_LOGISTICS_COST = 30;
const DEFAULT_MARGIN_PCT = 45;
const DEFAULT_STOCK = 20;

function seed() {
  const existing = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  if (existing > 0) {
    console.log(`В базе уже есть ${existing} товаров — пропускаю сид (удалите data/terranuts.db, чтобы пересоздать).`);
    return;
  }

  const insertProduct = db.prepare('INSERT INTO products (name, category) VALUES (?, ?)');
  const insertVariant = db.prepare(`
    INSERT INTO product_variants
      (product_id, weight_g, raw_cost_per_kg, packaging_cost, logistics_cost_per_unit, margin_pct, price, stock_qty, sold_qty)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  const insertAll = db.transaction(() => {
    for (const p of PRODUCTS) {
      const { lastInsertRowid: productId } = insertProduct.run(p.name, p.category);
      const variant = {
        weight_g: DEFAULT_WEIGHT_G,
        raw_cost_per_kg: p.raw_cost_per_kg,
        packaging_cost: DEFAULT_PACKAGING_COST,
        logistics_cost_per_unit: DEFAULT_LOGISTICS_COST,
        margin_pct: DEFAULT_MARGIN_PCT,
      };
      const price = retailPrice(variant);
      insertVariant.run(
        productId,
        variant.weight_g,
        variant.raw_cost_per_kg,
        variant.packaging_cost,
        variant.logistics_cost_per_unit,
        variant.margin_pct,
        price,
        DEFAULT_STOCK
      );
    }
  });

  insertAll();
  console.log(`Добавлено ${PRODUCTS.length} товаров (по одной фасовке ${DEFAULT_WEIGHT_G} г на каждый).`);
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
