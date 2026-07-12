require('dotenv').config();
const path = require('path');
const express = require('express');
const createSiteRouter = require('./routes/site');

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
