import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell, CheckCircle, AlertCircle, AlertTriangle, Info,
  CheckCheck, Trash2, Download, ExternalLink, Filter,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { downloadMarkdownReport } from '../lib/exportReport';

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
  success: { icon: CheckCircle,   color: 'text-green-400',  bg: 'bg-green-500/10',  label: 'Success' },
  error:   { icon: AlertCircle,   color: 'text-red-400',    bg: 'bg-red-500/10',    label: 'Error'   },
  warning: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'Warning' },
  info:    { icon: Info,          color: 'text-blue-400',   bg: 'bg-blue-500/10',   label: 'Info'    },
};

// Map notification types / keywords → actionable deep links
function inferActionLink(message = '', type = '') {
  const m = message.toLowerCase();
  if (m.includes('budget') || m.includes('paused') || m.includes('spend'))
    return { href: '/budget-ai', label: 'View Sentinel' };
  if (m.includes('campaign') && (m.includes('roas') || m.includes('ctr') || m.includes('cpa')))
    return { href: '/budget-ai', label: 'View Sentinel' };
  if (m.includes('audit') || m.includes('seo'))
    return { href: '/seo', label: 'View Beacon' };
  if (m.includes('keyword') || m.includes('rank'))
    return { href: '/seo', label: 'View Beacon' };
  if (m.includes('competitor') || m.includes('hijack') || m.includes('crawl'))
    return { href: '/competitor-hijack', label: 'Open Radar' };
  if (m.includes('scaling') || m.includes('scale') || m.includes('readiness'))
    return { href: '/scaling', label: 'View Apex' };
  if (m.includes('ad') && (m.includes('generat') || m.includes('creat')))
    return { href: '/ads', label: 'Open Forge' };
  return null;
}

// Strip internal [rule:xxx] metadata tags from message
function cleanMessage(message = '') {
  return message.replace(/\[rule:[^\]]*\]/g, '').trim();
}

const FILTERS = ['All', 'Unread', 'Warning', 'Error', 'Success', 'Info'];

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

  const queryParams = () => {
    const p = new URLSearchParams({ limit: '100' });
    if (activeFilter === 'Unread') p.set('status', 'pending');
    else if (activeFilter !== 'All') p.set('type', activeFilter.toLowerCase());
    return p.toString();
  };

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'page', activeFilter],
    queryFn:  () => api.get(`/notifications?${queryParams()}`).then((r) => r.data.data),
    refetchInterval: 30000, // auto-refresh every 30s
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

  // Group by type for summary stats
  const typeCounts = notifications.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Activity Feed</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'} · auto-refreshes every 30s
          </p>
        </div>
        <div className="flex items-center gap-2">
          {notifications.length > 0 && (
            <button
              onClick={() => downloadMarkdownReport('Activity Report', [
                {
                  title: 'Summary',
                  items: [
                    `Unread: ${unreadCount}`,
                    `Warnings: ${typeCounts.warning || 0}`,
                    `Errors: ${typeCounts.error || 0}`,
                    `Total exported: ${notifications.length}`,
                  ],
                },
                {
                  title: 'Activity Log',
                  table: {
                    headers: ['Message', 'Type', 'Read', 'Date'],
                    rows: notifications.map((n) => [
                      cleanMessage(n.message),
                      n.type,
                      n.status === 'read' ? 'Yes' : 'No',
                      new Date(n.createdAt).toLocaleString(),
                    ]),
                  },
                },
              ], 'activity-report')}
              className="flex items-center gap-1.5 btn-secondary text-sm"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          )}
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
      </div>

      {/* Summary stats (only when there's data) */}
      {notifications.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { type: 'warning', label: 'Warnings', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
            { type: 'error',   label: 'Errors',   color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20'       },
            { type: 'success', label: 'Success',  color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20'   },
            { type: 'info',    label: 'Info',     color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20'     },
          ].map(({ type, label, color, bg }) => (
            <button
              key={type}
              onClick={() => setActiveFilter(activeFilter === label ? 'All' : label)}
              className={`rounded-xl border px-3 py-2 text-center transition-colors ${
                activeFilter === label ? bg : 'border-border hover:border-border/80'
              }`}
            >
              <p className={`text-lg font-bold ${color}`}>{typeCounts[type] || 0}</p>
              <p className="text-[11px] text-text-secondary mt-0.5">{label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-border items-center">
        <Filter className="w-3.5 h-3.5 text-text-secondary mr-1 shrink-0" />
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
            <p className="font-medium text-sm">No activity</p>
            <p className="text-xs mt-1">
              {activeFilter === 'All' ? 'Nothing here yet. Activity from Sentinel, Beacon, and Radar will appear here.' : `No ${activeFilter.toLowerCase()} notifications.`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((n) => {
              const cfg     = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info;
              const Icon    = cfg.icon;
              const isUnread = n.status === 'pending';
              const message  = cleanMessage(n.message);
              const action   = inferActionLink(message, n.type);

              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 p-4 group transition-colors hover:bg-white/2 ${isUnread ? 'bg-white/[0.02]' : ''}`}
                >
                  {/* Unread dot */}
                  <div className="mt-1 shrink-0">
                    {isUnread
                      ? <span className="block w-2 h-2 rounded-full bg-accent-blue" />
                      : <span className="block w-2 h-2" />}
                  </div>

                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${isUnread ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>
                      {message}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-xs text-text-secondary">{timeAgo(n.createdAt)}</p>
                      {action && (
                        <Link
                          to={action.href}
                          className="text-xs text-accent-blue hover:underline flex items-center gap-0.5"
                          onClick={() => isUnread && markReadMutation.mutate(n.id)}
                        >
                          {action.label}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </Link>
                      )}
                    </div>
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
