const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'terranuts.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('nut', 'dried_fruit')),
    photo_url TEXT
  );

  CREATE TABLE IF NOT EXISTS product_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    weight_g INTEGER NOT NULL,
    raw_cost_per_kg REAL NOT NULL DEFAULT 0,
    packaging_cost REAL NOT NULL DEFAULT 0,
    logistics_cost_per_unit REAL NOT NULL DEFAULT 0,
    margin_pct REAL NOT NULL DEFAULT 40,
    price REAL NOT NULL DEFAULT 0,
    stock_qty INTEGER NOT NULL DEFAULT 0,
    sold_qty INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','approved','rejected','delivered')),
    telegram_chat_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    product_variant_id INTEGER NOT NULL REFERENCES product_variants(id),
    qty INTEGER NOT NULL,
    price_at_order REAL NOT NULL
  );
`);

module.exports = db;
