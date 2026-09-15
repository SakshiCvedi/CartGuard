const express = require('express');
const db = require('../db/connection');

const router = express.Router();

// GET /api/alerts
router.get('/', (req, res) => {
  const { resolved } = req.query;
  let query = `
    SELECT sa.*, p.name as product_name, p.sku, p.stock_quantity, p.low_stock_threshold
    FROM stock_alert sa
    JOIN product p ON p.id = sa.product_id
    WHERE p.store_id = ?
  `;
  const params = [req.storeId];

  if (resolved !== undefined) {
    query += ' AND sa.resolved = ?';
    params.push(resolved === 'true' ? 1 : 0);
  }
  query += ' ORDER BY sa.triggered_at DESC';

  res.json(db.prepare(query).all(...params));
});

// POST /api/alerts/:id/resolve
router.post('/:id/resolve', (req, res) => {
  const alert = db.prepare(`
    SELECT sa.* FROM stock_alert sa JOIN product p ON p.id = sa.product_id
    WHERE sa.id = ? AND p.store_id = ?
  `).get(req.params.id, req.storeId);

  if (!alert) return res.status(404).json({ error: 'Alert not found' });

  db.prepare('UPDATE stock_alert SET resolved = 1 WHERE id = ?').run(alert.id);
  res.json({ success: true });
});

module.exports = router;
