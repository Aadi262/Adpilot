import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert, AlertTriangle, CheckCircle2, Plus, Trash2, ToggleLeft, ToggleRight,
  Zap, Bell, TrendingDown, RefreshCw, X, Clock, Download, ChevronDown, ChevronUp, Activity, Gauge,
} from 'lucide-react';
import { downloadMarkdownReport } from '../lib/exportReport';
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

const HEALTH_STYLES = {
  critical: {
    chip: 'bg-red-500/10 text-red-300 border border-red-500/20',
    ring: 'border-red-500/30',
    icon: AlertTriangle,
    iconClass: 'text-red-400',
  },
  warning: {
    chip: 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/20',
    ring: 'border-yellow-500/30',
    icon: Gauge,
    iconClass: 'text-yellow-400',
  },
  healthy: {
    chip: 'bg-green-500/10 text-green-300 border border-green-500/20',
    ring: 'border-green-500/30',
    icon: CheckCircle2,
    iconClass: 'text-accent-green',
  },
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

function CampaignDossierCard({ campaign, isExpanded, onToggle, onApplyFix }) {
  const healthStyle = HEALTH_STYLES[campaign.health?.level] ?? HEALTH_STYLES.healthy;
  const HealthIcon = healthStyle.icon;

  return (
    <div className={`card border ${healthStyle.ring}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-text-primary truncate">{campaign.name}</p>
              <Badge status={campaign.platform} />
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${healthStyle.chip}`}>
                {campaign.health?.label ?? 'Stable'}
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-1">
              Spend ${campaign.metrics?.spend?.toFixed?.(2) ?? '0.00'} of ${campaign.metrics?.budget?.toFixed?.(2) ?? '0.00'} •
              ROAS {campaign.metrics?.roas ?? 0}x •
              CTR {campaign.metrics?.ctr ?? 0}% •
              Pacing {campaign.pacing?.status ?? 'on-pace'}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-text-secondary">Health</p>
              <div className="flex items-center gap-1.5 justify-end">
                <HealthIcon className={`w-4 h-4 ${healthStyle.iconClass}`} />
                <span className="text-sm font-bold text-text-primary">{campaign.health?.score ?? 0}/100</span>
              </div>
            </div>
            {isExpanded ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronDown className="w-4 h-4 text-text-secondary" />}
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-bg p-3">
              <p className="text-[11px] text-text-secondary">Projected Spend</p>
              <p className="text-base font-semibold text-text-primary">${campaign.pacing?.projectedDailySpend?.toFixed?.(2) ?? '0.00'}</p>
            </div>
            <div className="rounded-xl border border-border bg-bg p-3">
              <p className="text-[11px] text-text-secondary">Budget Utilization</p>
              <p className="text-base font-semibold text-text-primary">{campaign.metrics?.utilization ?? 0}%</p>
            </div>
            <div className="rounded-xl border border-border bg-bg p-3">
              <p className="text-[11px] text-text-secondary">CPA</p>
              <p className="text-base font-semibold text-text-primary">{campaign.metrics?.cpa ? `$${campaign.metrics.cpa}` : 'Unavailable'}</p>
            </div>
            <div className="rounded-xl border border-border bg-bg p-3">
              <p className="text-[11px] text-text-secondary">Active Rules</p>
              <p className="text-base font-semibold text-text-primary">{campaign.protectionState?.activeRules ?? 0}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-bg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-4 h-4 text-accent-blue" />
                  <h3 className="text-sm font-semibold text-text-primary">Evidence & Signals</h3>
                </div>
                {campaign.signals?.length ? (
                  <div className="space-y-2.5">
                    {campaign.signals.map((signal, idx) => (
                      <div key={`${campaign.id}-signal-${idx}`} className={`rounded-lg border px-3 py-2 ${SEVERITY_STYLES[signal.severity] ?? SEVERITY_STYLES.info}`}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-wider">{signal.metric}</p>
                          <span className="text-[10px] uppercase tracking-wider opacity-80">{signal.source?.replace(/_/g, ' ')}</span>
                        </div>
                        <p className="text-sm font-semibold mt-1 text-text-primary">{signal.title}</p>
                        <p className="text-xs text-text-secondary mt-1">{signal.reason}</p>
                        <p className="text-[11px] mt-1 italic opacity-90">{signal.evidence}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">No urgent efficiency or pacing issues were detected for this campaign.</p>
                )}
              </div>

              <div className="rounded-xl border border-border bg-bg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-orange-400" />
                  <h3 className="text-sm font-semibold text-text-primary">Operator Log</h3>
                </div>
                <div className="space-y-2">
                  {(campaign.evidenceLog || []).map((item, idx) => (
                    <div key={`${campaign.id}-evidence-${idx}`} className="text-sm text-text-secondary flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-blue mt-2 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-bg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-accent-green" />
                  <h3 className="text-sm font-semibold text-text-primary">Recommended Actions</h3>
                </div>
                <div className="space-y-2.5">
                  {(campaign.recommendedActions || []).map((action, idx) => (
                    <div key={`${campaign.id}-action-${idx}`} className="rounded-lg border border-border px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-text-primary">{action.label}</p>
                        <span className="text-[10px] uppercase tracking-wider text-text-secondary">{action.priority}</span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">{action.reason}</p>
                      {action.type === 'pause' && (
                        <button
                          onClick={() => onApplyFix(campaign.id)}
                          className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-colors font-medium"
                        >
                          Apply Fix — Pause Campaign
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {campaign.dataGaps?.length > 0 && (
                <div className="rounded-xl border border-border bg-bg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    <h3 className="text-sm font-semibold text-text-primary">Data Gaps</h3>
                  </div>
                  <div className="space-y-2">
                    {campaign.dataGaps.map((gap, idx) => (
                      <p key={`${campaign.id}-gap-${idx}`} className="text-xs text-text-secondary">{gap}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function BudgetProtectionPage() {
  const toast        = useToast();
  const queryClient  = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [expandedCampaignId, setExpandedCampaignId] = useState(null);

  const { data: alertsData, isLoading: loadingAlerts } = useQuery({
    queryKey: ['budget-ai', 'alerts'],
    queryFn:  () => api.get('/budget-ai/alerts').then((r) => r.data.data.alerts),
  });

  const { data: scanData, isLoading: scanning, refetch: runScan } = useQuery({
    queryKey: ['budget-ai', 'scan'],
    queryFn:  () => api.get('/budget-ai/scan').then((r) => r.data.data),
    staleTime: 60_000,
  });

  const {
    data: analyzerData,
    isLoading: loadingAnalyzer,
    refetch: refetchAnalyzer,
  } = useQuery({
    queryKey: ['budget-ai', 'analyzer'],
    queryFn: () => api.get('/budget-ai/analyzer').then((r) => r.data.data),
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
    mutationFn: (campaignId) => api.post('/budget-ai/apply-fix', { campaignId, action: 'pause' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['budget-ai', 'alerts'] });
      queryClient.invalidateQueries({ queryKey: ['budget-ai', 'scan'] });
      queryClient.invalidateQueries({ queryKey: ['budget-ai', 'analyzer'] });
      toast.success('Campaign paused successfully');
    },
    onError: () => toast.error('Failed to pause campaign'),
  });

  const rules       = alertsData ?? [];
  const scan        = scanData;
  const alertCount  = scan?.alerts?.length ?? 0;
  const status      = scan?.status ?? 'healthy';
  const summary     = scan?.summary;
  const anomalies   = scan?.anomalies ?? [];
  const analyzerSummary = analyzerData?.summary;
  const analyzerCampaigns = analyzerData?.campaigns ?? [];
  const globalAnalyzerGaps = analyzerData?.dataGaps ?? [];
  const operatorFeed = analyzerData?.operatorFeed ?? [];

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
            onClick: async () => {
              await Promise.all([runScan(), refetchAnalyzer()]);
            },
            disabled: scanning,
            variant: 'primary',
            icon: RefreshCw,
          },
        ]}
      />

      {/* ── Status Banner ──────────────────────────────────────────────── */}
      {scan && (
        <div className={`border rounded-xl px-5 py-3.5 flex items-center gap-3 ${statusBanner.bg} ${status === 'critical' ? 'sentinel-pulse' : ''}`}>
          <statusBanner.icon className={`w-5 h-5 ${statusBanner.iconClass}`} />
          <span className={`text-sm font-semibold ${statusBanner.textClass}`}>{statusBanner.text}</span>
          {(scan.campaignCount != null || scan.campaignsScanned != null) && (
            <span className="ml-auto text-xs text-text-secondary">{scan.campaignCount ?? scan.campaignsScanned} campaigns scanned</span>
          )}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card">
            <p className="text-xs text-text-secondary">Daily Spend</p>
            <p className="text-lg font-bold text-text-primary">${Number(summary.dailySpend || 0).toFixed(2)}</p>
          </div>
          <div className="card">
            <p className="text-xs text-text-secondary">Daily Budget</p>
            <p className="text-lg font-bold text-text-primary">${Number(summary.dailyBudget || 0).toFixed(2)}</p>
          </div>
          <div className="card">
            <p className="text-xs text-text-secondary">Spend Velocity</p>
            <p className="text-lg font-bold text-text-primary">{summary.spendVelocity ?? 0}%</p>
          </div>
          <div className="card">
            <p className="text-xs text-text-secondary">Blended CPA</p>
            <p className="text-lg font-bold text-text-primary">{summary.blendedCpa != null ? `$${summary.blendedCpa}` : '—'}</p>
          </div>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Live Campaign Analyzer</h2>
            <p className="text-xs text-text-secondary mt-1">Operator-grade dossiers for every campaign with pacing, evidence, and recommended actions.</p>
          </div>
          {analyzerSummary && (
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-text-secondary">At-Risk Budget</p>
              <p className="text-sm font-semibold text-text-primary">${Number(analyzerSummary.atRiskBudget || 0).toFixed(2)}</p>
            </div>
          )}
        </div>

        {loadingAnalyzer ? (
          <div className="p-5 space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
          </div>
        ) : analyzerCampaigns.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No campaigns available to analyze"
            description="Create or activate campaigns to unlock live pacing, risk scoring, and recommended operator actions."
            color="blue"
            compact
          />
        ) : (
          <div className="p-5 space-y-4">
            {analyzerSummary && (
              <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
                <div className="rounded-xl border border-border bg-bg p-3">
                  <p className="text-[11px] text-text-secondary">Active Campaigns</p>
                  <p className="text-base font-semibold text-text-primary">{analyzerSummary.activeCampaigns}</p>
                </div>
                <div className="rounded-xl border border-border bg-bg p-3">
                  <p className="text-[11px] text-text-secondary">Critical</p>
                  <p className="text-base font-semibold text-red-300">{analyzerSummary.criticalCampaigns}</p>
                </div>
                <div className="rounded-xl border border-border bg-bg p-3">
                  <p className="text-[11px] text-text-secondary">Warnings</p>
                  <p className="text-base font-semibold text-yellow-300">{analyzerSummary.warningCampaigns}</p>
                </div>
                <div className="rounded-xl border border-border bg-bg p-3">
                  <p className="text-[11px] text-text-secondary">Protected Budget</p>
                  <p className="text-base font-semibold text-text-primary">${Number(analyzerSummary.protectedBudget || 0).toFixed(2)}</p>
                </div>
                <div className="rounded-xl border border-border bg-bg p-3">
                  <p className="text-[11px] text-text-secondary">Utilization</p>
                  <p className="text-base font-semibold text-text-primary">{analyzerSummary.utilization ?? 0}%</p>
                </div>
              </div>
            )}

            {operatorFeed.length > 0 && (
              <div className="rounded-xl border border-border bg-bg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-orange-400" />
                  <h3 className="text-sm font-semibold text-text-primary">Operator Feed</h3>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
                  {operatorFeed.slice(0, 6).map((item, idx) => (
                    <div key={`${item.campaignId}-${idx}`} className="rounded-lg border border-border px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-text-primary">{item.label}</p>
                        <Badge status={item.platform} />
                      </div>
                      <p className="text-xs text-text-secondary mt-1">{item.campaignName}</p>
                      <p className="text-xs text-text-secondary mt-1">{item.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {analyzerCampaigns.map((campaign) => (
                <CampaignDossierCard
                  key={campaign.id}
                  campaign={campaign}
                  isExpanded={expandedCampaignId === campaign.id}
                  onToggle={() => setExpandedCampaignId((current) => current === campaign.id ? null : campaign.id)}
                  onApplyFix={(campaignId) => applyFixMutation.mutate(campaignId)}
                />
              ))}
            </div>

            {globalAnalyzerGaps.length > 0 && (
              <div className="rounded-xl border border-border bg-bg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  <h3 className="text-sm font-semibold text-text-primary">Team-Level Data Gaps</h3>
                </div>
                <div className="space-y-2">
                  {globalAnalyzerGaps.map((gap, idx) => (
                    <p key={`global-gap-${idx}`} className="text-xs text-text-secondary">
                      {gap.message} ({gap.campaignsAffected} campaign{gap.campaignsAffected !== 1 ? 's' : ''})
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {anomalies.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-text-primary mb-3">Detected Anomalies</h2>
          <div className="space-y-2">
            {anomalies.map((anomaly, idx) => (
              <div key={idx} className="text-sm text-text-secondary flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                {anomaly.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Active Alerts ──────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-text-primary mb-3">Active Alerts</h2>
        {scanning ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
          </div>
        ) : (scan?.campaignCount ?? 0) === 0 ? (
          <div className="card p-0">
            <EmptyState
              icon={ShieldAlert}
              title="No active campaigns to monitor"
              description="Activate your first campaign to start monitoring spend, CPA, and overspend risk."
              color="blue"
              compact
            />
          </div>
        ) : (scan?.alerts ?? []).length === 0 ? (
          <div className="card p-0">
            <EmptyState
              icon={CheckCircle2}
              title="All campaigns healthy"
              description="No active budget issues detected. Sentinel is still tracking spend velocity, CPA, and overspend risk."
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
          <div className="flex items-center gap-2">
            {(rules.length > 0 || analyzerCampaigns.length > 0) && (
              <button
                onClick={() => downloadMarkdownReport('Budget Protection Report', [
                  analyzerSummary ? {
                    title: 'Live Campaign Analyzer',
                    items: [
                      `Active campaigns: ${analyzerSummary.activeCampaigns}`,
                      `Critical campaigns: ${analyzerSummary.criticalCampaigns}`,
                      `Warning campaigns: ${analyzerSummary.warningCampaigns}`,
                      `Protected budget: $${analyzerSummary.protectedBudget}`,
                      `At-risk budget: $${analyzerSummary.atRiskBudget}`,
                      `Budget utilization: ${analyzerSummary.utilization}%`,
                    ],
                  } : null,
                  operatorFeed.length ? {
                    title: 'Operator Feed',
                    table: {
                      headers: ['Campaign', 'Action', 'Priority', 'Automatable', 'Reason'],
                      rows: operatorFeed.slice(0, 10).map((item) => [
                        item.campaignName,
                        item.label,
                        item.priority,
                        item.automatable ? 'Yes' : 'No',
                        item.reason,
                      ]),
                    },
                  } : null,
                  analyzerCampaigns.length ? {
                    title: 'Campaign Dossiers',
                    table: {
                      headers: ['Campaign', 'Health', 'Spend', 'Budget', 'ROAS', 'CTR', 'CPA', 'Pacing'],
                      rows: analyzerCampaigns.map((campaign) => [
                        campaign.name,
                        `${campaign.health?.score ?? 0}/100 ${campaign.health?.label ?? 'Stable'}`,
                        campaign.metrics?.spend ?? 0,
                        campaign.metrics?.budget ?? 0,
                        campaign.metrics?.roas ?? 0,
                        campaign.metrics?.ctr ?? 0,
                        campaign.metrics?.cpa ?? 0,
                        campaign.pacing?.status ?? 'on-pace',
                      ]),
                    },
                  } : null,
                  {
                    title: 'Scan Summary',
                    items: [
                      `Rules configured: ${rules.length}`,
                      `Alerts in latest scan: ${(scan?.alerts ?? []).length}`,
                      `Daily spend: ${scan?.summary?.dailySpend ?? 'Unavailable'}`,
                      `Weekly spend: ${scan?.summary?.weeklySpend ?? 'Unavailable'}`,
                      `Monthly spend: ${scan?.summary?.monthlySpend ?? 'Unavailable'}`,
                    ],
                  },
                  {
                    title: 'Alert Rules',
                    table: {
                      headers: ['Campaign', 'Type', 'Threshold', 'Action', 'Active', 'Triggered'],
                      rows: rules.map((r) => [
                        r.campaign?.name ?? 'Unknown',
                        ALERT_TYPE_LABELS[r.alertType] ?? r.alertType,
                        r.threshold,
                        ACTION_LABELS[r.action] ?? r.action,
                        r.isActive ? 'Yes' : 'No',
                        r.triggeredAt ? new Date(r.triggeredAt).toLocaleString() : 'Never',
                      ]),
                    },
                  },
                ].filter(Boolean), 'budget-protection-report')}
                className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-2"
              >
                <Download className="w-3.5 h-3.5" />Report
              </button>
            )}
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary text-xs flex items-center gap-1.5 px-3 py-1.5"
            >
              <Plus className="w-3.5 h-3.5" />Add Rule
            </button>
          </div>
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
