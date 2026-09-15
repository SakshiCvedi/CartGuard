const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const db = require('./db/connection');
const { checkAllProducts } = require('./jobs/stockAlerts');

const DB_FILE = path.join(__dirname, 'db', 'cartguard.db');

// --- Wipe existing tables for a clean, repeatable seed run ---
function resetTables() {
  const tables = ['recovery_email', 'stock_alert', 'order', 'cart_item', 'cart', 'email_template', 'product', 'customer', 'store'];
  db.exec('PRAGMA foreign_keys = OFF;');
  for (const t of tables) {
    db.exec(`DELETE FROM "${t}";`);
  }
  db.exec('PRAGMA foreign_keys = ON;');
}

const PRODUCT_CATALOG = [
  ['Classic Canvas Tote', 'BAG-001', 28],
  ['Recycled Wool Beanie', 'HAT-002', 22],
  ['Ceramic Pour-Over Dripper', 'KIT-010', 34],
  ['Stainless Steel Water Bottle', 'BTL-003', 26],
  ['Linen Throw Blanket', 'HOM-014', 58],
  ['Bamboo Cutting Board', 'KIT-011', 32],
  ['Organic Cotton T-Shirt', 'APP-005', 24],
  ['Leather Card Wallet', 'ACC-007', 40],
  ['Soy Candle - Cedar & Sage', 'HOM-015', 19],
  ['Enamel Camp Mug', 'KIT-012', 16],
  ['Merino Wool Socks (3-pack)', 'APP-006', 21],
  ['Cork Yoga Mat', 'FIT-020', 48],
  ['Travel French Press', 'KIT-013', 30],
  ['Recycled Denim Tote', 'BAG-002', 32],
  ['Handwoven Market Basket', 'HOM-016', 44],
  ['Wooden Desk Organizer', 'OFF-030', 27],
  ['Insulated Lunch Bag', 'KIT-014', 23],
  ['Alpaca Wool Scarf', 'APP-007', 36],
  ['Recycled Rubber Doormat', 'HOM-017', 29],
  ['Stoneware Serving Bowl', 'KIT-015', 38],
  ['Canvas Apron', 'KIT-016', 25],
  ['Hemp Rope Plant Hanger', 'HOM-018', 18],
  ['Sherpa Fleece Pullover', 'APP-008', 52],
  ['Glass Spice Jar Set', 'KIT-017', 21],
  ['Cotton Rope Basket', 'HOM-019', 33],
];

const FIRST_NAMES = ['Amara', 'Liam', 'Priya', 'Noah', 'Sofia', 'Ethan', 'Yuki', 'Maya', 'Diego', 'Fatima', 'Oscar', 'Nina', 'Kwame', 'Lena', 'Theo', 'Zara', 'Marcus', 'Ines', 'Felix', 'Aisha'];
const LAST_NAMES = ['Okafor', 'Chen', 'Sharma', 'Muller', 'Rossi', 'Kim', 'Novak', 'Patel', 'Silva', 'Haddad', 'Larsen', 'Costa', 'Nguyen', 'Weber', 'Diallo'];

