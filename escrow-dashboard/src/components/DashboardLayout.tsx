import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, FileText, Settings as SettingsIcon, Scale, Menu, X } from 'lucide-react';
import NotificationBell from './NotificationBell';
import { sellersApi } from '../lib/api';
import { useAuth } from '../lib/auth';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/deals', label: 'Deals', icon: Package },
  { to: '/disputes', label: 'Disputes', icon: Scale },
  { to: '/invoicing', label: 'Invoicing', icon: FileText, badge: 'Soon', muted: true },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/deals': 'Deals',
  '/deals/new': 'New deal',
  '/disputes': 'Disputes',
  '/invoicing': 'Invoicing',
  '/settings': 'Settings',
};

export default function DashboardLayout() {
  const location = useLocation();
  const { setSeller } = useAuth();
  const title = PAGE_TITLES[location.pathname] ?? 'Dashboard';
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // The cached seller (localStorage, set at login) can go stale — e.g. a
  // settlement account added via the Telegram bot's /bank command wouldn't
  // show up here otherwise. Refresh from the server on every dashboard visit.
  useEffect(() => {
    sellersApi.me().then(setSeller).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close the mobile sidebar automatically whenever the route changes.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-escrow-cream text-escrow-ink font-sans flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-60 shrink-0 bg-white md:bg-white/60 border-r border-escrow-ink/10 flex flex-col transform transition-transform duration-200 ease-in-out md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-6 py-6 flex items-center justify-between">
          <img src="/logo-wordmark.svg" alt="Zap" className="h-8 w-auto" />
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-escrow-ink/50 hover:text-escrow-ink transition"
            aria-label="Close menu"
          >
            <X size={20} strokeWidth={1.75} />
          </button>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition border-l-2 ${
                  isActive
                    ? 'border-escrow-teal bg-escrow-teal/10 text-escrow-ink font-medium'
                    : `border-transparent hover:bg-escrow-ink/5 ${item.muted ? 'text-escrow-ink/40' : 'text-escrow-ink/60'}`
                }`
              }
            >
              <item.icon size={18} strokeWidth={1.75} />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-escrow-ink/10 text-escrow-ink/50">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-escrow-ink/10 bg-white/60 flex items-center justify-between px-4 md:px-8 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden text-escrow-ink/70 hover:text-escrow-ink transition shrink-0"
              aria-label="Open menu"
            >
              <Menu size={22} strokeWidth={1.75} />
            </button>
            <h1 className="font-fraunces text-xl truncate">{title}</h1>
          </div>
          <NotificationBell />
        </header>

        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
