const cron = require('node-cron');
const db = require('../db/connection');
const config = require('../config');
const { sendRecoveryEmail } = require('../services/email');

async function sendFirstRecoveryEmail(cart) {
  const template = db.prepare(`
    SELECT * FROM email_template WHERE store_id = ? AND sequence_step = 1
  `).get(cart.store_id);
  if (!template) return;

  const customer = db.prepare('SELECT * FROM customer WHERE id = ?').get(cart.customer_id);
  const items = db.prepare(`
    SELECT ci.*, p.name as product_name FROM cart_item ci JOIN product p ON p.id = ci.product_id WHERE ci.cart_id = ?
  `).all(cart.id);
  const itemsList = items.map((i) => `${i.quantity}x ${i.product_name}`).join(', ');

  const vars = {
    customer_name: customer.name,
    cart_items: itemsList,
    discount_code: '',
  };

  const result = await sendRecoveryEmail({ to: customer.email, subject: template.subject, body: template.body, vars });

  try {
    db.prepare(`
      INSERT INTO recovery_email (cart_id, sequence_step, subject, body, sent_at, opened, clicked, recovered)
      VALUES (?, 1, ?, ?, ?, 0, 0, 0)
    `).run(cart.id, result.subject, result.body, new Date().toISOString());
  } catch (err) {
    // UNIQUE(cart_id, sequence_step) guard - should be unreachable given the
    // atomic status claim above, but if it ever fires, don't crash the job.
    if (err.code !== 'SQLITE_CONSTRAINT_UNIQUE' && err.code !== 'SQLITE_CONSTRAINT') throw err;
  }

  console.log(`[abandoned-cart-job] Cart #${cart.id} marked abandoned. Recovery email #1 sent to ${customer.email}${result.previewUrl ? ` — preview: ${result.previewUrl}` : ''}`);
}

// Guards against two overlapping runs (e.g. a slow email send pushes one run
// past the next cron tick) double-processing the same carts. See README's
// "Known edge cases" section for how this was found and why both the lock
// and the per-cart atomic claim below are needed.
let isRunning = false;

function runAbandonedCartCheck() {
  if (isRunning) {
    console.log('[abandoned-cart-job] Previous run still in progress — skipping this tick.');
    return Promise.resolve();
  }
  isRunning = true;

  const cutoff = new Date(Date.now() - config.ABANDONED_AFTER_MINUTES * 60 * 1000).toISOString();

  // Only carts with at least one item are worth flagging - an empty cart has
  // nothing to recover and nothing sensible to put in a recovery email.
  const stale = db.prepare(`
    SELECT c.* FROM cart c
    WHERE c.status = 'active' AND c.updated_at <= ?
      AND EXISTS (SELECT 1 FROM cart_item ci WHERE ci.cart_id = c.id)
  `).all(cutoff);

  return (async () => {
    try {
      for (const cart of stale) {
        // Atomic claim: only proceed if THIS call is the one that actually
        // flips the status. If another run already claimed this cart (or a
        // caller bypasses the lock above, as a test harness might), `changes`
        // comes back 0 and we skip - so the same cart is never emailed twice.
        const claim = db.prepare(`UPDATE cart SET status = 'abandoned', updated_at = ? WHERE id = ? AND status = 'active'`)
          .run(new Date().toISOString(), cart.id);
        if (claim.changes === 0) continue;

        try {
          await sendFirstRecoveryEmail(cart);
        } catch (err) {
          console.error(`[abandoned-cart-job] Failed to send recovery email for cart #${cart.id}:`, err.message);
          // Transient failure (e.g. email service briefly unreachable) - revert the
          // claim so this cart is retried next tick instead of being stuck
          // 'abandoned' forever with no recovery email ever sent. `cart.updated_at`
          // still holds the original stale timestamp we read before claiming it.
          db.prepare(`UPDATE cart SET status = 'active', updated_at = ? WHERE id = ?`).run(cart.updated_at, cart.id);
        }
      }
    } finally {
      isRunning = false;
    }
  })();
}

function startAbandonedCartJob() {
  cron.schedule(config.ABANDONED_CART_JOB_CRON, runAbandonedCartCheck);
  console.log(`[abandoned-cart-job] scheduled (${config.ABANDONED_CART_JOB_CRON}), threshold ${config.ABANDONED_AFTER_MINUTES}min`);
}

module.exports = { startAbandonedCartJob, runAbandonedCartCheck };
