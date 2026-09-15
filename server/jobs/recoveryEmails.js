const cron = require('node-cron');
const crypto = require('crypto');
const db = require('../db/connection');
const config = require('../config');
const { sendRecoveryEmail } = require('../services/email');

function generateDiscountCode() {
  return `SAVE10-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

// Same overlap concern as the abandoned-cart job (see that file's comment),
// but here there's no cart-status flip to atomically claim on - the cart just
// stays 'abandoned' throughout. Instead we claim by inserting a placeholder
// recovery_email row *before* sending, protected by the UNIQUE(cart_id,
// sequence_step) constraint in schema.sql: if a concurrent run already
// claimed this cart, our insert fails and we skip - closing the race at the
// point where it actually matters (before the email is sent), not just at
// the point where the row is recorded.
let isRunning = false;

function claimStep2(cartId) {
  try {
    db.prepare(`
      INSERT INTO recovery_email (cart_id, sequence_step, subject, body, sent_at, opened, clicked, recovered)
      VALUES (?, 2, '', '', ?, 0, 0, 0)
    `).run(cartId, new Date().toISOString());
    return true;
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === 'SQLITE_CONSTRAINT') return false;
    throw err;
  }
}

function runRecoveryEmailCheck() {
  if (isRunning) {
    console.log('[recovery-email-job] Previous run still in progress — skipping this tick.');
    return Promise.resolve();
  }
  isRunning = true;

  const cutoff = new Date(Date.now() - config.RECOVERY_EMAIL_2_DELAY_MINUTES * 60 * 1000).toISOString();

  // Carts still abandoned (not recovered), whose first email went out before the cutoff,
  // and that haven't already received a step-2 email.
  const candidates = db.prepare(`
    SELECT c.* FROM cart c
    WHERE c.status = 'abandoned'
      AND EXISTS (SELECT 1 FROM recovery_email re WHERE re.cart_id = c.id AND re.sequence_step = 1 AND re.sent_at <= ?)
      AND NOT EXISTS (SELECT 1 FROM recovery_email re WHERE re.cart_id = c.id AND re.sequence_step = 2)
  `).all(cutoff);

  return (async () => {
    try {
      for (const cart of candidates) {
        if (!claimStep2(cart.id)) continue; // another run already claimed this cart

        const template = db.prepare('SELECT * FROM email_template WHERE store_id = ? AND sequence_step = 2').get(cart.store_id);
        if (!template) continue;

        const customer = db.prepare('SELECT * FROM customer WHERE id = ?').get(cart.customer_id);
        const items = db.prepare(`
          SELECT ci.*, p.name as product_name FROM cart_item ci JOIN product p ON p.id = ci.product_id WHERE ci.cart_id = ?
        `).all(cart.id);
        const itemsList = items.map((i) => `${i.quantity}x ${i.product_name}`).join(', ');
        const discountCode = generateDiscountCode();

        try {
          const result = await sendRecoveryEmail({
            to: customer.email,
            subject: template.subject,
            body: template.body,
            vars: { customer_name: customer.name, cart_items: itemsList, discount_code: discountCode },
          });

          db.prepare(`
            UPDATE recovery_email SET subject = ?, body = ?, sent_at = ? WHERE cart_id = ? AND sequence_step = 2
          `).run(result.subject, result.body, new Date().toISOString(), cart.id);

          console.log(`[recovery-email-job] Cart #${cart.id} — email #2 (${discountCode}) sent to ${customer.email}${result.previewUrl ? ` — preview: ${result.previewUrl}` : ''}`);
        } catch (err) {
          console.error(`[recovery-email-job] Failed to send email #2 for cart #${cart.id}:`, err.message);
          // Transient failure - remove the claim placeholder so this cart is
          // retried next tick instead of being silently skipped forever.
          db.prepare(`DELETE FROM recovery_email WHERE cart_id = ? AND sequence_step = 2`).run(cart.id);
        }
      }
    } finally {
      isRunning = false;
    }
  })();
}

function startRecoveryEmailJob() {
  cron.schedule(config.RECOVERY_EMAIL_JOB_CRON, runRecoveryEmailCheck);
  console.log(`[recovery-email-job] scheduled (${config.RECOVERY_EMAIL_JOB_CRON}), step-2 delay ${config.RECOVERY_EMAIL_2_DELAY_MINUTES}min`);
}

module.exports = { startRecoveryEmailJob, runRecoveryEmailCheck };
