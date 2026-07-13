const { Telegraf, Markup } = require('telegraf');
const queries = require('../queries');
const { notifyNewOrder } = require('./adminNotifier');

// Простая машина состояний в памяти: chatId -> { step, variantId, qty, name, phone, address }
// Для одного продавца и умеренного потока заявок этого достаточно; если бизнес
// вырастет и понадобится несколько инстансов сервера — состояние стоит перенести в БД.
const sessions = new Map();

function variantLabel(v) {
  return `${v.product_name}, ${v.weight_g} г — ${v.price} ₽ (в наличии: ${v.stock_qty})`;
}

function productListKeyboard() {
  const products = queries.listProductsWithVariants();
  const buttons = [];
  for (const cat of ['nut', 'dried_fruit']) {
    for (const p of products.filter((x) => x.category === cat)) {
      const v = p.variants[0];
      if (!v || v.stock_qty <= 0) continue;
      buttons.push([Markup.button.callback(`${p.name} — ${v.price} ₽`, `pick_${v.id}`)]);
    }
  }
  return Markup.inlineKeyboard(buttons);
}

function startOrder(ctx, variantId) {
  const variant = queries.getVariant(variantId);
  if (!variant || variant.stock_qty <= 0) {
    ctx.reply('Этот товар сейчас закончился. Посмотрите, что есть в наличии: /start');
    return;
  }
  sessions.set(ctx.chat.id, { step: 'qty', variantId: variant.id });
  ctx.reply(
    `${variantLabel(variant)}\n\nСколько упаковок хотите заказать? Введите число.`
  );
}

function launch() {
  const bot = new Telegraf(process.env.CUSTOMER_BOT_TOKEN);

  bot.start((ctx) => {
    const payload = ctx.startPayload; // напр. "order_3" из диплинка сайта
    const match = /^order_(\d+)$/.exec(payload || '');
    if (match) {
      startOrder(ctx, Number(match[1]));
      return;
    }
    sessions.delete(ctx.chat.id);
    ctx.reply(
      'Добро пожаловать в Terra Nuts! Выберите товар:',
      productListKeyboard()
    );
  });

  bot.action(/^pick_(\d+)$/, (ctx) => {
    ctx.answerCbQuery();
    startOrder(ctx, Number(ctx.match[1]));
  });

  bot.action(/^confirm_yes$/, async (ctx) => {
    ctx.answerCbQuery();
    const session = sessions.get(ctx.chat.id);
    if (!session || session.step !== 'confirm') return;

    const variant = queries.getVariant(session.variantId);
    if (!variant || variant.stock_qty < session.qty) {
      ctx.reply('К сожалению, за это время товара стало меньше в наличии. Начните заново: /start');
      sessions.delete(ctx.chat.id);
      return;
    }

    const orderId = queries.createOrder({
      customerName: session.name,
      phone: session.phone,
      address: session.address,
      telegramChatId: String(ctx.chat.id),
      items: [{ variantId: variant.id, qty: session.qty, price: variant.price }],
    });

    sessions.delete(ctx.chat.id);
    await ctx.reply(
      `Спасибо! Ваша заявка №${orderId} принята.\n` +
        'Мы свяжемся с вами после подтверждения менеджером — обычно это занимает немного времени.'
    );

    // Заказ уже сохранён в БД к этому моменту — даже если уведомление админу
    // не дойдёт (неверный ADMIN_CHAT_ID, сеть и т.п.), заявка не потеряется,
    // и сервер не должен из-за этого падать. /orders в админ-боте всё равно
    // покажет её.
    try {
      await notifyNewOrder(queries.getOrder(orderId));
    } catch (err) {
      console.error(`Не удалось уведомить админа о заказе №${orderId}:`, err.message);
    }
  });

  bot.action('confirm_no', (ctx) => {
    ctx.answerCbQuery();
    sessions.delete(ctx.chat.id);
    ctx.reply('Заказ отменён. Чтобы начать заново — /start');
  });

  bot.on('text', (ctx) => {
    const session = sessions.get(ctx.chat.id);
    if (!session) {
      ctx.reply('Чтобы выбрать товар, напишите /start');
      return;
    }
    const text = ctx.message.text.trim();

    if (session.step === 'qty') {
      const qty = Number(text);
      const variant = queries.getVariant(session.variantId);
      if (!Number.isInteger(qty) || qty <= 0) {
        ctx.reply('Введите целое число упаковок, например: 1');
        return;
      }
      if (!variant || qty > variant.stock_qty) {
        ctx.reply(`Столько нет в наличии. Сейчас доступно: ${variant ? variant.stock_qty : 0}. Введите число ещё раз.`);
        return;
      }
      session.qty = qty;
      session.step = 'name';
      ctx.reply('Как к вам обращаться? Введите имя.');
      return;
    }

    if (session.step === 'name') {
      if (text.length < 2) {
        ctx.reply('Введите, пожалуйста, имя.');
        return;
      }
      session.name = text;
      session.step = 'phone';
      ctx.reply('Укажите номер телефона для связи.');
      return;
    }

    if (session.step === 'phone') {
      const digits = text.replace(/\D/g, '');
      if (digits.length < 7) {
        ctx.reply('Похоже на неполный номер. Введите телефон ещё раз.');
        return;
      }
      session.phone = text;
      session.step = 'address';
      ctx.reply('Укажите адрес доставки (город, улица, дом, квартира).');
      return;
    }

    if (session.step === 'address') {
      if (text.length < 5) {
        ctx.reply('Введите, пожалуйста, полный адрес доставки.');
        return;
      }
      session.address = text;
      session.step = 'confirm';
      const variant = queries.getVariant(session.variantId);
      const total = variant.price * session.qty;
      ctx.reply(
        'Проверьте заказ:\n\n' +
          `Товар: ${variant.product_name}, ${variant.weight_g} г × ${session.qty}\n` +
          `Сумма: ${total} ₽ (оплата наличными/картой курьеру)\n` +
          `Имя: ${session.name}\n` +
          `Телефон: ${session.phone}\n` +
          `Адрес: ${session.address}\n\n` +
          'Всё верно?',
        Markup.inlineKeyboard([
          Markup.button.callback('✅ Подтвердить заказ', 'confirm_yes'),
          Markup.button.callback('✖️ Отменить', 'confirm_no'),
        ])
      );
    }
  });

  bot.launch();
  console.log('Клиентский бот запущен.');
  return bot;
}

module.exports = { launch };
