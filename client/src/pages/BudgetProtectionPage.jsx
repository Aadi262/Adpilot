import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert, AlertTriangle, CheckCircle2, Plus, Trash2, ToggleLeft, ToggleRight,
  Zap, Bell, TrendingDown, RefreshCw, X, Clock,
} from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../components/ui/Toast';
import Badge from '../components/ui/Badge';
import FeatureHeader from '../components/ui/FeatureHeader';
import EmptyState from '../components/ui/EmptyState';
import { FEATURES } from '../config/features';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const secs = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (secs < 60)    return 'just now';
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

const ALERT_TYPE_LABELS = {
  roas_drop:    'ROAS Drop',
  ctr_collapse: 'CTR Collapse',
  cpa_spike:    'CPA Spike',
  budget_bleed: 'Budget Bleed',
};

const ACTION_LABELS = {
  pause:          'Pause campaign',
  notify:         'Notify team',
  reduce_budget:  'Reduce budget',
};

const SEVERITY_STYLES = {
  critical: 'bg-red-500/10 border-red-500/30 text-red-400',
  warning:  'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  info:     'bg-blue-500/10 border-blue-500/30 text-blue-400',
};

// ─── Add Alert Rule Modal ─────────────────────────────────────────────────────
function AddAlertModal({ campaigns, onClose, onSave }) {
  const [form, setForm] = useState({
    campaignId: '',
    alertType:  'roas_drop',
    threshold:  '',
    action:     'notify',
    actionValue: '',
  });

  const thresholdLabel = {
    roas_drop:    'Min ROAS (e.g. 2.5)',
    ctr_collapse: 'Min CTR % (e.g. 1.5)',
    cpa_spike:    'Max CPA $ (e.g. 35)',
    budget_bleed: 'Max utilization % (e.g. 95)',
  }[form.alertType];

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
      <div className="bg-bg-card border border-border rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-text-primary">Add Alert Rule</h3>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><X className="w-4 h-4" /></button>
        </div>

        <div>
          <label className="text-xs text-text-secondary mb-1 block">Campaign</label>
          <select className="input-field w-full" value={form.campaignId} onChange={set('campaignId')}>
            <option value="">Select campaign…</option>
            {(campaigns ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-text-secondary mb-1 block">Alert Type</label>
          <select className="input-field w-full" value={form.alertType} onChange={set('alertType')}>
            <option value="roas_drop">ROAS Drop</option>
            <option value="ctr_collapse">CTR Collapse</option>
            <option value="cpa_spike">CPA Spike</option>
            <option value="budget_bleed">Budget Bleed</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-text-secondary mb-1 block">Threshold — {thresholdLabel}</label>
          <input
            type="number"
            className="input-field w-full"
            placeholder={thresholdLabel}
            value={form.threshold}
            onChange={set('threshold')}
            step="0.1"
          />
        </div>

        <div>
          <label className="text-xs text-text-secondary mb-1 block">Action</label>
          <select className="input-field w-full" value={form.action} onChange={set('action')}>
            <option value="pause">Pause campaign</option>
            <option value="notify">Notify team</option>
            <option value="reduce_budget">Reduce budget</option>
          </select>
        </div>

        {form.action === 'reduce_budget' && (
          <div>
            <label className="text-xs text-text-secondary mb-1 block">Reduce by % (e.g. 20)</label>
            <input
              type="number"
              className="input-field w-full"
              placeholder="20"
              value={form.actionValue}
              onChange={set('actionValue')}
              min="1"
              max="100"
            />
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary text-sm px-4">Cancel</button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.campaignId || !form.threshold}
            className="btn-primary text-sm px-4"
          >
            Save Rule
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Alert Card ───────────────────────────────────────────────────────────────
function AlertCard({ alert, onApplyFix }) {
  return (
    <div className={`border rounded-xl p-4 space-y-2 ${SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.warning}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider">{alert.severity}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-black/20 font-medium">
            {ALERT_TYPE_LABELS[alert.alertType] ?? alert.alertType}
          </span>
        </div>
        <Badge status={alert.platform} />
      </div>
      <p className="text-sm font-semibold text-text-primary">{alert.campaignName}</p>
      <p className="text-xs text-text-secondary">{alert.detail}</p>
      <p className="text-xs italic">{alert.recommendedAction}</p>
      {alert.action === 'pause' && (
        <button
          onClick={() => onApplyFix(alert)}
          className="mt-1 text-xs px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-colors font-medium"
        >
          Apply Fix — Pause Campaign
        </button>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function BudgetProtectionPage() {
  const toast        = useToast();
  const queryClient  = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const { data: alertsData, isLoading: loadingAlerts } = useQuery({
    queryKey: ['budget-ai', 'alerts'],
    queryFn:  () => api.get('/budget-ai/alerts').then((r) => r.data.data.alerts),
  });

  const { data: scanData, isLoading: scanning, refetch: runScan } = useQuery({
    queryKey: ['budget-ai', 'scan'],
    queryFn:  () => api.get('/budget-ai/scan').then((r) => r.data.data),
    staleTime: 60_000,
  });

  const { data: campaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn:  () => api.get('/campaigns').then((r) => r.data.data.campaigns),
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/budget-ai/alerts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-ai'] });
      setShowModal(false);
      toast.success('Alert rule created');
    },
    onError: (err) => toast.error(err?.response?.data?.error?.message || 'Failed to create rule'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }) => api.patch(`/budget-ai/alerts/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budget-ai', 'alerts'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/budget-ai/alerts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-ai', 'alerts'] });
      toast.success('Rule deleted');
    },
  });

  const applyFixMutation = useMutation({
    mutationFn: (campaignId) => api.post(`/campaigns/${campaignId}/pause`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['budget-ai', 'scan'] });
      toast.success('Campaign paused successfully');
    },
    onError: () => toast.error('Failed to pause campaign'),
  });

  const rules       = alertsData ?? [];
  const scan        = scanData;
  const alertCount  = scan?.alerts?.length ?? 0;
  const status      = scan?.status ?? 'healthy';

  const statusBanner = status === 'critical'
    ? { bg: 'bg-red-500/10 border-red-500/30', icon: AlertTriangle, iconClass: 'text-red-400', text: `Critical: ${alertCount} campaign${alertCount !== 1 ? 's' : ''} bleeding budget`, textClass: 'text-red-300' }
    : status === 'warning'
    ? { bg: 'bg-yellow-500/10 border-yellow-500/30', icon: AlertTriangle, iconClass: 'text-yellow-400', text: `${alertCount} warning${alertCount !== 1 ? 's' : ''} detected`, textClass: 'text-yellow-300' }
    : { bg: 'bg-green-500/10 border-green-500/30', icon: CheckCircle2, iconClass: 'text-accent-green', text: 'All campaigns healthy', textClass: 'text-accent-green' };

  const feature = FEATURES.sentinel;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ── Feature Header ──────────────────────────────────────────────── */}
      <FeatureHeader
        codename={feature.codename}
        label={feature.label}
        description={feature.description}
        color={feature.color}
        icon={ShieldAlert}
        badge={feature.badge}
        stats={feature.stats}
        status={scan?.scannedAt ? `Last scan: ${timeAgo(scan.scannedAt)}` : undefined}
        actions={[
          {
            label: scanning ? 'Scanning…' : 'Scan Now',
            onClick: () => runScan(),
            disabled: scanning,
            variant: 'primary',
            icon: RefreshCw,
          },
        ]}
      />

      {/* ── Status Banner ──────────────────────────────────────────────── */}
      {scan && (
        <div className={`border rounded-xl px-5 py-3.5 flex items-center gap-3 ${statusBanner.bg}`}>
          <statusBanner.icon className={`w-5 h-5 ${statusBanner.iconClass}`} />
          <span className={`text-sm font-semibold ${statusBanner.textClass}`}>{statusBanner.text}</span>
          {scan.campaignsScanned != null && (
            <span className="ml-auto text-xs text-text-secondary">{scan.campaignsScanned} campaigns scanned</span>
          )}
        </div>
      )}

      {/* ── Active Alerts ──────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-text-primary mb-3">Active Alerts</h2>
        {scanning ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
          </div>
        ) : (scan?.alerts ?? []).length === 0 ? (
          <div className="card p-0">
            <EmptyState
              icon={CheckCircle2}
              title="All campaigns healthy"
              description="No budget issues detected. Run a scan or create alert rules below to continuously monitor performance."
              color="green"
              compact
            />
          </div>
        ) : (
          <div className="space-y-3">
            {(scan?.alerts ?? []).map((alert, i) => (
              <AlertCard
                key={i}
                alert={alert}
                onApplyFix={(a) => applyFixMutation.mutate(a.campaignId)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Alert Rules ────────────────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">Alert Rules</h2>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary text-xs flex items-center gap-1.5 px-3 py-1.5"
          >
            <Plus className="w-3.5 h-3.5" />Add Rule
          </button>
        </div>

        {loadingAlerts ? (
          <div className="p-5 space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-14 rounded-lg" />)}
          </div>
        ) : rules.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No alert rules yet"
            description="Add your first alert rule to start automatically protecting campaigns from budget bleeding."
            color="red"
            compact
          />
        ) : (
          <div className="divide-y divide-border">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {rule.campaign?.name ?? 'Unknown campaign'}
                    </p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                      {ALERT_TYPE_LABELS[rule.alertType] ?? rule.alertType}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Threshold: {rule.threshold} → {ACTION_LABELS[rule.action] ?? rule.action}
                    {rule.actionValue != null ? ` (${rule.actionValue}%)` : ''}
                  </p>
                  {rule.triggeredAt && (
                    <p className="text-[10px] text-text-secondary mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />Last triggered: {timeAgo(rule.triggeredAt)}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleMutation.mutate({ id: rule.id, isActive: !rule.isActive })}
                    className="text-text-secondary hover:text-text-primary transition-colors"
                    title={rule.isActive ? 'Disable rule' : 'Enable rule'}
                  >
                    {rule.isActive
                      ? <ToggleRight className="w-5 h-5 text-accent-green" />
                      : <ToggleLeft  className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(rule.id)}
                    className="p-1.5 rounded hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-text-primary mb-3">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { step: '1', title: 'Monitor', desc: 'AI scans your active campaigns every 15 minutes for performance degradation', icon: Bell, color: 'text-accent-blue', bg: 'bg-accent-blue/10' },
            { step: '2', title: 'Detect',  desc: 'Compares real-time metrics against your configured thresholds and baselines', icon: TrendingDown, color: 'text-orange-400', bg: 'bg-orange-500/10' },
            { step: '3', title: 'Act',     desc: 'Automatically pauses campaigns, sends alerts, or reduces budgets to protect ROI', icon: Zap, color: 'text-accent-green', bg: 'bg-accent-green/10' },
          ].map((s) => (
            <div key={s.step} className="card">
              <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className="text-xs text-text-secondary mb-0.5">Step {s.step}</p>
              <p className="text-sm font-semibold text-text-primary">{s.title}</p>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <AddAlertModal
          campaigns={campaigns ?? []}
          onClose={() => setShowModal(false)}
          onSave={(data) => createMutation.mutate(data)}
        />
      )}
    </div>
  );
}
