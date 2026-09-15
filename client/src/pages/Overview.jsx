import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { PlusCircle, ShoppingCart, PackageMinus } from 'lucide-react';
import { api } from '../api/client';
import Badge from '../components/Badge';
import Skeleton from '../components/Skeleton';

function formatMoney(n) {
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-md px-3 py-2 text-[12px] border" style={{ background: 'var(--panel-2)', borderColor: 'var(--steel)', color: 'var(--paper)' }}>
      <div className="mb-1" style={{ color: 'var(--steel)' }}>{formatDate(label)}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="tabular" style={{ color: p.color }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
}

export default function Overview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [simLoading, setSimLoading] = useState(null); // 'abandoned' | 'purchase' | 'lowstock' | null
  const [flash, setFlash] = useState(null);

  const load = useCallback(() => {
    api.overview().then(setData).catch((e) => setError(e.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function simulate(kind) {
    setSimLoading(kind);
    setFlash(null);
    try {
      let result;
      if (kind === 'abandoned') result = await api.simulateAbandoned();
      else if (kind === 'purchase') result = await api.simulatePurchase();
      else result = await api.simulateLowStock();
      setFlash(result.message);
      setTimeout(() => setFlash(null), 5000);
      load();
    } catch (e) {
      setFlash(e.message);
    } finally {
      setSimLoading(null);
    }
  }

  if (error) {
    return <div className="p-8 text-[14px]" style={{ color: 'var(--clay)' }}>{error}</div>;
  }

  const stats = data ? [
    { label: 'Abandoned this week', value: data.abandonedThisWeek },
    { label: 'Recovery rate', value: `${data.recoveryRate}%` },
    { label: 'Revenue recovered', value: formatMoney(data.revenueRecovered) },
    { label: 'Active low-stock alerts', value: data.activeLowStockAlerts, accent: data.activeLowStockAlerts > 0 ? 'var(--amber)' : undefined },
  ] : null;

  return (
    <div className="px-4 sm:px-8 py-7 max-w-6xl">
      <div className="flex items-start justify-between mb-7 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-[22px] font-semibold" style={{ color: 'var(--paper)' }}>Overview</h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--steel)' }}>What needs your attention, at a glance.</p>
        </div>

        <div className="flex gap-2 flex-wrap w-full sm:w-auto">
          <button
            onClick={() => simulate('abandoned')}
            disabled={simLoading !== null}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-[13px] px-3 py-2 rounded-md border disabled:opacity-60 whitespace-nowrap"
            style={{ borderColor: 'var(--panel-2)', color: 'var(--paper)' }}
          >
            <ShoppingCart size={14} />
            {simLoading === 'abandoned' ? 'Creating…' : 'Simulate abandoned cart'}
          </button>
          <button
            onClick={() => simulate('purchase')}
            disabled={simLoading !== null}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-[13px] px-3 py-2 rounded-md disabled:opacity-60 whitespace-nowrap"
            style={{ background: 'var(--moss)', color: 'var(--ink)' }}
          >
            <PlusCircle size={14} />
            {simLoading === 'purchase' ? 'Creating…' : 'Simulate purchase'}
          </button>
          <button
            onClick={() => simulate('lowstock')}
            disabled={simLoading !== null}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-[13px] px-3 py-2 rounded-md disabled:opacity-60 whitespace-nowrap"
            style={{ background: 'var(--amber)', color: 'var(--ink)' }}
          >
            <PackageMinus size={14} />
            {simLoading === 'lowstock' ? 'Dropping stock…' : 'Simulate low stock'}
          </button>
        </div>
      </div>

      {flash && (
        <div className="mb-6 text-[13px] px-3 py-2 rounded-md border" style={{ borderColor: 'var(--panel-2)', color: 'var(--steel)', background: 'var(--panel)' }}>
          {flash}
        </div>
      )}

      {/* Manifest stat strip - grid instead of flex so it reflows into a 2x2
          grid on narrow screens instead of overflowing off-screen. The 1px
          gap over a --panel-2 background paints the same hairline dividers
          as before, now in both directions. */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-lg mb-8 overflow-hidden"
        style={{ background: 'var(--panel-2)' }}
      >
        {stats ? stats.map((s) => (
          <div key={s.label} className="px-4 sm:px-6 py-5" style={{ background: 'var(--panel)' }}>
            <div className="font-mono text-[22px] sm:text-[26px] font-medium" style={{ color: s.accent || 'var(--paper)' }}>{s.value}</div>
            <div className="text-[12px] sm:text-[12.5px] mt-1" style={{ color: 'var(--steel)' }}>{s.label}</div>
          </div>
        )) : Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-4 sm:px-6 py-5" style={{ background: 'var(--panel)' }}>
            <Skeleton className="h-7 w-16 mb-2" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Trend chart */}
      <div className="rounded-lg border p-4 sm:p-6 mb-8" style={{ borderColor: 'var(--panel-2)', background: 'var(--panel)' }}>
        <h2 className="font-display text-[15px] mb-4" style={{ color: 'var(--paper)' }}>Abandoned vs. recovered — last 14 days</h2>
        {data ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.trend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-2)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: 'var(--steel)', fontSize: 11 }} axisLine={{ stroke: 'var(--panel-2)' }} tickLine={false} minTickGap={24} />
              <YAxis tick={{ fill: 'var(--steel)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="abandoned" name="Abandoned" stroke="var(--clay)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="recovered" name="Recovered" stroke="var(--moss)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Skeleton className="h-[220px] w-full" />
        )}
      </div>

      {/* Recent abandoned carts ledger */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--panel-2)' }}>
        <div className="px-4 sm:px-6 py-4 border-b" style={{ borderColor: 'var(--panel-2)', background: 'var(--panel)' }}>
          <h2 className="font-display text-[15px]" style={{ color: 'var(--paper)' }}>Recent abandoned carts</h2>
        </div>
        <div style={{ background: 'var(--panel)' }}>
          {!data && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 sm:px-6 py-3.5 border-t flex gap-4" style={{ borderColor: 'var(--panel-2)' }}>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-16 ml-auto" />
            </div>
          ))}
          {data && data.recentAbandoned.length === 0 && (
            <div className="px-4 sm:px-6 py-8 text-center text-[13px]" style={{ color: 'var(--steel)' }}>
              No abandoned carts yet — try "Simulate abandoned cart" above.
            </div>
          )}
          {data && data.recentAbandoned.map((cart) => (
            <Link
              to={`/carts/${cart.id}`}
              key={cart.id}
              className="px-4 sm:px-6 py-3.5 border-t flex items-center gap-3 sm:gap-4 text-[13.5px] transition-colors"
              style={{ borderColor: 'var(--panel-2)' }}
            >
              <span style={{ color: 'var(--paper)' }} className="w-24 sm:w-40 truncate">{cart.customer_name}</span>
              <span style={{ color: 'var(--steel)' }} className="w-56 truncate hidden md:block">{cart.customer_email}</span>
              <span style={{ color: 'var(--steel)' }} className="w-24 hidden lg:block">{cart.item_count} item{cart.item_count === 1 ? '' : 's'}</span>
              <span className="font-mono w-16 sm:w-20 shrink-0" style={{ color: 'var(--paper)' }}>{formatMoney(cart.cart_value)}</span>
              <span className="ml-auto shrink-0"><Badge status={cart.status} /></span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
