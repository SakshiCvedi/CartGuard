const db = require('../db/connection');
const config = require('../config');

/**
 * Simple recent-average sales velocity: units sold per day over the lookback
 * window, based on completed orders. Deliberately not a forecasting model -
 * easy to explain to a non-technical client as "how fast has this been selling lately".
 */
function getVelocityPerDay(productId, lookbackDays = config.VELOCITY_LOOKBACK_DAYS) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(ci.quantity), 0) as units_sold
    FROM cart_item ci
    JOIN cart c ON c.id = ci.cart_id
    JOIN "order" o ON o.cart_id = c.id
    WHERE ci.product_id = ?
      AND o.created_at >= datetime('now', ?)
  `).get(productId, `-${lookbackDays} days`);

  const unitsSold = row ? row.units_sold : 0;
  return unitsSold / lookbackDays;
}

/**
 * Suggested reorder quantity = velocity * lead time, with a small floor so
 * a slow-moving product still gets a sane minimum suggestion.
 */
function getSuggestedReorderQty(velocityPerDay, leadTimeDays = config.REORDER_LEAD_TIME_DAYS) {
  const raw = velocityPerDay * leadTimeDays;
  return Math.max(Math.ceil(raw), velocityPerDay > 0 ? 5 : 0);
}

/**
 * Days until stockout at current velocity. Returns Infinity if velocity is 0
 * (nothing selling, so no projected stockout date).
 */
function getDaysUntilStockout(stockQuantity, velocityPerDay) {
  if (velocityPerDay <= 0) return Infinity;
  return stockQuantity / velocityPerDay;
}

module.exports = { getVelocityPerDay, getSuggestedReorderQty, getDaysUntilStockout };