function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function isoDaysAgo(days, extraHoursJitter = 12) {
  const ms = Date.now() - days * 24 * 60 * 60 * 1000 - randomInt(0, extraHoursJitter) * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

function seed() {
  resetTables();

  // --- Store + owner login ---
  const ownerEmail = 'demo@cartguard.dev';
  const passwordHash = bcrypt.hashSync('demo1234', 10);
  const storeId = db.prepare(`
    INSERT INTO store (name, owner_email, password_hash) VALUES (?, ?, ?)
  `).run('Wayfare Goods Co.', ownerEmail, passwordHash).lastInsertRowid;

  // --- Email templates (sequence step 1 = immediate, step 2 = 24h later w/ discount) ---
  db.prepare(`
    INSERT INTO email_template (store_id, sequence_step, name, subject, body) VALUES (?, 1, ?, ?, ?)
  `).run(
    storeId,
    'Cart Reminder',
    'You left something in your cart, {{customer_name}}',
    `Hi {{customer_name}},\n\nYou left these in your cart: {{cart_items}}.\n\nYour cart is saved and ready whenever you are - just head back to checkout when you're ready.\n\n— Wayfare Goods Co.`
  );
  db.prepare(`
    INSERT INTO email_template (store_id, sequence_step, name, subject, body) VALUES (?, 2, ?, ?, ?)
  `).run(
    storeId,
    'Discount Follow-up',
    "Still thinking it over? Here's 10% off, {{customer_name}}",
    `Hi {{customer_name}},\n\nYour cart is still waiting: {{cart_items}}.\n\nUse code {{discount_code}} for 10% off if you check out in the next 48 hours.\n\n— Wayfare Goods Co.`
  );

  // --- Products ---
  const insertProduct = db.prepare(`
    INSERT INTO product (store_id, name, sku, price, stock_quantity, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const productIds = PRODUCT_CATALOG.map(([name, sku, price]) => {
    // Mix of healthy stock, borderline, and a few deliberately low for demo purposes
    const stockRoll = Math.random();
    let stock;
    if (stockRoll < 0.15) stock = randomInt(0, 4); // deliberately low
    else if (stockRoll < 0.3) stock = randomInt(5, 12); // borderline
    else stock = randomInt(20, 90); // healthy

    const threshold = randomInt(5, 10);
    return insertProduct.run(storeId, name, sku, price, stock, threshold).lastInsertRowid;
  });

  // --- Customers ---
  const insertCustomer = db.prepare('INSERT INTO customer (email, name) VALUES (?, ?)');
  const customerIds = [];
  for (let i = 0; i < 40; i++) {
    const first = randomChoice(FIRST_NAMES);
    const last = randomChoice(LAST_NAMES);
    const email = `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`;
    customerIds.push(insertCustomer.run(email, `${first} ${last}`).lastInsertRowid);
  }

  const insertCart = db.prepare(`INSERT INTO cart (customer_id, store_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`);
  const insertCartItem = db.prepare(`INSERT INTO cart_item (cart_id, product_id, quantity, price_at_time) VALUES (?, ?, ?, ?)`);
  const insertOrder = db.prepare(`INSERT INTO "order" (cart_id, total, status, created_at) VALUES (?, ?, 'completed', ?)`);
  const insertRecoveryEmail = db.prepare(`
    INSERT INTO recovery_email (cart_id, sequence_step, subject, body, sent_at, opened, clicked, recovered) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  function buildCartItems(cartId, createdAtIso) {
    const itemCount = randomInt(1, 4);
    const chosenProductIdxs = new Set();
    while (chosenProductIdxs.size < itemCount) chosenProductIdxs.add(randomInt(0, PRODUCT_CATALOG.length - 1));

    let total = 0;
    for (const idx of chosenProductIdxs) {
      const qty = randomInt(1, 3);
      const price = PRODUCT_CATALOG[idx][2];
      insertCartItem.run(cartId, productIds[idx], qty, price);
      total += qty * price;
    }
    return total;
  }

  // --- Historical carts over the last 14 days: mix of completed, abandoned, recovered ---
  for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
    const cartsToday = randomInt(3, 8);
    for (let j = 0; j < cartsToday; j++) {
      const customerId = randomChoice(customerIds);
      const createdAt = isoDaysAgo(dayOffset);
      const outcomeRoll = Math.random();

      if (outcomeRoll < 0.45) {
        // straight-through completed purchase, no abandonment
        const cartId = insertCart.run(customerId, storeId, 'completed', createdAt, createdAt).lastInsertRowid;
        const total = buildCartItems(cartId, createdAt);
        insertOrder.run(cartId, total, createdAt);
      } else if (outcomeRoll < 0.75) {
        // abandoned, never recovered
        const cartId = insertCart.run(customerId, storeId, 'abandoned', createdAt, createdAt).lastInsertRowid;
        buildCartItems(cartId, createdAt);
        insertRecoveryEmail.run(cartId, 1, 'You left something in your cart', 'Reminder email body', createdAt, randomInt(0, 1), 0, 0);
      } else {
        // abandoned then recovered
        const cartId = insertCart.run(customerId, storeId, 'recovered', createdAt, createdAt).lastInsertRowid;
        const total = buildCartItems(cartId, createdAt);
        insertRecoveryEmail.run(cartId, 1, 'You left something in your cart', 'Reminder email body', createdAt, 1, 1, 1);
        insertOrder.run(cartId, total, createdAt);
      }
    }
  }

  // --- A few LIVE active carts (not yet stale enough to be abandoned) ---
  for (let i = 0; i < 5; i++) {
    const customerId = randomChoice(customerIds);
    const recentIso = new Date(Date.now() - randomInt(1, 10) * 60 * 1000).toISOString(); // 1-10 min ago
    const cartId = insertCart.run(customerId, storeId, 'active', recentIso, recentIso).lastInsertRowid;
    buildCartItems(cartId, recentIso);
  }

  // --- One cart already stale enough to be picked up by the abandoned-cart job on first run ---
  {
    const customerId = randomChoice(customerIds);
    const staleIso = new Date(Date.now() - 40 * 60 * 1000).toISOString();
    const cartId = insertCart.run(customerId, storeId, 'active', staleIso, staleIso).lastInsertRowid;
    buildCartItems(cartId, staleIso);
  }

  // Run the stock-alert check once immediately so the dashboard isn't empty on first load.
  checkAllProducts();

  console.log('✅ Seed complete.');
  console.log(`   Store: Wayfare Goods Co.`);
  console.log(`   Login: ${ownerEmail} / demo1234`);
  console.log(`   Products: ${PRODUCT_CATALOG.length}, Customers: ${customerIds.length}`);
  console.log(`   DB file: ${DB_FILE}`);
}

seed();
