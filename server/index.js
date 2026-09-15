require('dotenv').config();
const express = require('express');
const cors = require('cors');
const config = require('./config');
const { requireAuth } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const cartRoutes = require('./routes/carts');
const productRoutes = require('./routes/products');
const alertRoutes = require('./routes/alerts');
const templateRoutes = require('./routes/templates');
const metricsRoutes = require('./routes/metrics');

const { startAbandonedCartJob } = require('./jobs/abandonedCarts');
const { startRecoveryEmailJob } = require('./jobs/recoveryEmails');
const { startStockAlertJob } = require('./jobs/stockAlerts');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/carts', requireAuth, cartRoutes);
app.use('/api/products', requireAuth, productRoutes);
app.use('/api/alerts', requireAuth, alertRoutes);
app.use('/api/templates', requireAuth, templateRoutes);
app.use('/api/metrics', requireAuth, metricsRoutes);

app.use((err, req, res, next) => {
  console.error('[server error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.PORT, () => {
  console.log(`CartGuard server listening on http://localhost:${config.PORT}`);
  startAbandonedCartJob();
  startRecoveryEmailJob();
  startStockAlertJob();
});
