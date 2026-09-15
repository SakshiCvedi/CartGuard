const nodemailer = require('nodemailer');

let transporterPromise = null;

/**
 * Lazily creates a single Ethereal (fake SMTP) test account + transporter,
 * shared across the app, so emails can be "sent" and previewed without any
 * real credentials. Each sent message gets a preview URL you can open in a
 * browser to see exactly what the customer would have received.
 */
function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = nodemailer.createTestAccount().then((account) => {
      const transporter = nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass },
      });
      console.log(`[email] Ethereal test account ready: ${account.user}`);
      return transporter;
    }).catch((err) => {
      console.warn('[email] Could not create Ethereal account (likely no network access). Falling back to a no-op transporter that just logs — will retry on the next send.', err.message);
      // Don't cache the failure: clear it so the *next* call retries instead
      // of being stuck on the no-op fallback forever if connectivity returns.
      transporterPromise = null;
      return null;
    });
  }
  return transporterPromise;
}

function fillTemplate(str, vars) {
  return str.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => (key in vars ? vars[key] : match));
}

/**
 * Sends a recovery email using a template + variables. Returns
 * { messageId, previewUrl } - previewUrl will be null if the fallback
 * no-op transporter was used (e.g. no network access in this environment).
 */
async function sendRecoveryEmail({ to, subject, body, vars }) {
  const filledSubject = fillTemplate(subject, vars);
  const filledBody = fillTemplate(body, vars);

  const transporter = await getTransporter();

  if (!transporter) {
    console.log(`[email:fallback] To: ${to}\nSubject: ${filledSubject}\n${filledBody}\n`);
    return { messageId: null, previewUrl: null, subject: filledSubject, body: filledBody };
  }

  const info = await transporter.sendMail({
    from: '"CartGuard Demo Store" <no-reply@cartguard-demo.test>',
    to,
    subject: filledSubject,
    text: filledBody,
    html: `<div style="font-family: sans-serif; line-height:1.5;">${filledBody.replace(/\n/g, '<br/>')}</div>`,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  return { messageId: info.messageId, previewUrl, subject: filledSubject, body: filledBody };
}

module.exports = { sendRecoveryEmail, fillTemplate };
