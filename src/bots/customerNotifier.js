// Симметрично adminNotifier.js: лёгкий клиент для отправки сообщений клиенту
// из админ-бота. bot.launch() здесь не вызывается — приём апдейтов клиентского
// бота держит только customerBot.js.
const { Telegraf } = require('telegraf');

let bot = null;
function getBot() {
  if (!process.env.CUSTOMER_BOT_TOKEN) return null;
  if (!bot) bot = new Telegraf(process.env.CUSTOMER_BOT_TOKEN);
  return bot;
}

async function notifyOrderApproved(order) {
  const customerBot = getBot();
  if (!customerBot) return;
  await customerBot.telegram.sendMessage(
    order.telegram_chat_id,
    `✅ Ваш заказ №${order.id} подтверждён! Ожидайте доставку — с вами свяжутся по указанному телефону, чтобы согласовать время.`
  );
}

async function notifyOrderRejected(order) {
  const customerBot = getBot();
  if (!customerBot) return;
  await customerBot.telegram.sendMessage(
    order.telegram_chat_id,
    `К сожалению, заказ №${order.id} не может быть выполнен (закончился товар или другая причина). Приносим извинения — напишите /start, чтобы посмотреть, что есть в наличии.`
  );
}

module.exports = { notifyOrderApproved, notifyOrderRejected };
