import { useState, useRef, useEffect } from 'react';
import { Bell, Menu, CheckCheck } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAuthStore from '../../store/authStore';
import api from '../../lib/api';

const routeTitles = {
  '/dashboard':    'Dashboard',
  '/campaigns':    'Campaigns',
  '/ads':          'Ad Studio',
  '/research':     'Research Hub',
  '/seo':          'SEO Intelligence',
  '/analytics':    'Analytics',
  '/settings':     'Settings',
  '/rules':        'Rules',
  '/integrations': 'Integrations',
  '/team':         'Team',
};

function timeAgo(dateStr) {
  const secs = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (secs < 60)    return 'just now';
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

const TYPE_COLORS = {
  rule_triggered: 'bg-yellow-500/15 text-yellow-400',
  audit_complete: 'bg-green-500/15  text-green-400',
  keyword_alert:  'bg-blue-500/15   text-blue-400',
};

export default function TopBar({ onMenuClick }) {
  const location = useLocation();
  const { user } = useAuthStore();
  const title = routeTitles[location.pathname] || 'AdPilot';
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn:  () => api.get('/notifications').then((r) => r.data.data),
    refetchInterval: 30_000,
    enabled: !!user,
  });

  const notifications = data?.notifications ?? [];
  const unreadCount   = data?.unreadCount   ?? 0;

  const markAllMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <header className="h-16 border-b border-border bg-bg-secondary flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden text-text-secondary hover:text-text-primary transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-text-primary">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* ── Notification bell ────────────────────────────────────────────── */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen((o) => !o)}
            className="relative p-2 text-text-secondary hover:text-text-primary hover:bg-bg-card rounded-lg transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 bg-accent-blue rounded-full flex items-center justify-center text-[9px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-12 w-80 bg-bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-sm font-semibold text-text-primary">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllMutation.mutate()}
                    disabled={markAllMutation.isPending}
                    className="flex items-center gap-1 text-xs text-accent-blue hover:text-accent-blue/80 transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
              </div>

              {/* View all link */}
              <Link
                to="/notifications"
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-xs text-accent-blue hover:underline border-b border-border text-center"
              >
                View all notifications →
              </Link>

              {/* List */}
              <div className="max-h-72 overflow-y-auto divide-y divide-border">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-text-secondary text-sm">
                    <Bell className="w-7 h-7 mx-auto mb-2 opacity-30" />
                    No notifications yet
                  </div>
                ) : (
                  notifications.slice(0, 10).map((n) => (
                    <div
                      key={n.id}
                      className={`px-4 py-3 hover:bg-white/2 transition-colors ${n.status === 'pending' ? 'bg-white/2' : ''}`}
                    >
                      <div className="flex items-start gap-2.5">
                        {n.status === 'pending' && (
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent-blue shrink-0" />
                        )}
                        <div className={n.status !== 'pending' ? 'ml-4' : ''}>
                          <p className="text-xs text-text-primary leading-snug">{n.message}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {n.type && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[n.type] ?? 'bg-border text-text-secondary'}`}>
                                {n.type.replace(/_/g, ' ')}
                              </span>
                            )}
                            <span className="text-[10px] text-text-secondary">{timeAgo(n.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Role badge */}
        {user?.role && (
          <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-accent-blue/10 text-accent-blue border border-accent-blue/20 text-xs font-semibold capitalize">
            {user.role}
          </span>
        )}
      </div>
    </header>
  );
}
