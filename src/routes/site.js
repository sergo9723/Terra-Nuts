const express = require('express');
const queries = require('../queries');

const CATEGORY_LABELS = { nut: 'Орехи', dried_fruit: 'Сухофрукты' };

function buildOrderLink(botUsername, variantId) {
  if (!botUsername) return null;
  return `https://t.me/${botUsername}?start=order_${variantId}`;
}

function createSiteRouter() {
  const router = express.Router();
  const botUsername = process.env.CUSTOMER_BOT_USERNAME || '';

  router.get('/', (req, res) => {
    const products = queries.listProductsWithVariants();
    const grouped = { nut: [], dried_fruit: [] };
    for (const p of products) {
      const variant = p.variants[0]; // MVP: одна фасовка на товар
      if (!variant) continue;
      grouped[p.category].push({
        id: p.id,
        name: p.name,
        weight_g: variant.weight_g,
        price: variant.price,
        stock_qty: variant.stock_qty,
        orderLink: buildOrderLink(botUsername, variant.id),
      });
    }
    res.render('index', {
      categoryLabels: CATEGORY_LABELS,
      grouped,
      botConfigured: Boolean(botUsername),
    });
  });

  // Живые остатки — сайт может опрашивать этот эндпоинт, чтобы обновлять
  // цифры без перезагрузки страницы.
  router.get('/api/stock', (req, res) => {
    const products = queries.listProductsWithVariants();
    const stock = {};
    for (const p of products) {
      const variant = p.variants[0];
      if (variant) stock[variant.id] = variant.stock_qty;
    }
    res.json(stock);
  });

  return router;
}

module.exports = createSiteRouter;
