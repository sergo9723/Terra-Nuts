const db = require('./db');

function listProductsWithVariants() {
  const products = db.prepare('SELECT * FROM products ORDER BY category, name').all();
  const variantsStmt = db.prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY weight_g');
  return products.map((p) => ({ ...p, variants: variantsStmt.all(p.id) }));
}

function getVariant(variantId) {
  return db
    .prepare(
      `SELECT pv.*, p.name AS product_name, p.category AS product_category
       FROM product_variants pv JOIN products p ON p.id = pv.product_id
       WHERE pv.id = ?`
    )
    .get(variantId);
}

function createOrder({ customerName, phone, address, telegramChatId, items }) {
  const insertOrder = db.prepare(
    `INSERT INTO orders (customer_name, phone, address, telegram_chat_id) VALUES (?, ?, ?, ?)`
  );
  const insertItem = db.prepare(
    `INSERT INTO order_items (order_id, product_variant_id, qty, price_at_order) VALUES (?, ?, ?, ?)`
  );

  const run = db.transaction(() => {
    const { lastInsertRowid: orderId } = insertOrder.run(customerName, phone, address, telegramChatId);
    for (const item of items) {
      insertItem.run(orderId, item.variantId, item.qty, item.price);
    }
    return orderId;
  });

  return run();
}

function getOrder(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return null;
  const items = db
    .prepare(
      `SELECT oi.*, p.name AS product_name, pv.weight_g
       FROM order_items oi
       JOIN product_variants pv ON pv.id = oi.product_variant_id
       JOIN products p ON p.id = pv.product_id
       WHERE oi.order_id = ?`
    )
    .all(orderId);
  return { ...order, items };
}

function listOrdersByStatus(status) {
  return db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY created_at').all(status);
}

/** Подтвердить заказ: списать остаток по каждой позиции, увеличить sold_qty. Атомарно. */
function approveOrder(orderId) {
  const order = getOrder(orderId);
  if (!order) throw new Error(`Заказ ${orderId} не найден`);
  if (order.status !== 'new') throw new Error(`Заказ ${orderId} уже обработан (статус: ${order.status})`);

  const decrementStock = db.prepare(
    `UPDATE product_variants SET stock_qty = stock_qty - ?, sold_qty = sold_qty + ? WHERE id = ? AND stock_qty >= ?`
  );
  const setStatus = db.prepare(`UPDATE orders SET status = 'approved' WHERE id = ?`);

  const run = db.transaction(() => {
    for (const item of order.items) {
      const result = decrementStock.run(item.qty, item.qty, item.product_variant_id, item.qty);
      if (result.changes === 0) {
        throw new Error(`Недостаточно остатка для позиции "${item.product_name}" (заказ ${orderId})`);
      }
    }
    setStatus.run(orderId);
  });

  run();
  return getOrder(orderId);
}

function rejectOrder(orderId) {
  db.prepare(`UPDATE orders SET status = 'rejected' WHERE id = ? AND status = 'new'`).run(orderId);
  return getOrder(orderId);
}

module.exports = {
  listProductsWithVariants,
  getVariant,
  createOrder,
  getOrder,
  listOrdersByStatus,
  approveOrder,
  rejectOrder,
};
