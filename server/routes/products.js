const express = require('express');
const db = require('../db/connection');
const { getVelocityPerDay, getSuggestedReorderQty, getDaysUntilStockout } = require('../services/velocity');

const router = express.Router();

// GET /api/products
router.get('/', (req, res) => {
  const products = db.prepare('SELECT * FROM product WHERE store_id = ? ORDER BY name ASC').all(req.storeId);

  const enriched = products.map((p) => {
    const velocity = getVelocityPerDay(p.id);
    const daysUntilStockout = getDaysUntilStockout(p.stock_quantity, velocity);
    const activeAlert = db.prepare('SELECT id FROM stock_alert WHERE product_id = ? AND resolved = 0 ORDER BY triggered_at DESC LIMIT 1').get(p.id);

    return {
      ...p,
      velocity_per_day: Math.round(velocity * 100) / 100,
      days_until_stockout: Number.isFinite(daysUntilStockout) ? Math.round(daysUntilStockout * 10) / 10 : null,
      suggested_reorder_qty: getSuggestedReorderQty(velocity),
      has_active_alert: !!activeAlert,
    };
  });

  res.json(enriched);
});

// POST /api/products/simulate/low-stock - demo helper: drops a real product's stock
// below its threshold so the next stock-alert job run (within a minute) raises a
// genuine alert - same "seed the condition, let the real job pick it up" pattern
// as the abandoned-cart simulate button.
router.post('/simulate/low-stock', (req, res) => {
  const storeId = req.storeId;

  // Prefer a product that isn't already flagged, so each click demos a fresh alert
  // instead of just re-triggering the same one.
  let product = db.prepare(`
    SELECT p.* FROM product p
    WHERE p.store_id = ?
      AND NOT EXISTS (SELECT 1 FROM stock_alert sa WHERE sa.product_id = p.id AND sa.resolved = 0)
    ORDER BY RANDOM() LIMIT 1
  `).get(storeId);

  // Every product already flagged? Fall back to any product for this store.
  if (!product) {
    product = db.prepare(`SELECT * FROM product WHERE store_id = ? ORDER BY RANDOM() LIMIT 1`).get(storeId);
  }

  if (!product) {
    return res.status(400).json({ error: 'No products found. Run the seed script first.' });
  }

  const newStock = Math.max(0, product.low_stock_threshold - 2);
  db.prepare('UPDATE product SET stock_quantity = ? WHERE id = ?').run(newStock, product.id);

  res.json({
    success: true,
    productId: product.id,
    productName: product.name,
    newStock,
    threshold: product.low_stock_threshold,
    message: `"${product.name}" stock dropped to ${newStock} (threshold is ${product.low_stock_threshold}). The next stock-alert job run will raise the alert (jobs run every minute).`,
  });
});

module.exports = router;
