const express = require('express');
const db = require('../db/connection');

const router = express.Router();

// GET /api/carts?status=abandoned
router.get('/', (req, res) => {
  const { status } = req.query;
  const storeId = req.storeId;

  let carts;
  if (status) {
    carts = db.prepare(`
      SELECT c.*, cu.name as customer_name, cu.email as customer_email,
        (SELECT COALESCE(SUM(ci.quantity * ci.price_at_time), 0) FROM cart_item ci WHERE ci.cart_id = c.id) as cart_value,
        (SELECT COUNT(*) FROM cart_item ci WHERE ci.cart_id = c.id) as item_count
      FROM cart c
      JOIN customer cu ON cu.id = c.customer_id
      WHERE c.store_id = ? AND c.status = ?
      ORDER BY c.updated_at DESC
    `).all(storeId, status);
  } else {
    carts = db.prepare(`
      SELECT c.*, cu.name as customer_name, cu.email as customer_email,
        (SELECT COALESCE(SUM(ci.quantity * ci.price_at_time), 0) FROM cart_item ci WHERE ci.cart_id = c.id) as cart_value,
        (SELECT COUNT(*) FROM cart_item ci WHERE ci.cart_id = c.id) as item_count
      FROM cart c
      JOIN customer cu ON cu.id = c.customer_id
      WHERE c.store_id = ?
      ORDER BY c.updated_at DESC
    `).all(storeId);
  }

  res.json(carts);
});

// GET /api/carts/:id
router.get('/:id', (req, res) => {
  const cart = db.prepare(`
    SELECT c.*, cu.name as customer_name, cu.email as customer_email
    FROM cart c JOIN customer cu ON cu.id = c.customer_id
    WHERE c.id = ? AND c.store_id = ?
  `).get(req.params.id, req.storeId);

  if (!cart) return res.status(404).json({ error: 'Cart not found' });

  const items = db.prepare(`
    SELECT ci.*, p.name as product_name, p.sku
    FROM cart_item ci JOIN product p ON p.id = ci.product_id
    WHERE ci.cart_id = ?
  `).all(cart.id);

  const emails = db.prepare(`
    SELECT * FROM recovery_email WHERE cart_id = ? ORDER BY sent_at ASC
  `).all(cart.id);

  const order = db.prepare(`SELECT * FROM "order" WHERE cart_id = ?`).get(cart.id);

  res.json({ ...cart, items, emails, order: order || null });
});

// POST /api/carts/:id/recover  (manual "mark as recovered")
router.post('/:id/recover', (req, res) => {
  const cart = db.prepare('SELECT * FROM cart WHERE id = ? AND store_id = ?').get(req.params.id, req.storeId);
  if (!cart) return res.status(404).json({ error: 'Cart not found' });

  const now = new Date().toISOString();
  const items = db.prepare('SELECT * FROM cart_item WHERE cart_id = ?').all(cart.id);
  const total = items.reduce((sum, i) => sum + i.quantity * i.price_at_time, 0);

  db.prepare(`UPDATE cart SET status = 'recovered', updated_at = ? WHERE id = ?`).run(now, cart.id);
  db.prepare(`INSERT INTO "order" (cart_id, total, status, created_at) VALUES (?, ?, 'completed', ?)`)
    .run(cart.id, total, now);
  db.prepare(`UPDATE recovery_email SET recovered = 1 WHERE cart_id = ?`).run(cart.id);

  res.json({ success: true, cartId: cart.id, total });
});

// POST /api/carts/:id/emails/:emailId/toggle  (mark opened/clicked - simulated tracking)
router.post('/:id/emails/:emailId/toggle', (req, res) => {
  const { field } = req.body; // 'opened' | 'clicked'
  if (!['opened', 'clicked'].includes(field)) {
    return res.status(400).json({ error: 'field must be "opened" or "clicked"' });
  }
  const email = db.prepare(`
    SELECT re.* FROM recovery_email re
    JOIN cart c ON c.id = re.cart_id
    WHERE re.id = ? AND re.cart_id = ? AND c.store_id = ?
  `).get(req.params.emailId, req.params.id, req.storeId);
  if (!email) return res.status(404).json({ error: 'Email not found' });

  const newValue = email[field] ? 0 : 1;
  db.prepare(`UPDATE recovery_email SET ${field} = ? WHERE id = ?`).run(newValue, email.id);
  res.json({ success: true, [field]: !!newValue });
});

