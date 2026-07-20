import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { notificationsApi, type Notification } from '../lib/api';

function describeNotification(n: Notification): string {
  const amount = n.payload?.amount ? `₦${Number(n.payload.amount).toLocaleString()}` : 'Funds';
  switch (n.type) {
    case 'DISBURSEMENT_MISSING':
      return `${amount} is ready to release — add your disbursement account to receive it`;
    case 'FUNDS_RELEASED':
      return `${amount} has been released to your account`;
    case 'DISPUTE_ALERT':
      return `A dispute was raised on deal ${n.payload?.code ?? ''}`.trim();
    case 'DEAL_PAID':
      return 'New payment received';
    default:
      return 'You have a new notification';
  }
}

function targetPath(n: Notification): string {
  return n.type === 'DISBURSEMENT_MISSING' ? '/settings' : '/deals';
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = () => {
    notificationsApi.list().then(setNotifications).catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) load();
  }

  async function handleClickNotification(n: Notification) {
    if (!n.read) {
      notificationsApi.markRead(n.id).catch(() => {});
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    setOpen(false);
    navigate(targetPath(n));
  }

  async function handleMarkAllRead() {
    await notificationsApi.markAllRead().catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={handleToggle}
        className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-escrow-ink/5 transition"
        aria-label="Notifications"
      >
        <Bell size={19} strokeWidth={1.75} className="text-escrow-ink/70" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-escrow-coral text-white text-[10px] font-medium flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white border border-escrow-ink/10 rounded-xl shadow-lg z-20">
          <div className="flex items-center justify-between px-4 py-3 border-b border-escrow-ink/10">
            <span className="text-sm font-medium">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-escrow-teal hover:underline">
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 && (
            <p className="text-sm text-escrow-ink/50 text-center py-8">No notifications yet</p>
          )}

          {notifications.slice(0, 10).map((n) => (
            <button
              key={n.id}
              onClick={() => handleClickNotification(n)}
              className="w-full text-left px-4 py-3 border-b border-escrow-ink/5 last:border-0 hover:bg-escrow-cream/60 transition flex gap-2.5"
            >
              <span
                className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${n.read ? 'bg-transparent' : 'bg-escrow-coral'}`}
              />
              <span className={`text-sm ${n.read ? 'text-escrow-ink/50' : 'text-escrow-ink font-medium'}`}>
                {describeNotification(n)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
