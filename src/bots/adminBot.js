const { Telegraf } = require('telegraf');
const db = require('../db');
const queries = require('../queries');
const { breakdown } = require('../pricing');
const { notifyOrderApproved, notifyOrderRejected } = require('./customerNotifier');

function requireAdmin(ctx, next) {
  const adminChatId = process.env.ADMIN_CHAT_ID;
  if (adminChatId && String(ctx.chat.id) !== String(adminChatId)) {
    ctx.reply('Этот бот только для администратора магазина.');
    return;
  }
  return next();
}

function formatStockLine(v) {
  const low = v.stock_qty <= 3 ? ' ⚠️ мало' : '';
  return `${v.product_name} (${v.weight_g} г): осталось ${v.stock_qty}, продано ${v.sold_qty}${low}`;
}

function launch() {
  const bot = new Telegraf(process.env.ADMIN_BOT_TOKEN);
  bot.use((ctx, next) => requireAdmin(ctx, next));

  bot.start((ctx) => {
    ctx.reply(
      'Админ-панель Terra Nuts.\n\n' +
        'Команды:\n' +
        '/stock — остатки и продажи по всем товарам\n' +
        '/orders — новые (неподтверждённые) заявки\n' +
        '/setcost <id> <сырьё_за_кг> <упаковка> <логистика> <маржа%> — обновить себестоимость и цену товара\n\n' +
        'Новые заявки приходят сюда автоматически, с кнопками подтверждения.'
    );
  });

  bot.command('stock', (ctx) => {
    const rows = db
      .prepare(
        `SELECT pv.*, p.name AS product_name
         FROM product_variants pv JOIN products p ON p.id = pv.product_id
         ORDER BY p.category, p.name`
      )
      .all();
    const text = rows.map(formatStockLine).join('\n');
    ctx.reply(`📦 Остатки:\n\n${text}`);
  });

  bot.command('orders', (ctx) => {
    const newOrders = queries.listOrdersByStatus('new');
    if (newOrders.length === 0) {
      ctx.reply('Новых заявок нет.');
      return;
    }
    for (const o of newOrders) {
      const order = queries.getOrder(o.id);
      const lines = order.items.map((i) => `${i.product_name} × ${i.qty}`).join(', ');
      ctx.reply(
        `Заявка №${order.id}: ${lines}\nКлиент: ${order.customer_name}, ${order.phone}\nАдрес: ${order.address}`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Подтвердить', callback_data: `approve_${order.id}` },
                { text: '❌ Отклонить', callback_data: `reject_${order.id}` },
              ],
            ],
          },
        }
      );
    }
  });

  bot.command('setcost', (ctx) => {
    const parts = ctx.message.text.split(/\s+/).slice(1);
    if (parts.length !== 5) {
      ctx.reply('Использование: /setcost <id_товара> <сырьё_за_кг> <упаковка> <логистика> <маржа%>\nID товара смотрите в /stock.');
      return;
    }
    const [variantId, rawCostPerKg, packagingCost, logisticsCost, marginPct] = parts.map(Number);
    if ([variantId, rawCostPerKg, packagingCost, logisticsCost, marginPct].some(Number.isNaN)) {
      ctx.reply('Все параметры должны быть числами.');
      return;
    }
    const variant = queries.getVariant(variantId);
    if (!variant) {
      ctx.reply(`Товар с id ${variantId} не найден.`);
      return;
    }
    const updated = {
      ...variant,
      raw_cost_per_kg: rawCostPerKg,
      packaging_cost: packagingCost,
      logistics_cost_per_unit: logisticsCost,
      margin_pct: marginPct,
    };
    const b = breakdown(updated);
    db.prepare(
      `UPDATE product_variants
       SET raw_cost_per_kg = ?, packaging_cost = ?, logistics_cost_per_unit = ?, margin_pct = ?, price = ?
       WHERE id = ?`
    ).run(rawCostPerKg, packagingCost, logisticsCost, marginPct, b.retail_price, variantId);
    ctx.reply(
      `Обновлено: ${variant.product_name} (${variant.weight_g} г)\n` +
        `Себестоимость: ${b.cost_price} ₽, цена: ${b.retail_price} ₽, прибыль с единицы: ${b.profit} ₽`
    );
  });

  bot.action(/^approve_(\d+)$/, async (ctx) => {
    const orderId = Number(ctx.match[1]);
    try {
      const order = queries.approveOrder(orderId);
      await ctx.answerCbQuery('Заказ подтверждён');
      await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n✅ ПОДТВЕРЖДЁН`);
      await notifyOrderApproved(order);
    } catch (err) {
      await ctx.answerCbQuery('Ошибка');
      await ctx.reply(`Не удалось подтвердить заказ №${orderId}: ${err.message}`);
    }
  });

  bot.action(/^reject_(\d+)$/, async (ctx) => {
    const orderId = Number(ctx.match[1]);
    const order = queries.rejectOrder(orderId);
    await ctx.answerCbQuery('Заказ отклонён');
    await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n❌ ОТКЛОНЁН`);
    if (order) await notifyOrderRejected(order);
  });

  bot.launch();
  console.log('Админ-бот запущен.');
  return bot;
}

module.exports = { launch };
