# CartGuard

A demo e-commerce ops tool for a small store owner ("Wayfare Goods Co."). It does two things:

1. **Abandoned cart recovery** — detects carts with no activity for a while, marks them abandoned, and automatically sends a two-step recovery email sequence (immediate reminder, then a discount follow-up).
2. **Low-stock alerts** — tracks recent sales velocity per product and raises an alert (with a suggested reorder quantity) when stock is low or projected to run out soon.

Built as a portfolio piece: a working dashboard, a small REST API, and real background jobs — not just static mockups.

## Stack

- **Frontend:** React (Vite) + Tailwind CSS + Recharts
- **Backend:** Node.js + Express
- **Database:** SQLite (via `better-sqlite3`), with a schema written to be Postgres-compatible if you later want to move to Postgres
- **Background jobs:** `node-cron`
- **Email:** Nodemailer + an [Ethereal](https://ethereal.email/) test SMTP account (auto-created on first send — no credentials needed). Every "sent" email prints a preview URL to the server console where you can see exactly what the customer would have received.
- **Auth:** Simple JWT login for a single store-owner account (no multi-tenant, no OAuth)

## Project structure

```
cartguard/
├── server/
│   ├── db/                # schema.sql + SQLite connection
│   ├── routes/             # carts, products, alerts, templates, metrics, auth
│   ├── jobs/                # abandoned-cart detection, recovery emails, stock alerts
│   ├── services/            # email sending, sales-velocity/reorder math
│   ├── middleware/           # JWT auth guard
│   ├── config.js              # all the "make this configurable" knobs
│   ├── seed.js                 # realistic demo data generator
│   └── index.js                 # Express app + job scheduler
├── client/
│   └── src/
│       ├── pages/           # Overview, Inventory, CartDetail, Templates, Login
│       ├── components/       # Shell (nav), Badge, Skeleton
│       └── api/               # fetch wrapper
└── package.json             # root convenience scripts
```

## Setup

Requires Node 18+.

```bash
npm run install:all   # installs server + client dependencies
npm run seed           # creates the SQLite DB and populates 14 days of realistic history
npm run dev             # starts the API (port 4000) and the Vite dev server (port 5173) together
```

Then open **http://localhost:5173**. Log in with the pre-filled demo credentials:

- Email: `demo@cartguard.dev`
- Password: `demo1234`

Re-running `npm run seed` at any time wipes and regenerates all data (useful before a live demo).

### Running things separately

```bash
npm run server   # just the API
npm run client   # just the frontend (expects the API running on :4000; Vite proxies /api to it)
```

## Demo script

The background jobs run every minute, so a live demo takes a couple of minutes per flow. Suggested walkthrough:

**Abandoned cart → recovery → dashboard update**
1. On the Overview page, click **"Simulate abandoned cart"**. This creates a cart backdated far enough to already be past the abandonment threshold.
2. Within ~1 minute, the abandoned-cart job runs, marks it abandoned, and sends recovery email #1 — check the server console for a preview link.
3. Open the cart from the "Recent abandoned carts" list to see the recovery email timeline. You can toggle "opened"/"clicked" to simulate customer engagement.
4. Click **"Mark as recovered"** to simulate the customer completing checkout — watch the Overview metrics (recovery rate, revenue recovered) and the 14-day chart update.
5. (Optional) Wait ~2 more minutes without recovering, and email #2 — with a discount code — goes out automatically.

**Low stock → alert → reorder suggestion**
1. Go to the **Inventory** page. A few seeded products already start with low stock, so alerts are visible immediately after seeding.
2. Filter by "Needs attention" to see just the flagged products, each with its sales velocity and a suggested reorder quantity (velocity × 14-day lead time).
3. Click a product's alert badge to mark it resolved once you'd reorder it in real life.

**Simulate a normal purchase** (for contrast): click **"Simulate purchase"** on the Overview page — this creates a completed order directly and decrements stock, which is what feeds the velocity calculation over time.

## Configuration

Real-world timings are compressed for demo purposes. See `server/config.js`:

- `ABANDONED_AFTER_MINUTES` (default 30) — real-world cart inactivity threshold
- `RECOVERY_EMAIL_2_DELAY_MINUTES` (default 2) — compressed stand-in for the "24 hours later" second email
- `STOCKOUT_PROJECTION_DAYS` (default 7) — alert if projected to sell out within this window
- `REORDER_LEAD_TIME_DAYS` (default 14) — used to size the suggested reorder quantity

## API

All routes except `/api/auth/*` require `Authorization: Bearer <token>`.

```
POST   /api/auth/login
GET    /api/carts?status=abandoned
GET    /api/carts/:id
POST   /api/carts/:id/recover
POST   /api/carts/:id/emails/:emailId/toggle     { field: "opened" | "clicked" }
POST   /api/carts/simulate/abandoned
POST   /api/carts/simulate/purchase
GET    /api/products
GET    /api/alerts?resolved=false
POST   /api/alerts/:id/resolve
GET    /api/metrics/overview
GET    /api/templates
PUT    /api/templates/:id
```

## Notes on the sales-velocity model

Velocity is a simple recent average: total units sold in the last 14 days ÷ 14. No forecasting model — deliberately, so it's easy to explain to a non-technical client in one sentence. Suggested reorder quantity is `velocity × 14-day lead time`, with a small floor for slow movers.

## Known edge cases (tested against the actual running app)

- **Zero-item cart.** A cart with no items can exist in real life (a session started but nothing added yet, or one where every item was removed). The abandoned-cart job now excludes these — a cart needs at least one `cart_item` row to be flagged. Before this fix, empty carts were marked "abandoned" and sent a genuinely broken email ("You left these in your cart: ."). This was confirmed and fixed in `server/jobs/abandonedCarts.js`.
- **Two abandoned-cart (or recovery-email) job runs overlapping.** If a run takes longer than a minute (e.g. slow email sends), the next cron tick would otherwise start a second concurrent run. This was reproduced directly — it caused some customers to receive the same recovery email twice, with duplicate rows in `recovery_email`. Fixed with two layers: (1) an in-memory lock so a job simply skips a tick if the previous run hasn't finished, logged as `"Previous run still in progress — skipping this tick"`, and (2) a `UNIQUE(cart_id, sequence_step)` database constraint plus an atomic per-cart status claim, so even a bypassed lock can't double-send.
- **Stock exactly at the low-stock threshold.** Confirmed intentional and inclusive: `stock_quantity <= low_stock_threshold` triggers an alert right at the boundary, not only strictly below it — matching how real inventory reorder points work.
- **Email service briefly unreachable.** The app already falls back to logging the email instead of crashing (this is what happens in this dev sandbox, since outbound SMTP isn't reachable here). Two related bugs were found and fixed: (1) a failed connection attempt used to be cached permanently, meaning the app would never retry sending real emails again even after connectivity returned — it now retries on the next send instead; (2) if a send failed entirely, the cart/claim is now rolled back so the next job run retries that customer, instead of silently never contacting them again.