// POST /api/carts/simulate/abandoned - demo helper: creates a fresh cart that
// is immediately old enough to be picked up as abandoned by the next job run.
router.post('/simulate/abandoned', (req, res) => {
  const storeId = req.storeId;
  const customers = db.prepare('SELECT id FROM customer').all();
  const products = db.prepare('SELECT * FROM product WHERE store_id = ? AND stock_quantity > 0').all(storeId);

  if (customers.length === 0 || products.length === 0) {
    return res.status(400).json({ error: 'No seed customers/products available. Run the seed script first.' });
  }

  const customer = customers[Math.floor(Math.random() * customers.length)];
  const staleTimestamp = new Date(Date.now() - 45 * 60 * 1000).toISOString(); // 45 min ago

  const cartId = db.prepare(`
    INSERT INTO cart (customer_id, store_id, status, created_at, updated_at)
    VALUES (?, ?, 'active', ?, ?)
  `).run(customer.id, storeId, staleTimestamp, staleTimestamp).lastInsertRowid;

  const itemCount = 1 + Math.floor(Math.random() * 3);
  const chosen = [...products].sort(() => 0.5 - Math.random()).slice(0, itemCount);
  chosen.forEach((p) => {
    const qty = 1 + Math.floor(Math.random() * 2);
    db.prepare(`INSERT INTO cart_item (cart_id, product_id, quantity, price_at_time) VALUES (?, ?, ?, ?)`)
      .run(cartId, p.id, qty, p.price);
  });

  res.json({ success: true, cartId, message: 'Cart created and backdated - the next abandoned-cart job run will pick it up (jobs run every minute).' });
});

// POST /api/carts/simulate/purchase - demo helper: creates a cart that goes
// straight to a completed order (no abandonment).
router.post('/simulate/purchase', (req, res) => {
  const storeId = req.storeId;
  const customers = db.prepare('SELECT id FROM customer').all();
  const products = db.prepare('SELECT * FROM product WHERE store_id = ? AND stock_quantity > 0').all(storeId);

  if (customers.length === 0 || products.length === 0) {
    return res.status(400).json({ error: 'No seed customers/products available. Run the seed script first.' });
  }

  const customer = customers[Math.floor(Math.random() * customers.length)];
  const now = new Date().toISOString();

  const cartId = db.prepare(`
    INSERT INTO cart (customer_id, store_id, status, created_at, updated_at)
    VALUES (?, ?, 'completed', ?, ?)
  `).run(customer.id, storeId, now, now).lastInsertRowid;

  const itemCount = 1 + Math.floor(Math.random() * 3);
  const chosen = [...products].sort(() => 0.5 - Math.random()).slice(0, itemCount);
  let total = 0;
  chosen.forEach((p) => {
    const qty = 1 + Math.floor(Math.random() * 2);
    total += qty * p.price;
    db.prepare(`INSERT INTO cart_item (cart_id, product_id, quantity, price_at_time) VALUES (?, ?, ?, ?)`)
      .run(cartId, p.id, qty, p.price);
    db.prepare(`UPDATE product SET stock_quantity = MAX(stock_quantity - ?, 0) WHERE id = ?`).run(qty, p.id);
  });

  db.prepare(`INSERT INTO "order" (cart_id, total, status, created_at) VALUES (?, ?, 'completed', ?)`)
    .run(cartId, total, now);

  res.json({ success: true, cartId, total, message: 'Purchase simulated and stock decremented.' });
});

module.exports = router;
