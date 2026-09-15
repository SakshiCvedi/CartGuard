const express = require('express');
const db = require('../db/connection');

const router = express.Router();

// GET /api/metrics/overview
router.get('/overview', (req, res) => {
  const storeId = req.storeId;

  const abandonedThisWeek = db.prepare(`
    SELECT COUNT(*) as n FROM cart
    WHERE store_id = ? AND status IN ('abandoned', 'recovered')
      AND updated_at >= datetime('now', '-7 days')
  `).get(storeId).n;

  const recoveredThisWeek = db.prepare(`
    SELECT COUNT(*) as n FROM cart
    WHERE store_id = ? AND status = 'recovered'
      AND updated_at >= datetime('now', '-7 days')
  `).get(storeId).n;

  const recoveryRate = abandonedThisWeek > 0 ? Math.round((recoveredThisWeek / abandonedThisWeek) * 1000) / 10 : 0;

  const revenueRecovered = db.prepare(`
    SELECT COALESCE(SUM(o.total), 0) as total
    FROM "order" o
    JOIN cart c ON c.id = o.cart_id
    WHERE c.store_id = ? AND c.status = 'recovered' AND o.created_at >= datetime('now', '-7 days')
  `).get(storeId).total;

  const activeLowStockAlerts = db.prepare(`
    SELECT COUNT(*) as n FROM stock_alert sa
    JOIN product p ON p.id = sa.product_id
    WHERE p.store_id = ? AND sa.resolved = 0
  `).get(storeId).n;

  // 14-day trend: abandoned vs recovered, bucketed by day
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const dayStart = `-${i} days`;
    const label = db.prepare(`SELECT date('now', ?) as d`).get(dayStart).d;

    const abandoned = db.prepare(`
      SELECT COUNT(*) as n FROM cart
      WHERE store_id = ? AND date(updated_at) = ? AND status IN ('abandoned', 'recovered')
    `).get(storeId, label).n;

    const recovered = db.prepare(`
      SELECT COUNT(*) as n FROM cart
      WHERE store_id = ? AND date(updated_at) = ? AND status = 'recovered'
    `).get(storeId, label).n;

    days.push({ date: label, abandoned, recovered });
  }

  const recentAbandoned = db.prepare(`
    SELECT c.id, c.status, c.updated_at, cu.name as customer_name, cu.email as customer_email,
      (SELECT COALESCE(SUM(ci.quantity * ci.price_at_time), 0) FROM cart_item ci WHERE ci.cart_id = c.id) as cart_value,
      (SELECT COUNT(*) FROM cart_item ci WHERE ci.cart_id = c.id) as item_count
    FROM cart c JOIN customer cu ON cu.id = c.customer_id
    WHERE c.store_id = ? AND c.status IN ('abandoned', 'recovered')
    ORDER BY c.updated_at DESC
    LIMIT 10
  `).all(storeId);

  res.json({
    abandonedThisWeek,
    recoveredThisWeek,
    recoveryRate,
    revenueRecovered,
    activeLowStockAlerts,
    trend: days,
    recentAbandoned,
  });
});

module.exports = router;
