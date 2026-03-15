import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp, CheckCircle2, AlertTriangle, XCircle,
  Sparkles, ChevronRight, RefreshCw, Wifi, WifiOff,
} from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../components/ui/Toast';
import Badge from '../components/ui/Badge';
import FeatureHeader from '../components/ui/FeatureHeader';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonFeatureCard } from '../components/ui/Skeleton';
import { FEATURES } from '../config/features';

// ─── Score gauge (SVG circle) ─────────────────────────────────────────────────
function ScoreGauge({ score }) {
  const r   = 32;
  const circ = 2 * Math.PI * r;
  const pct  = score / 100;
  const color = score >= 70 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';

  return (
    <div className="relative w-20 h-20 flex items-center justify-center mx-auto">
      <svg width="80" height="80" className="-rotate-90">
        <circle cx="40" cy="40" r={r} stroke="#1A1E2E" strokeWidth="6" fill="none" />
        <circle
          cx="40" cy="40" r={r}
          stroke={color}
          strokeWidth="6"
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-text-primary" style={{ color }}>{score}</span>
        <span className="text-[9px] text-text-secondary -mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

// ─── Factor bar ───────────────────────────────────────────────────────────────
function FactorBar({ factor }) {
  const barColor = factor.impact === 'positive' ? 'bg-accent-green'
                 : factor.impact === 'negative' ? 'bg-red-400'
                 : 'bg-accent-blue';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-primary font-medium">{factor.name}</span>
        <span className="text-text-secondary">{factor.score}/100</span>
      </div>
      <div className="h-1.5 bg-bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-500`}
          style={{ width: `${factor.score}%` }}
        />
      </div>
      <p className="text-[11px] text-text-secondary">{factor.detail}</p>
    </div>
  );
}

// ─── Platform Signal row ──────────────────────────────────────────────────────
function PlatformSignalRow({ signal }) {
  const statusColor = signal.status === 'positive' ? 'text-accent-green'
                    : signal.status === 'critical'  ? 'text-red-400'
                    : signal.status === 'warning'   ? 'text-yellow-400'
                    : signal.status === 'missing'   ? 'text-text-secondary'
                    : 'text-accent-blue';
  const Icon = signal.status === 'missing' ? WifiOff : Wifi;

  return (
    <div className="flex items-start gap-2">
      <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${statusColor}`} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-primary">{signal.name}</span>
          {signal.value && (
            <span className={`text-xs font-bold ${statusColor}`}>{signal.value}</span>
          )}
        </div>
        <p className="text-[11px] text-text-secondary leading-relaxed mt-0.5">{signal.detail}</p>
      </div>
    </div>
  );
}

// ─── Confirm Scale Dialog ─────────────────────────────────────────────────────
function ConfirmScaleDialog({ campaign, onConfirm, onCancel }) {
  const [pct, setPct] = useState(String(campaign.safeScaleRange?.min ?? 15));
  const currentBudget = parseFloat(campaign.budget ?? 0);
  const parsedPct     = parseFloat(pct);
  const newBudget     = !isNaN(parsedPct) && currentBudget > 0
    ? (currentBudget * (1 + parsedPct / 100)).toFixed(2)
    : null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
      <div className="bg-bg-card border border-border rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-sm p-6 space-y-4">
        <h3 className="text-base font-semibold text-text-primary">Scale Campaign Budget</h3>
        <p className="text-sm text-text-secondary">
          Increase <span className="text-text-primary font-medium">{campaign.campaignName}</span> daily budget by:
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            className="input-field w-24"
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            min="1"
            max="100"
          />
          <span className="text-sm text-text-secondary">%</span>
          <span className="text-xs text-text-secondary ml-auto">
            Apex safe range: {campaign.safeScaleRange?.min}–{campaign.safeScaleRange?.max}%
          </span>
        </div>
        {/* Budget preview */}
        <div className="rounded-xl bg-bg-secondary border border-border px-4 py-3 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-text-secondary">Current Budget</p>
            <p className="text-sm font-semibold text-text-primary mt-0.5">
              {currentBudget > 0 ? `$${currentBudget.toFixed(2)}/day` : 'Not set'}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-text-secondary">New Budget</p>
            <p className="text-sm font-semibold text-accent-green mt-0.5">
              {newBudget ? `$${newBudget}/day` : '—'}
            </p>
          </div>
        </div>
        <p className="text-[11px] text-text-secondary">
          Industry best practice: increase by ≤20% per step, observe for 5–7 days before the next increase.
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onCancel} className="btn-secondary text-sm px-4">Cancel</button>
          <button
            onClick={() => onConfirm(parsedPct)}
            disabled={!pct || isNaN(parsedPct) || parsedPct <= 0}
            className="btn-primary text-sm px-4"
          >
            Apply Scale
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Campaign Readiness Card ──────────────────────────────────────────────────
function CampaignCard({ campaign, expanded, onToggle, onScale }) {
  const verdictIcon = campaign.score >= 70 ? CheckCircle2
                    : campaign.score >= 50 ? AlertTriangle
                    : XCircle;
  const verdictColor = campaign.score >= 70 ? 'text-accent-green'
                     : campaign.score >= 50 ? 'text-yellow-400'
                     : 'text-red-400';

  const VerdictIcon = verdictIcon;

  return (
    <div className="card space-y-4">
      {/* Header row */}
      <div className="flex items-start gap-4">
        <ScoreGauge score={campaign.score} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-text-primary truncate">{campaign.campaignName}</p>
            <Badge status={campaign.platform?.toLowerCase()} />
          </div>
          <div className={`flex items-center gap-1.5 mt-1 ${verdictColor}`}>
            <VerdictIcon className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">{campaign.verdict}</span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Safe to scale: +{campaign.safeScaleRange?.min}% to +{campaign.safeScaleRange?.max}%
          </p>
        </div>
        <button
          onClick={onToggle}
          className="shrink-0 text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="space-y-4 border-t border-border pt-4">
          {/* Factors */}
          <div>
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Score Breakdown</p>
            <div className="space-y-3">
              {(campaign.factors ?? []).map((f, i) => <FactorBar key={i} factor={f} />)}
            </div>
          </div>

          {/* Risks */}
          {campaign.risks?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Risk Warnings</p>
              <div className="space-y-2">
                {campaign.risks.map((risk, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-yellow-300 bg-yellow-500/10 rounded-lg px-3 py-2 border border-yellow-500/20">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{risk}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Recommendation */}
          <div className="flex items-start gap-3 bg-accent-blue/5 border border-accent-blue/20 rounded-xl px-4 py-3">
            <Sparkles className="w-4 h-4 text-accent-blue shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-accent-blue mb-1">AI Recommendation</p>
              <p className="text-xs text-text-secondary leading-relaxed">{campaign.recommendation}</p>
            </div>
          </div>

          {/* Platform-specific signals (Meta frequency, Google IS) */}
          {campaign.platformSignals?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Platform Signals</p>
              <div className="space-y-2.5">
                {campaign.platformSignals.map((s, i) => <PlatformSignalRow key={i} signal={s} />)}
              </div>
            </div>
          )}

          {/* Data quality */}
          {campaign.dataQuality && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">Data Quality</span>
                <span className={`font-medium ${
                  campaign.dataQuality.score >= 80 ? 'text-accent-green'
                  : campaign.dataQuality.score >= 60 ? 'text-yellow-400'
                  : 'text-red-400'
                }`}>{campaign.dataQuality.label} ({campaign.dataQuality.score}%)</span>
              </div>
              <div className="h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    campaign.dataQuality.score >= 80 ? 'bg-accent-green'
                    : campaign.dataQuality.score >= 60 ? 'bg-yellow-400'
                    : 'bg-red-400'
                  }`}
                  style={{ width: `${campaign.dataQuality.score}%` }}
                />
              </div>
              {campaign.dataQuality.score < 80 && (
                <p className="text-[11px] text-text-secondary">{campaign.dataQuality.message}</p>
              )}
            </div>
          )}

          {/* Apply scale */}
          {campaign.score >= 50 && (
            <button
              onClick={onScale}
              className="w-full btn-primary text-sm py-2"
            >
              Apply Scale (+{campaign.safeScaleRange?.min}%)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ScalingPredictorPage() {
  const toast        = useToast();
  const queryClient  = useQueryClient();
  const [expandedId, setExpandedId]         = useState(null);
  const [confirmCampaign, setConfirmCampaign] = useState(null);
  const [platformFilter, setPlatformFilter]   = useState('all');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['scaling', 'all'],
    queryFn:  () => api.get('/scaling/all-campaigns').then((r) => r.data.data.campaigns),
    staleTime: 60_000,
  });

  const applyScaleMutation = useMutation({
    mutationFn: ({ campaign, pct }) => {
      const currentBudget = parseFloat(campaign.budget ?? 0);
      if (currentBudget <= 0) throw new Error('Campaign budget is not set');
      const newBudget = +(currentBudget * (1 + pct / 100)).toFixed(2);
      return api.patch(`/campaigns/${campaign.campaignId}`, { budget: newBudget });
    },
    onSuccess: (_, { campaign, pct }) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success(`${campaign.campaignName} budget scaled by +${pct}%`);
      setConfirmCampaign(null);
    },
    onError: (err) => toast.error(err?.message || 'Failed to update campaign budget'),
  });

  const allCampaigns = data ?? [];

  // Platform filter
  const campaigns = useMemo(() => {
    if (platformFilter === 'all') return allCampaigns;
    return allCampaigns.filter((c) =>
      (c.platform ?? '').toLowerCase() === platformFilter ||
      (c.platform ?? '').toLowerCase() === 'both'
    );
  }, [allCampaigns, platformFilter]);

  const ready    = campaigns.filter((c) => c.score >= 70).length;
  const caution  = campaigns.filter((c) => c.score >= 50 && c.score < 70).length;
  const notReady = campaigns.filter((c) => c.score < 50).length;

  // Detect available platforms for filter tabs
  const availablePlatforms = useMemo(() => {
    const set = new Set(allCampaigns.map((c) => (c.platform ?? '').toLowerCase()));
    return set;
  }, [allCampaigns]);

  const feature = FEATURES.apex;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ── Feature Header ──────────────────────────────────────────────── */}
      <FeatureHeader
        codename={feature.codename}
        label={feature.label}
        description={feature.description}
        color={feature.color}
        icon={TrendingUp}
        badge={feature.badge}
        stats={feature.stats}
        actions={[
          {
            label: 'Refresh',
            onClick: () => refetch(),
            variant: 'secondary',
            icon: RefreshCw,
          },
        ]}
      />

      {/* ── Overview stats ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card flex items-center gap-4">
          <CheckCircle2 className="w-9 h-9 text-accent-green bg-accent-green/10 rounded-xl p-2 shrink-0" />
          <div>
            <p className="text-2xl font-bold text-text-primary">{isLoading ? '—' : ready}</p>
            <p className="text-xs text-text-secondary">Ready to Scale</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <AlertTriangle className="w-9 h-9 text-yellow-400 bg-yellow-500/10 rounded-xl p-2 shrink-0" />
          <div>
            <p className="text-2xl font-bold text-text-primary">{isLoading ? '—' : caution}</p>
            <p className="text-xs text-text-secondary">Scale with Caution</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <XCircle className="w-9 h-9 text-red-400 bg-red-500/10 rounded-xl p-2 shrink-0" />
          <div>
            <p className="text-2xl font-bold text-text-primary">{isLoading ? '—' : notReady}</p>
            <p className="text-xs text-text-secondary">Not Ready</p>
          </div>
        </div>
      </div>

      {/* ── Platform filter ────────────────────────────────────────────── */}
      {allCampaigns.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-text-secondary">Platform:</span>
          {['all', 'meta', 'google'].map((p) => {
            const disabled = p !== 'all' && !availablePlatforms.has(p) && !availablePlatforms.has('both');
            return (
              <button
                key={p}
                onClick={() => !disabled && setPlatformFilter(p)}
                disabled={disabled}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  platformFilter === p
                    ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                    : disabled
                    ? 'border-border text-text-secondary/30 cursor-not-allowed'
                    : 'border-border text-text-secondary hover:text-text-primary'
                }`}
              >
                {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            );
          })}
          {campaigns.length !== allCampaigns.length && (
            <span className="text-xs text-text-secondary ml-1">
              Showing {campaigns.length} of {allCampaigns.length}
            </span>
          )}
        </div>
      )}

      {/* ── Campaign cards ─────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonFeatureCard key={i} />)}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="card p-0">
          <EmptyState
            icon={TrendingUp}
            title="No active campaigns"
            description="Create and launch campaigns to see AI scaling predictions and safe budget ranges."
            color="amber"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {campaigns.map((c) => (
            <CampaignCard
              key={c.campaignId}
              campaign={c}
              expanded={expandedId === c.campaignId}
              onToggle={() => setExpandedId((id) => id === c.campaignId ? null : c.campaignId)}
              onScale={() => setConfirmCampaign(c)}
            />
          ))}
        </div>
      )}

      {/* ── Features (always shown) ────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-text-primary mb-3">How Scaling Predictor works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { title: 'Scale Readiness Score', desc: '0–100 score: is this campaign ready to scale?', color: 'text-accent-green', bg: 'bg-accent-green/10' },
            { title: 'Safe Scale Range', desc: 'AI calculates the exact % increase that won\'t break performance', color: 'text-accent-blue', bg: 'bg-accent-blue/10' },
            { title: 'Risk Assessment', desc: 'See what could go wrong before you commit more budget', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
            { title: 'Historical Pattern Analysis', desc: 'Learns from your past scaling attempts and outcomes', color: 'text-accent-purple', bg: 'bg-accent-purple/10' },
          ].map((f) => (
            <div key={f.title} className="card">
              <p className={`text-sm font-semibold ${f.color}`}>{f.title}</p>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {confirmCampaign && (
        <ConfirmScaleDialog
          campaign={confirmCampaign}
          onConfirm={(pct) => applyScaleMutation.mutate({ campaign: confirmCampaign, pct })}
          onCancel={() => setConfirmCampaign(null)}
        />
      )}
    </div>
  );
}
