// Central place for the "make this configurable" knobs called out in the brief.
// Real-world minutes are compressed for demo purposes where noted.

module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || 'cartguard-demo-secret-change-me',
  PORT: process.env.PORT || 4000,

  // Real deployment default: 30 minutes of inactivity = abandoned.
  ABANDONED_AFTER_MINUTES: Number(process.env.ABANDONED_AFTER_MINUTES || 30),

  // Recovery email #2 ("real" cadence is 24h later). Compressed to 2 minutes for demo.
  RECOVERY_EMAIL_2_DELAY_MINUTES: Number(process.env.RECOVERY_EMAIL_2_DELAY_MINUTES || 2),

  // How often the cron jobs run.
  ABANDONED_CART_JOB_CRON: '* * * * *', // every minute
  STOCK_ALERT_JOB_CRON: '* * * * *', // every minute
  RECOVERY_EMAIL_JOB_CRON: '* * * * *', // every minute

  // Inventory
  STOCKOUT_PROJECTION_DAYS: 7, // alert if projected to run out within this many days
  REORDER_LEAD_TIME_DAYS: 14, // used for suggested reorder qty
  VELOCITY_LOOKBACK_DAYS: 14, // window of order history used to compute sales velocity
};
