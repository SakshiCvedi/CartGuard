import { useEffect, useState, useMemo } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { api } from '../api/client';
import Badge from '../components/Badge';
import Skeleton from '../components/Skeleton';

const FILTERS = [
  { key: 'all', label: 'All products' },
  { key: 'alert', label: 'Needs attention' },
  { key: 'healthy', label: 'Healthy stock' },
];

function stockStatus(p) {
  if (p.stock_quantity === 0) return 'critical';
  if (p.has_active_alert) return 'low';
  return null;
}

export default function Inventory() {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [resolving, setResolving] = useState(null);

  useEffect(() => {
    api.products().then(setProducts).catch((e) => setError(e.message));
  }, []);

  async function resolve(productId, alertLookup) {
    // Find the alert id for this product from the alerts endpoint
    setResolving(productId);
    try {
      const alerts = await api.alerts(false);
      const match = alerts.find((a) => a.product_id === productId);
      if (match) {
        await api.resolveAlert(match.id);
        const updated = await api.products();
        setProducts(updated);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setResolving(null);
    }
  }

  const rows = useMemo(() => {
    if (!products) return null;
    let filtered = products;
    if (filter === 'alert') filtered = products.filter((p) => p.has_active_alert);
    if (filter === 'healthy') filtered = products.filter((p) => !p.has_active_alert);

    const sorted = [...filtered].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [products, filter, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function Th({ label, sortField }) {
    const active = sortKey === sortField;
    return (
      <button
        onClick={() => toggleSort(sortField)}
        className="flex items-center gap-1 text-[12px] font-medium uppercase-none"
        style={{ color: active ? 'var(--paper)' : 'var(--steel)' }}
      >
        {label}
        <ArrowUpDown size={11} style={{ opacity: active ? 1 : 0.4 }} />
      </button>
    );
  }

  if (error) return <div className="p-8 text-[14px]" style={{ color: 'var(--clay)' }}>{error}</div>;

  return (
    <div className="px-4 sm:px-8 py-7 max-w-6xl">
      <div className="mb-6">
        <h1 className="font-display text-[22px] font-semibold" style={{ color: 'var(--paper)' }}>Inventory</h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--steel)' }}>Stock levels, sales velocity, and reorder suggestions.</p>
      </div>

      <div className="flex gap-1 mb-5 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="text-[13px] px-3 py-1.5 rounded-md transition-colors whitespace-nowrap"
            style={{
              background: filter === f.key ? 'var(--panel-2)' : 'transparent',
              color: filter === f.key ? 'var(--paper)' : 'var(--steel)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* The 7-column table genuinely can't fit narrow/tablet widths at
          readable sizes, so it scrolls horizontally within its own bordered
          container instead of squeezing columns unreadable or overflowing
          the page itself. */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--panel-2)' }}>
        <div className="overflow-x-auto">
          <div style={{ minWidth: '760px' }}>
            <div
              className="grid px-6 py-3 border-b"
              style={{ borderColor: 'var(--panel-2)', background: 'var(--panel)', gridTemplateColumns: '2.2fr 1fr 1fr 1fr 1fr 1.2fr 1fr' }}
            >
              <Th label="Product" sortField="name" />
              <Th label="SKU" sortField="sku" />
              <Th label="Stock" sortField="stock_quantity" />
              <Th label="Velocity/day" sortField="velocity_per_day" />
              <Th label="Days left" sortField="days_until_stockout" />
              <span className="text-[12px] font-medium" style={{ color: 'var(--steel)' }}>Status</span>
              <span className="text-[12px] font-medium" style={{ color: 'var(--steel)' }}>Reorder qty</span>
            </div>

            <div style={{ background: 'var(--panel)' }}>
              {!rows && Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="px-6 py-3.5 border-t" style={{ borderColor: 'var(--panel-2)' }}>
                  <Skeleton className="h-4 w-full max-w-md" />
                </div>
              ))}

              {rows && rows.length === 0 && (
                <div className="px-6 py-8 text-center text-[13px]" style={{ color: 'var(--steel)' }}>No products match this filter.</div>
              )}

              {rows && rows.map((p) => {
                const status = stockStatus(p);
                return (
                  <div
                    key={p.id}
                    className="grid px-6 py-3.5 border-t items-center text-[13.5px]"
                    style={{ borderColor: 'var(--panel-2)', gridTemplateColumns: '2.2fr 1fr 1fr 1fr 1fr 1.2fr 1fr' }}
                  >
                    <span style={{ color: 'var(--paper)' }} className="truncate pr-2">{p.name}</span>
                    <span className="font-mono text-[12.5px]" style={{ color: 'var(--steel)' }}>{p.sku}</span>
                    <span className="font-mono" style={{ color: p.stock_quantity === 0 ? 'var(--clay)' : 'var(--paper)' }}>{p.stock_quantity}</span>
                    <span className="font-mono" style={{ color: 'var(--paper)' }}>{p.velocity_per_day}</span>
                    <span className="font-mono" style={{ color: 'var(--paper)' }}>{p.days_until_stockout ?? '—'}</span>
                    <span>
                      {p.has_active_alert ? (
                        <button
                          onClick={() => resolve(p.id)}
                          disabled={resolving === p.id}
                          className="disabled:opacity-60"
                          title="Mark alert resolved"
                        >
                          <Badge status={status} />
                        </button>
                      ) : (
                        <Badge status="resolved">Healthy</Badge>
                      )}
                    </span>
                    <span className="font-mono" style={{ color: p.has_active_alert ? 'var(--amber)' : 'var(--steel)' }}>
                      {p.has_active_alert ? p.suggested_reorder_qty : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
