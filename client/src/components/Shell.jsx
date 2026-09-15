import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutGrid, PackageSearch, Mail, LogOut, ShieldCheck } from 'lucide-react';
import { setToken } from '../api/client';

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutGrid, end: true },
  { to: '/inventory', label: 'Inventory', icon: PackageSearch },
  { to: '/templates', label: 'Email templates', icon: Mail },
];

export default function Shell({ storeName }) {
  const navigate = useNavigate();

  function logout() {
    setToken(null);
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--ink)' }}>
      {/* Icon-only rail below sm, full labelled sidebar from sm up - keeps the
          content area usable on narrow/tablet viewports instead of a fixed
          240px sidebar eating most of the screen. */}
      <aside
        className="w-14 sm:w-60 shrink-0 flex flex-col border-r"
        style={{ borderColor: 'var(--panel-2)', background: 'var(--panel)' }}
      >
        <div className="px-3 sm:px-5 py-6 flex items-center justify-center sm:justify-start gap-2.5 border-b" style={{ borderColor: 'var(--panel-2)' }}>
          <ShieldCheck size={22} style={{ color: 'var(--amber)' }} strokeWidth={2} className="shrink-0" />
          <div className="hidden sm:block">
            <div className="font-display font-semibold text-[15px] leading-tight" style={{ color: 'var(--paper)' }}>CartGuard</div>
            <div className="text-[11px] leading-tight" style={{ color: 'var(--steel)' }}>{storeName}</div>
          </div>
        </div>

        <nav className="flex-1 px-2 sm:px-3 py-4 flex flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={label}
              className={({ isActive }) =>
                `flex items-center justify-center sm:justify-start gap-3 px-2 sm:px-3 py-2 rounded-md text-[13.5px] transition-colors ${
                  isActive ? 'font-medium' : ''
                }`
              }
              style={({ isActive }) => ({
                background: isActive ? 'var(--panel-2)' : 'transparent',
                color: isActive ? 'var(--paper)' : 'var(--steel)',
              })}
            >
              <Icon size={16} strokeWidth={2} className="shrink-0" />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-2 sm:px-3 py-4 border-t" style={{ borderColor: 'var(--panel-2)' }}>
          <button
            onClick={logout}
            title="Log out"
            className="w-full flex items-center justify-center sm:justify-start gap-3 px-2 sm:px-3 py-2 rounded-md text-[13.5px] transition-colors hover:opacity-100"
            style={{ color: 'var(--steel)' }}
          >
            <LogOut size={16} strokeWidth={2} className="shrink-0" />
            <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
