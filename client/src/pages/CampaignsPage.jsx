import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Play, Pause, Trash2, Filter, X, AlertCircle, Download, ChevronRight, TrendingUp, TrendingDown, BarChart3, Loader2, ExternalLink } from 'lucide-react';
import api from '../lib/api';
import Badge from '../components/ui/Badge';
import CreateCampaignModal from '../components/campaigns/CreateCampaignModal';
import { downloadMarkdownReport } from '../lib/exportReport';

function SkeletonRow() {
  return (
    <tr>
      {[...Array(6)].map((_, i) => (
        <td key={i} className="py-3 pr-4">
          <div className="skeleton h-5 rounded w-24" />
        </td>
      ))}
    </tr>
  );
}

function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
      <div className="bg-bg-card border border-border rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-sm p-6">
        <h3 className="text-base font-semibold text-text-primary mb-2">{title}</h3>
        <p className="text-sm text-text-secondary mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="btn-secondary text-sm px-4">Cancel</button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Mini SVG chart ────────────────────────────────────────────────────────────
function MiniChart({ points = [], color = '#10b981', height = 56, width = '100%' }) {
  if (points.length < 2) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>No data yet</span>
      </div>
    );
  }
  const max = Math.max(...points, 0.01);
  const min = Math.min(...points, 0);
  const range = max - min || 0.01;
  const W = 300; const H = height;
  const pts = points.map((v, i) => {
    const x = (i / (points.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const areaClose = `${W},${H} 0,${H}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width, height, display: 'block' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${pts} ${areaClose}`} fill="url(#cg)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Campaign Detail Drawer ────────────────────────────────────────────────────
function CampaignDetailDrawer({ campaign, onClose }) {
  const [metric, setMetric] = useState('spend');

  const { data, isLoading } = useQuery({
    queryKey: ['campaign-snapshots', campaign.id],
    queryFn: () => api.get(`/campaigns/${campaign.id}/snapshots?days=7`).then(r => r.data.data),
    staleTime: 60_000,
  });

  const snapshots  = data?.snapshots ?? [];
  const summary    = data?.summary;
  const hasData    = data?.hasData;
  const points     = snapshots.map(s => s[metric] ?? 0);
  const labels     = snapshots.map(s => s.label);

  const perf = campaign.performance || {};
  const metricColor = metric === 'roas' ? '#10b981' : metric === 'ctr' ? '#60a5fa' : metric === 'cpa' ? '#f59e0b' : '#8b5cf6';

  const METRICS = [
    { key: 'spend', label: 'Spend' },
    { key: 'roas',  label: 'ROAS' },
    { key: 'ctr',   label: 'CTR' },
    { key: 'cpa',   label: 'CPA' },
  ];

  const fmt = (key, val) => {
    if (val == null || val === 0) return '—';
    if (key === 'spend') return `$${Number(val).toFixed(0)}`;
    if (key === 'roas')  return `${Number(val).toFixed(2)}x`;
    if (key === 'ctr')   return `${Number(val).toFixed(2)}%`;
    if (key === 'cpa')   return `$${Number(val).toFixed(2)}`;
    return String(val);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }}
      />
      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '100%', maxWidth: 440,
        background: '#0d0f1a',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRight: 'none',
        zIndex: 50,
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.9)', lineHeight: 1.3 }}>
              {campaign.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: 'rgba(139,92,246,0.15)', color: '#a78bfa', letterSpacing: '0.06em',
              }}>
                {campaign.platform?.toUpperCase()}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: campaign.status === 'active' ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.06)',
                color: campaign.status === 'active' ? '#10b981' : 'rgba(255,255,255,0.4)',
              }}>
                {campaign.status?.toUpperCase()}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} color="rgba(255,255,255,0.4)" />
          </button>
        </div>

        {/* Budget strip */}
        <div style={{ padding: '14px 24px', background: 'rgba(255,255,255,0.025)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 32 }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Budget</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.88)', marginTop: 2 }}>
              ${Number(campaign.budget || 0).toLocaleString()}
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 400, marginLeft: 4 }}>/ {campaign.budgetType}</span>
            </div>
          </div>
          {summary && (
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>7d Spend</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981', marginTop: 2 }}>
                ${summary.totalSpend?.toFixed(0) ?? '—'}
              </div>
            </div>
          )}
        </div>

        {/* Chart section */}
        <div style={{ padding: '18px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <BarChart3 size={13} color="rgba(255,255,255,0.4)" />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>7-Day Performance</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {METRICS.map(m => (
                <button
                  key={m.key}
                  onClick={() => setMetric(m.key)}
                  style={{
                    padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: metric === m.key ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${metric === m.key ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    color: metric === m.key ? '#a78bfa' : 'rgba(255,255,255,0.45)',
                    cursor: 'pointer',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Loader2 size={18} color="rgba(255,255,255,0.3)" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
              <MiniChart points={points} color={metricColor} height={72} />
              {labels.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px 6px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  {[labels[0], labels[Math.floor(labels.length / 2)], labels[labels.length - 1]].filter(Boolean).map((l, i) => (
                    <span key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>{l}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Summary KPIs from snapshots */}
        {(summary || (!isLoading && !hasData)) && (
          <div style={{ padding: '0 24px 18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Avg ROAS',    value: fmt('roas', summary?.avgRoas) },
                { label: 'Avg CTR',     value: fmt('ctr',  summary?.avgCtr) },
                { label: 'Avg CPA',     value: fmt('cpa',  summary?.avgCpa) },
                { label: 'Conversions', value: summary?.totalConversions ?? '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10, padding: '11px 14px',
                }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginTop: 3 }}>{value}</div>
                </div>
              ))}
            </div>
            {!hasData && (
              <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', fontSize: 11, color: 'rgba(245,158,11,0.8)' }}>
                No metric snapshots yet. Sync your ad platform to see real data.
              </div>
            )}
          </div>
        )}

        {/* Stored performance fallback if no snapshots */}
        {!isLoading && !hasData && (perf.spend || perf.roas || perf.clicks) && (
          <div style={{ padding: '0 24px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
              Last Synced Data
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Spend',   value: perf.spend   ? `$${Number(perf.spend).toFixed(0)}`   : '—' },
                { label: 'ROAS',    value: perf.roas    ? `${Number(perf.roas).toFixed(2)}x`    : '—' },
                { label: 'Clicks',  value: perf.clicks  ? Number(perf.clicks).toLocaleString()  : '—' },
                { label: 'CTR',     value: perf.ctr     ? `${Number(perf.ctr).toFixed(2)}%`     : '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 10, padding: '11px 14px',
                }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.65)', marginTop: 3 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick links */}
        <div style={{ padding: '0 24px 24px', marginTop: 'auto' }}>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'View Scaling Analysis', href: '/scaling' },
              { label: 'Check Budget Protection', href: '/budget-ai' },
            ].map(({ label, href }) => (
              <a key={href} href={href} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600,
                textDecoration: 'none',
              }}>
                {label}
                <ExternalLink size={12} color="rgba(255,255,255,0.3)" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function CampaignsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters] = useState({ platform: '', status: '' });
  const [pendingDelete, setPendingDelete] = useState(null); // { id, name }
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.platform) params.append('platform', filters.platform);
      if (filters.status) params.append('status', filters.status);
      return api.get(`/campaigns?${params}`).then((r) => r.data.data.campaigns);
    },
  });

  const launchMutation = useMutation({
    mutationFn: (id) => api.post(`/campaigns/${id}/launch`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  });

  const pauseMutation = useMutation({
    mutationFn: (id) => api.post(`/campaigns/${id}/pause`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/campaigns/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['campaigns'] }); setPendingDelete(null); },
  });

  const ActionButtons = ({ c }) => (
    <div className="flex items-center gap-1.5">
      {c.status !== 'active' && (
        <button
          onClick={() => launchMutation.mutate(c.id)}
          disabled={launchMutation.isPending}
          title="Launch"
          className="p-1.5 text-accent-green hover:bg-accent-green/10 rounded-lg transition-colors"
        >
          <Play className="w-3.5 h-3.5" />
        </button>
      )}
      {c.status === 'active' && (
        <button
          onClick={() => pauseMutation.mutate(c.id)}
          disabled={pauseMutation.isPending}
          title="Pause"
          className="p-1.5 text-orange-400 hover:bg-orange-400/10 rounded-lg transition-colors"
        >
          <Pause className="w-3.5 h-3.5" />
        </button>
      )}
      <button
        onClick={() => setPendingDelete({ id: c.id, name: c.name })}
        title="Delete"
        className="p-1.5 text-text-secondary hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-bg-card border border-border rounded-lg px-3 py-2">
            <Filter className="w-4 h-4 text-text-secondary" />
            <select
              className="bg-transparent text-sm text-text-secondary focus:outline-none"
              value={filters.platform}
              onChange={(e) => setFilters({ ...filters, platform: e.target.value })}
            >
              <option value="">All Platforms</option>
              <option value="meta">Meta</option>
              <option value="google">Google</option>
              <option value="both">Both</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-bg-card border border-border rounded-lg px-3 py-2">
            <select
              className="bg-transparent text-sm text-text-secondary focus:outline-none"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {campaigns?.length > 0 && (
            <button
              onClick={() => downloadMarkdownReport('Campaigns Report', [
                {
                  title: 'Summary',
                  items: [
                    `Campaign count: ${campaigns.length}`,
                    `Platform filter: ${filters.platform || 'All platforms'}`,
                    `Status filter: ${filters.status || 'All statuses'}`,
                  ],
                },
                {
                  title: 'Campaign Inventory',
                  table: {
                    headers: ['Name', 'Platform', 'Status', 'Budget', 'Budget Type', 'Created'],
                    rows: campaigns.map((c) => [
                      c.name,
                      c.platform,
                      c.status,
                      Number(c.budget),
                      c.budgetType,
                      new Date(c.createdAt).toLocaleDateString(),
                    ]),
                  },
                },
              ], 'campaigns-report')}
              className="hidden sm:flex items-center gap-2 btn-secondary"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          )}
          {/* Desktop button — hidden on mobile (FAB used instead) */}
          <button
            onClick={() => setShowModal(true)}
            className="hidden sm:flex items-center gap-2 btn-primary"
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </button>
        </div>
      </div>

      {/* ── Mobile card list (< sm) ─────────────────────────────────────── */}
      <div className="sm:hidden space-y-3">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="card space-y-3">
              <div className="skeleton h-5 rounded w-3/4" />
              <div className="skeleton h-4 rounded w-1/2" />
              <div className="grid grid-cols-2 gap-3">
                <div className="skeleton h-8 rounded" />
                <div className="skeleton h-8 rounded" />
              </div>
            </div>
          ))
        ) : (campaigns || []).length === 0 ? (
          <div className="card text-center py-10 text-text-secondary text-sm">
            <p className="text-base font-medium mb-1">No campaigns found</p>
            <p>Tap the + button to create your first campaign.</p>
          </div>
        ) : (
          (campaigns || []).map((c) => (
            <div key={c.id} className="card cursor-pointer" onClick={() => setSelectedCampaign(c)}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 mr-2">
                  <p className="font-semibold text-text-primary truncate">{c.name}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge status={c.platform} />
                    <Badge status={c.status} showDot />
                  </div>
                </div>
                <div onClick={e => e.stopPropagation()}>
                  <ActionButtons c={c} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs border-t border-border pt-3">
                <div>
                  <p className="text-text-secondary">Budget</p>
                  <p className="text-text-primary font-medium mt-0.5">
                    ${Number(c.budget).toLocaleString()} <span className="opacity-60">/ {c.budgetType}</span>
                  </p>
                </div>
                <div>
                  <p className="text-text-secondary">Created</p>
                  <p className="text-text-primary mt-0.5">{new Date(c.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Desktop table (≥ sm) ───────────────────────────────────────── */}
      <div className="hidden sm:block card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-secondary/50">
                {['Name', 'Platform', 'Status', 'Budget', 'Created', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className="text-left text-text-secondary font-medium px-5 py-3.5 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading
                ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                : (campaigns || []).map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCampaign(c)}
                      className="hover:bg-bg-secondary/30 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3.5 font-medium text-text-primary max-w-[200px] truncate">
                        <span className="flex items-center gap-1.5">
                          {c.name}
                          <ChevronRight className="w-3 h-3 text-text-secondary opacity-0 group-hover:opacity-100" />
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge status={c.platform} />
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge status={c.status} showDot />
                      </td>
                      <td className="px-5 py-3.5 text-text-secondary whitespace-nowrap">
                        ${Number(c.budget).toLocaleString()}{' '}
                        <span className="text-xs opacity-60">/ {c.budgetType}</span>
                      </td>
                      <td className="px-5 py-3.5 text-text-secondary whitespace-nowrap">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                        <ActionButtons c={c} />
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>

          {!isLoading && (!campaigns || campaigns.length === 0) && (
            <div className="text-center py-16 text-text-secondary">
              <p className="text-lg font-medium mb-1">No campaigns found</p>
              <p className="text-sm">Create your first campaign to get started.</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile FAB */}
      <button
        onClick={() => setShowModal(true)}
        className="sm:hidden fixed bottom-6 right-6 w-14 h-14 rounded-full btn-primary shadow-2xl
                   flex items-center justify-center z-10"
      >
        <Plus className="w-6 h-6" />
      </button>

      {showModal && <CreateCampaignModal onClose={() => setShowModal(false)} />}

      {selectedCampaign && (
        <CampaignDetailDrawer
          campaign={selectedCampaign}
          onClose={() => setSelectedCampaign(null)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete campaign?"
          message={`"${pendingDelete.name}" will be permanently deleted. This cannot be undone.`}
          onConfirm={() => deleteMutation.mutate(pendingDelete.id)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
