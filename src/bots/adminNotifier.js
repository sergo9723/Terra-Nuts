// Лёгкий клиент для отправки сообщений в админ-чат из клиентского бота.
// ВАЖНО: этот модуль НЕ вызывает bot.launch() — только отправка сообщений
// через Bot API. Приём апдейтов (long polling) для ADMIN_BOT_TOKEN держит
// только adminBot.js. Двух .launch() с одним токеном быть не должно (конфликт 409).
const { Telegraf, Markup } = require('telegraf');

let bot = null;
function getBot() {
  if (!process.env.ADMIN_BOT_TOKEN) return null;
  if (!bot) bot = new Telegraf(process.env.ADMIN_BOT_TOKEN);
  return bot;
}

async function notifyNewOrder(order) {
  const adminBot = getBot();
  const chatId = process.env.ADMIN_CHAT_ID;
  if (!adminBot || !chatId) {
    console.log('ADMIN_BOT_TOKEN/ADMIN_CHAT_ID не заданы — уведомление о заказе не отправлено.');
    return;
  }

  const lines = order.items.map(
    (i) => `• ${i.product_name} ${i.weight_g} г × ${i.qty} шт = ${i.price_at_order * i.qty} ₽`
  );
  const total = order.items.reduce((sum, i) => sum + i.price_at_order * i.qty, 0);

  const text =
    `🆕 Новая заявка №${order.id}\n\n` +
    `${lines.join('\n')}\n\n` +
    `Итого: ${total} ₽\n\n` +
    `Клиент: ${order.customer_name}\n` +
    `Телефон: ${order.phone}\n` +
    `Адрес: ${order.address}`;

  await adminBot.telegram.sendMessage(
    chatId,
    text,
    Markup.inlineKeyboard([
      Markup.button.callback('✅ Подтвердить', `approve_${order.id}`),
      Markup.button.callback('❌ Отклонить', `reject_${order.id}`),
    ])
  );
}

module.exports = { notifyNewOrder };
