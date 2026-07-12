// Печатает подробную раскладку себестоимости и цены по каждому товару.
// Запуск: npm run pricing
const db = require('./db');
const { breakdown } = require('./pricing');

const rows = db
  .prepare(
    `SELECT pv.*, p.name AS product_name, p.category AS product_category
     FROM product_variants pv JOIN products p ON p.id = pv.product_id
     ORDER BY p.category, p.name`
  )
  .all();

console.log(
  'Товар'.padEnd(24),
  'Фасовка'.padEnd(9),
  'Сырьё'.padEnd(8),
  'Упак.'.padEnd(7),
  'Логист.'.padEnd(9),
  'Себест.'.padEnd(9),
  'Маржа'.padEnd(7),
  'Цена'.padEnd(7),
  'Прибыль'
);

for (const v of rows) {
  const b = breakdown(v);
  console.log(
    v.product_name.padEnd(24),
    `${b.weight_g} г`.padEnd(9),
    String(b.raw_cost).padEnd(8),
    String(b.packaging_cost).padEnd(7),
    String(b.logistics_cost).padEnd(9),
    String(b.cost_price).padEnd(9),
    `${b.margin_pct}%`.padEnd(7),
    String(b.retail_price).padEnd(7),
    b.profit
  );
}

console.log('\nЧтобы изменить себестоимость/маржу товара — используйте команду /setcost в админ-боте.');
