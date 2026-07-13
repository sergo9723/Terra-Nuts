require('dotenv').config();
const path = require('path');
const express = require('express');
const createSiteRouter = require('./routes/site');

// Страховка: сайт и оба бота держат заказы и деньги реального бизнеса,
// поэтому один неучтённый сбой (например, недоступность Telegram API) не
// должен ронять весь процесс. Каждая точка, где такое реально может
// произойти, уже обёрнута в try/catch в бот-хендлерах; это — запасной слой.
process.on('unhandledRejection', (err) => {
  console.error('Необработанная ошибка (процесс продолжает работу):', err);
});
process.on('uncaughtException', (err) => {
  console.error('Необработанное исключение (процесс продолжает работу):', err);
});

require('./seed').seed();

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/', createSiteRouter());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сайт Terra Nuts запущен: http://localhost:${PORT}`);
});

if (process.env.CUSTOMER_BOT_TOKEN) {
  require('./bots/customerBot').launch();
} else {
  console.log('CUSTOMER_BOT_TOKEN не задан — клиентский бот не запущен (см. .env.example).');
}

if (process.env.ADMIN_BOT_TOKEN) {
  require('./bots/adminBot').launch();
} else {
  console.log('ADMIN_BOT_TOKEN не задан — админ-бот не запущен (см. .env.example).');
}
