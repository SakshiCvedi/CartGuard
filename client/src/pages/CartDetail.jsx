import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail, MousePointerClick, Eye, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client';
import Badge from '../components/Badge';
import Skeleton from '../components/Skeleton';

function formatMoney(n) {
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function CartDetail() {
  const { id } = useParams();
  const [cart, setCart] = useState(null);
  const [error, setError] = useState(null);
  const [recovering, setRecovering] = useState(false);

  const load = useCallback(() => {
    api.cart(id).then(setCart).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function recover() {
    setRecovering(true);
    try {
      await api.recoverCart(id);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setRecovering(false);
    }
  }

  async function toggle(emailId, field) {
    try {
      await api.toggleEmail(id, emailId, field);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (error) return <div className="p-8 text-[14px]" style={{ color: 'var(--clay)' }}>{error}</div>;

  if (!cart) {
    return (
      <div className="px-4 sm:px-8 py-7 max-w-4xl">
        <Skeleton className="h-6 w-40 mb-6" />
        <Skeleton className="h-32 w-full mb-6" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const total = cart.items.reduce((sum, i) => sum + i.quantity * i.price_at_time, 0);
  const canRecover = cart.status === 'abandoned';

  return (
    <div className="px-4 sm:px-8 py-7 max-w-4xl">
      <Link to="/" className="inline-flex items-center gap-1.5 text-[13px] mb-5" style={{ color: 'var(--steel)' }}>
        <ArrowLeft size={14} /> Back to overview
      </Link>

      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-display text-[20px] font-semibold" style={{ color: 'var(--paper)' }}>Cart #{cart.id}</h1>
            <Badge status={cart.status} />
          </div>
          <p className="text-[13px]" style={{ color: 'var(--steel)' }}>{cart.customer_name} · {cart.customer_email}</p>
        </div>

        {canRecover && (
          <button
            onClick={recover}
            disabled={recovering}
            className="flex items-center gap-1.5 text-[13px] px-3 py-2 rounded-md disabled:opacity-60"
            style={{ background: 'var(--moss)', color: 'var(--ink)' }}
          >
            <CheckCircle2 size={14} />
            {recovering ? 'Marking recovered…' : 'Mark as recovered'}
          </button>
        )}
      </div>

      {/* Cart contents */}
      <div className="rounded-lg border overflow-hidden mb-8" style={{ borderColor: 'var(--panel-2)' }}>
        <div className="px-4 sm:px-6 py-4 border-b" style={{ borderColor: 'var(--panel-2)', background: 'var(--panel)' }}>
          <h2 className="font-display text-[15px]" style={{ color: 'var(--paper)' }}>Cart contents</h2>
        </div>
        <div style={{ background: 'var(--panel)' }}>
          {cart.items.map((item) => (
            <div key={item.id} className="px-4 sm:px-6 py-3 border-t flex items-center gap-3 sm:gap-4 text-[13.5px]" style={{ borderColor: 'var(--panel-2)' }}>
              <span style={{ color: 'var(--paper)' }} className="flex-1 truncate">{item.product_name}</span>
              <span className="font-mono w-16" style={{ color: 'var(--steel)' }}>{item.sku}</span>
              <span className="font-mono w-16" style={{ color: 'var(--steel)' }}>×{item.quantity}</span>
              <span className="font-mono w-20 text-right" style={{ color: 'var(--paper)' }}>{formatMoney(item.price_at_time)}</span>
            </div>
          ))}
          <div className="px-4 sm:px-6 py-3 border-t flex items-center justify-between text-[13.5px]" style={{ borderColor: 'var(--panel-2)' }}>
            <span style={{ color: 'var(--steel)' }}>Total</span>
            <span className="font-mono font-medium" style={{ color: 'var(--paper)' }}>{formatMoney(total)}</span>
          </div>
        </div>
      </div>

      {/* Recovery email timeline */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--panel-2)' }}>
        <div className="px-4 sm:px-6 py-4 border-b" style={{ borderColor: 'var(--panel-2)', background: 'var(--panel)' }}>
          <h2 className="font-display text-[15px]" style={{ color: 'var(--paper)' }}>Recovery email timeline</h2>
        </div>
        <div style={{ background: 'var(--panel)' }}>
          {cart.emails.length === 0 && (
            <div className="px-4 sm:px-6 py-6 text-[13px]" style={{ color: 'var(--steel)' }}>
              No recovery emails sent yet — this cart hasn't been marked abandoned.
            </div>
          )}
          {cart.emails.map((email, i) => (
            <div key={email.id} className="px-4 sm:px-6 py-4 border-t flex items-start gap-3 sm:gap-4" style={{ borderColor: 'var(--panel-2)' }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-mono shrink-0 mt-0.5" style={{ background: 'var(--panel-2)', color: 'var(--steel)' }}>
                {email.sequence_step}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[13.5px] font-medium truncate" style={{ color: 'var(--paper)' }}>{email.subject}</span>
                </div>
                <div className="text-[12px] mb-2" style={{ color: 'var(--steel)' }}>Sent {formatDateTime(email.sent_at)}</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggle(email.id, 'opened')}
                    className="flex items-center gap-1 text-[11.5px] px-2 py-1 rounded"
                    style={{ background: email.opened ? 'rgba(127,160,107,0.15)' : 'var(--panel-2)', color: email.opened ? 'var(--moss)' : 'var(--steel)' }}
                  >
                    <Eye size={11} /> {email.opened ? 'Opened' : 'Mark opened'}
                  </button>
                  <button
                    onClick={() => toggle(email.id, 'clicked')}
                    className="flex items-center gap-1 text-[11.5px] px-2 py-1 rounded"
                    style={{ background: email.clicked ? 'rgba(226,166,59,0.15)' : 'var(--panel-2)', color: email.clicked ? 'var(--amber)' : 'var(--steel)' }}
                  >
                    <MousePointerClick size={11} /> {email.clicked ? 'Clicked' : 'Mark clicked'}
                  </button>
                  {email.recovered ? (
                    <span className="flex items-center gap-1 text-[11.5px] px-2 py-1 rounded" style={{ background: 'rgba(127,160,107,0.15)', color: 'var(--moss)' }}>
                      <Mail size={11} /> Led to recovery
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
