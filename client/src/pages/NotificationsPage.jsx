import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell, CheckCircle, AlertCircle, AlertTriangle, Info,
  CheckCheck, Trash2, X,
} from 'lucide-react';
import api from '../lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const secs = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (secs < 60)    return 'just now';
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 172800) return 'Yesterday';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const TYPE_CONFIG = {
  success: { icon: CheckCircle,    color: 'text-green-400',  bg: 'bg-green-500/10'  },
  error:   { icon: AlertCircle,    color: 'text-red-400',    bg: 'bg-red-500/10'    },
  warning: { icon: AlertTriangle,  color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  info:    { icon: Info,           color: 'text-blue-400',   bg: 'bg-blue-500/10'   },
};

const FILTERS = ['All', 'Unread', 'Success', 'Error', 'Warning', 'Info'];

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 p-4 border-b border-border">
      <div className="skeleton w-8 h-8 rounded-lg shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 rounded w-3/4" />
        <div className="skeleton h-3 rounded w-1/3" />
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState('All');

  // Build query params from filter
  const queryParams = () => {
    const p = new URLSearchParams({ limit: '50' });
    if (activeFilter === 'Unread') p.set('status', 'pending');
    else if (activeFilter !== 'All') p.set('type', activeFilter.toLowerCase());
    return p.toString();
  };

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'page', activeFilter],
    queryFn:  () => api.get(`/notifications?${queryParams()}`).then((r) => r.data.data),
  });

  const notifications = data?.notifications ?? [];
  const unreadCount   = data?.unreadCount   ?? 0;

  const markReadMutation = useMutation({
    mutationFn: (id) => api.patch(`/notifications/${id}/read`),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/notifications/${id}`),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Notifications</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
            className="flex items-center gap-1.5 btn-secondary text-sm"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-border">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeFilter === f
                ? 'border-accent-blue text-accent-blue'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
        ) : notifications.length === 0 ? (
          <div className="py-16 text-center text-text-secondary">
            <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-sm">No notifications</p>
            <p className="text-xs mt-1">
              {activeFilter === 'All' ? 'Nothing here yet.' : `No ${activeFilter.toLowerCase()} notifications.`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((n) => {
              const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info;
              const Icon = cfg.icon;
              const isUnread = n.status === 'pending';
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 p-4 group transition-colors hover:bg-white/2 ${isUnread ? 'bg-white/[0.02]' : ''}`}
                >
                  {/* Unread dot */}
                  <div className="mt-0.5 shrink-0">
                    {isUnread
                      ? <span className="block w-2 h-2 rounded-full bg-accent-blue mt-1" />
                      : <span className="block w-2 h-2" />}
                  </div>

                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${isUnread ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>
                      {n.message}
                    </p>
                    <p className="text-xs text-text-secondary mt-0.5">{timeAgo(n.createdAt)}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {isUnread && (
                      <button
                        onClick={() => markReadMutation.mutate(n.id)}
                        title="Mark as read"
                        className="p-1.5 rounded hover:bg-accent-blue/10 text-text-secondary hover:text-accent-blue transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteMutation.mutate(n.id)}
                      title="Delete"
                      className="p-1.5 rounded hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
