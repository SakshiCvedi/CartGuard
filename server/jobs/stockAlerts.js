const cron = require('node-cron');
const db = require('../db/connection');
const config = require('../config');
const { getVelocityPerDay, getSuggestedReorderQty, getDaysUntilStockout } = require('../services/velocity');

function checkAllProducts() {
  const products = db.prepare('SELECT * FROM product').all();

  for (const product of products) {
    const velocity = getVelocityPerDay(product.id);
    const daysUntilStockout = getDaysUntilStockout(product.stock_quantity, velocity);

    const isLow = product.stock_quantity <= product.low_stock_threshold;
    const projectedToRunOut = Number.isFinite(daysUntilStockout) && daysUntilStockout <= config.STOCKOUT_PROJECTION_DAYS;

    const existingActiveAlert = db.prepare(`
      SELECT * FROM stock_alert WHERE product_id = ? AND resolved = 0
    `).get(product.id);

    if ((isLow || projectedToRunOut) && !existingActiveAlert) {
      const suggestedQty = getSuggestedReorderQty(velocity);
      db.prepare(`
        INSERT INTO stock_alert (product_id, triggered_at, velocity_per_day, days_until_stockout, suggested_reorder_qty, resolved)
        VALUES (?, ?, ?, ?, ?, 0)
      `).run(
        product.id,
        new Date().toISOString(),
        velocity,
        Number.isFinite(daysUntilStockout) ? daysUntilStockout : null,
        suggestedQty
      );
      console.log(`[stock-alert-job] Alert raised for "${product.name}" (stock: ${product.stock_quantity}, velocity: ${velocity.toFixed(2)}/day, suggested reorder: ${suggestedQty})`);
    }

    // Auto-resolve if restocked comfortably above threshold and not close to stockout
    if (existingActiveAlert && !isLow && !projectedToRunOut) {
      db.prepare('UPDATE stock_alert SET resolved = 1 WHERE id = ?').run(existingActiveAlert.id);
      console.log(`[stock-alert-job] Auto-resolved alert for "${product.name}" — stock replenished.`);
    }
  }
}

function startStockAlertJob() {
  cron.schedule(config.STOCK_ALERT_JOB_CRON, checkAllProducts);
  console.log(`[stock-alert-job] scheduled (${config.STOCK_ALERT_JOB_CRON})`);
}

module.exports = { startStockAlertJob, checkAllProducts };
