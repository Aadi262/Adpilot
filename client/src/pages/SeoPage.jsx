import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield, Search, RefreshCw, Plus, X, AlertCircle,
  TrendingUp, TrendingDown, Minus, FileText,
  ChevronUp, ChevronDown, ChevronRight, Zap,
  CheckCircle, Clock, Activity, Globe, Link, AlertTriangle,
  Printer, Trash2, Copy, Tag,
  Bell, Play, Pause, BarChart2, Download,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import api from '../lib/api';
import { exportToCSV } from '../lib/exportCsv';
import FeatureHeader from '../components/ui/FeatureHeader';
import { useToast } from '../components/ui/Toast';
import { FEATURES } from '../config/features';

// ─── Existing shared helpers (unchanged) ──────────────────────────────────────

function SkeletonRow({ cols = 5 }) {
  return (
    <tr>
      {[...Array(cols)].map((_, i) => (
        <td key={i} className="px-5 py-3.5">
          <div className="skeleton h-4 rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

function SkeletonCard() {
  return <div className="skeleton h-24 rounded-xl" />;
}

function ScoreCircle({ score }) {
  const s = Number(score) || 0;
  const color =
    s >= 80 ? 'text-accent-green border-accent-green' :
    s >= 60 ? 'text-orange-400 border-orange-400' :
              'text-red-400 border-red-400';
  return (
    <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold text-sm shrink-0 ${color}`}>
      {s}
    </div>
  );
}

function DifficultyBar({ value }) {
  const v = Math.min(100, Math.max(0, Number(value) || 0));
  const color = v >= 70 ? 'bg-red-400' : v >= 40 ? 'bg-orange-400' : 'bg-accent-green';
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${v}%` }} />
      </div>
      <span className="text-xs text-text-secondary w-7 text-right">{v}</span>
    </div>
  );
}

function PriorityBadge({ priority }) {
  const p = (priority || 'low').toLowerCase();
  const cls =
    p === 'high'   ? 'bg-red-500/10 text-red-400 border-red-500/20' :
    p === 'medium' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                     'bg-text-secondary/10 text-text-secondary border-text-secondary/20';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {p.charAt(0).toUpperCase() + p.slice(1)}
    </span>
  );
}

function OpportunityBadge({ score }) {
  const s = Number(score) || 0;
  const cls =
    s >= 80 ? 'bg-accent-green/10 text-accent-green border-accent-green/20' :
    s >= 50 ? 'bg-accent-blue/10 text-accent-blue border-accent-blue/20' :
              'bg-text-secondary/10 text-text-secondary border-text-secondary/20';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {s}
    </span>
  );
}

function RankChange({ change }) {
  const c = Number(change) || 0;
  if (c === 0) return <span className="flex items-center gap-1 text-text-secondary text-xs"><Minus className="w-3 h-3" />0</span>;
  if (c > 0) return <span className="flex items-center gap-1 text-accent-green text-xs"><ChevronUp className="w-3 h-3" />+{c}</span>;
  return <span className="flex items-center gap-1 text-red-400 text-xs"><ChevronDown className="w-3 h-3" />{c}</span>;
}

// ─── New: Severity badge ───────────────────────────────────────────────────────
function SeverityBadge({ severity }) {
  const s = (severity || 'low').toLowerCase();
  const cfg = {
    critical: 'bg-red-500/15 text-red-400 border-red-500/25',
    high:     'bg-orange-500/15 text-orange-400 border-orange-500/25',
    medium:   'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
    low:      'bg-text-secondary/10 text-text-secondary border-text-secondary/20',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg[s] ?? cfg.low}`}>
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}

// ─── New: Audit status badge ───────────────────────────────────────────────────
const ACTIVE_STATUSES   = ['pending', 'crawling', 'analyzing', 'scoring', 'summarizing'];
// API may return "complete" (v1) or "completed" (v2) — treat both as done.
const COMPLETE_STATUSES = ['completed', 'complete'];

function AuditStatusBadge({ status }) {
  if (COMPLETE_STATUSES.includes(status)) return <span className="flex items-center gap-1 text-accent-green text-xs"><CheckCircle className="w-3 h-3" />Done</span>;
  if (status === 'failed')                return <span className="flex items-center gap-1 text-red-400 text-xs"><AlertCircle className="w-3 h-3" />Failed</span>;
  return (
    <span className="flex items-center gap-1 text-accent-blue text-xs">
      <span className="w-1.5 h-1.5 rounded-full bg-accent-blue animate-pulse" />
      {status}
    </span>
  );
}

// ─── New: SVG score gauge ──────────────────────────────────────────────────────
function ScoreGauge({ score, grade }) {
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  const r = 50;
  const cx = 64; const cy = 64;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - s / 100);
  const color = s >= 75 ? '#10B981' : s >= 60 ? '#F59E0B' : s >= 45 ? '#F97316' : '#EF4444';

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="128" height="128" viewBox="0 0 128 128">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1A1E2E" strokeWidth="10" />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 0.9s ease' }}
        />
        <text x={cx} y={cy - 4} textAnchor="middle" fill="#E8ECF4" fontSize="26" fontWeight="700" fontFamily="Outfit, sans-serif">
          {s}
        </text>
        <text x={cx} y={cy + 18} textAnchor="middle" fill={color} fontSize="14" fontWeight="600" fontFamily="Outfit, sans-serif">
          {grade ?? '—'}
        </text>
      </svg>
      <p className="text-xs text-text-secondary">Overall Score</p>
    </div>
  );
}

// ─── New: Category score bar ───────────────────────────────────────────────────
function CategoryBar({ label, score, weight, deducted, fallback }) {
  const s = Math.max(0, Math.min(100, Number(score) ?? 0));
  const barColor   = s >= 75 ? 'bg-accent-green' : s >= 60 ? 'bg-orange-400' : 'bg-red-400';
  const textColor  = s >= 75 ? 'text-accent-green' : s >= 60 ? 'text-orange-400' : 'text-red-400';
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-text-secondary">{label}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-secondary">{Math.round((weight ?? 0) * 100)}% weight</span>
          <span className={`w-9 text-right font-semibold ${textColor} ${fallback ? 'opacity-50' : ''}`}>
            {score == null ? '—' : s}{fallback ? '*' : ''}
          </span>
        </div>
      </div>
      <div className="h-2 bg-bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor} ${fallback ? 'opacity-40' : ''}`}
          style={{ width: `${s}%` }}
        />
      </div>
      {deducted > 0 && (
        <p className="text-xs text-text-secondary">−{Math.round(deducted)} pts deducted</p>
      )}
    </div>
  );
}

// ─── New: Web Vitals performance metric card ───────────────────────────────────
const PERF_META = {
  fcp: { label: 'First Contentful Paint', good: 1800,  poor: 3000  },
  lcp: { label: 'Largest Contentful Paint', good: 2500, poor: 4000 },
  tbt: { label: 'Total Blocking Time',     good: 200,  poor: 600   },
  cls: { label: 'Cumulative Layout Shift', good: 0.1,  poor: 0.25  },
  si:  { label: 'Speed Index',             good: 3400, poor: 5800  },
  tti: { label: 'Time to Interactive',     good: 3800, poor: 7300  },
};

function PerfMetric({ metricKey, data }) {
  const meta    = PERF_META[metricKey];
  if (!meta || !data) return null;
  const { value, displayValue } = data;
  const color =
    value == null           ? 'text-text-secondary' :
    value <= meta.good      ? 'text-accent-green'   :
    value <= meta.poor      ? 'text-orange-400'      :
                              'text-red-400';
  return (
    <div className="bg-bg-secondary rounded-xl p-3.5 flex flex-col gap-1.5">
      <p className="text-xs text-text-secondary leading-snug">{meta.label}</p>
      <p className={`text-lg font-bold ${color}`}>{displayValue ?? '—'}</p>
    </div>
  );
}

// ─── New: Issue accordion card ─────────────────────────────────────────────────
function IssueCard({ issue }) {
  const [open, setOpen] = useState(false);
  const { id, severity, description, recommendation, affectedCount, affectedPages, autoFixable } = issue;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-start gap-3 px-4 py-3.5 hover:bg-bg-secondary/40 transition-colors text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <SeverityBadge severity={severity} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary leading-snug">{description}</p>
          {affectedCount > 0 && (
            <p className="text-xs text-text-secondary mt-0.5">
              {affectedCount} page{affectedCount !== 1 ? 's' : ''} affected
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          {autoFixable && (
            <span className="text-xs text-accent-green bg-accent-green/10 border border-accent-green/20 px-2 py-0.5 rounded-full">
              Auto-fixable
            </span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronRight className="w-4 h-4 text-text-secondary" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border bg-bg-secondary/20 px-4 py-3.5 space-y-3">
          {recommendation && (
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">Recommendation</p>
              <p className="text-sm text-text-primary leading-relaxed">{recommendation}</p>
            </div>
          )}
          {affectedPages?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">
                Affected pages ({affectedPages.length})
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {affectedPages.slice(0, 12).map((url) => (
                  <p key={url} className="text-xs text-text-secondary font-mono truncate">{url}</p>
                ))}
                {affectedPages.length > 12 && (
                  <p className="text-xs text-text-secondary">+{affectedPages.length - 12} more…</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── New: Crawl stats grid ─────────────────────────────────────────────────────
function CrawlStatsGrid({ stats }) {
  if (!stats) return null;
  const items = [
    { label: 'Pages Crawled',   value: stats.pagesCrawled,          icon: Globe },
    { label: 'Pages Found',     value: stats.pagesFound,            icon: Search },
    { label: 'Max Depth',       value: `${stats.maxDepth} clicks`,  icon: Link },
    { label: 'Crawl Time',      value: `${((stats.durationMs ?? 0) / 1000).toFixed(1)}s`, icon: Clock },
    { label: 'Sitemap',         value: stats.hasSitemap        ? 'Present'  : 'Missing',
      color: stats.hasSitemap   ? 'text-accent-green' : 'text-red-400',  icon: CheckCircle },
    { label: 'Robots.txt',      value: stats.hasRobots         ? 'Present'  : 'Missing',
      color: stats.hasRobots    ? 'text-accent-green' : 'text-red-400',  icon: Activity },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="bg-bg-secondary rounded-xl p-3.5">
          <p className="text-xs text-text-secondary mb-1">{label}</p>
          <p className={`text-sm font-semibold ${color || 'text-text-primary'}`}>{value ?? '—'}</p>
        </div>
      ))}
    </div>
  );
}

// ─── New: In-progress overlay inside result panel ─────────────────────────────
const STATUS_INFO = {
  pending:     { label: 'Queued',      progress: 5,  msg: 'Waiting for an available worker…' },
  crawling:    { label: 'Crawling',    progress: 35, msg: 'Puppeteer is visiting pages on this site…' },
  analyzing:   { label: 'Analyzing',   progress: 58, msg: 'Running 16 SEO rules across all crawled pages…' },
  scoring:     { label: 'Scoring',     progress: 80, msg: 'Running Lighthouse performance audits + computing weighted score…' },
  summarizing: { label: 'Summarizing', progress: 93, msg: 'Generating executive summary…' },
};

function InProgressState({ status }) {
  const info = STATUS_INFO[status] ?? STATUS_INFO.pending;
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16 px-6">
      <div className="w-14 h-14 rounded-2xl bg-accent-blue/10 flex items-center justify-center">
        <Activity className="w-7 h-7 text-accent-blue animate-pulse" />
      </div>
      <div className="text-center space-y-1.5">
        <p className="text-base font-semibold text-text-primary">{info.label}</p>
        <p className="text-sm text-text-secondary max-w-xs">{info.msg}</p>
      </div>
      <div className="w-full max-w-xs space-y-2">
        <div className="flex justify-between text-xs text-text-secondary">
          <span>Progress</span>
          <span>{info.progress}%</span>
        </div>
        <div className="h-1.5 bg-bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-blue rounded-full transition-all duration-700"
            style={{ width: `${info.progress}%` }}
          />
        </div>
      </div>
      <p className="text-xs text-text-secondary">This page auto-updates every 3 seconds.</p>
    </div>
  );
}

// ─── New: Failed state ─────────────────────────────────────────────────────────
function FailedState({ audit }) {
  const reason = Array.isArray(audit?.recommendations)
    ? audit.recommendations.find((r) => r?.error)?.reason
    : null;
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
      <AlertTriangle className="w-12 h-12 text-red-400 opacity-70" />
      <div className="space-y-1">
        <p className="text-base font-semibold text-text-primary">Audit Failed</p>
        {reason && <p className="text-sm text-text-secondary max-w-sm">{reason}</p>}
      </div>
      <p className="text-xs text-text-secondary">Check that the URL is publicly accessible and try again.</p>
    </div>
  );
}

// ─── New: Full audit result panel ─────────────────────────────────────────────
function AuditResultPanel({ auditId, onClose, onComplete, onRerun }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [issueTab, setIssueTab] = useState('Technical');
  const [showRerunConfirm, setShowRerunConfirm] = useState(false);

  const rerunMutation = useMutation({
    mutationFn: (data) => api.post('/seo/audit', data),
    onSuccess: (res) => {
      const newId = res.data.data?.auditId;
      queryClient.invalidateQueries({ queryKey: ['seo', 'audits'] });
      setShowRerunConfirm(false);
      if (newId && onRerun) onRerun(newId);
    },
  });

  const handleExportPdf = () => window.print();
  const handleRerun = () => {
    if (!audit?.url) return;
    rerunMutation.mutate({ url: audit.url });
  };

  const retrySummaryMutation = useMutation({
    mutationFn: () => api.post(`/seo/audit/${auditId}/regenerate-summary?force=1`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo', 'audit', auditId] });
      toast.success('Executive summary regenerated');
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error?.message || 'Failed to regenerate summary');
    },
  });

  const { data: audit, isLoading } = useQuery({
    queryKey: ['seo', 'audit', auditId],
    queryFn:  () => api.get(`/seo/audit/${auditId}`).then((r) => r.data.data),
    enabled:  !!auditId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || [...COMPLETE_STATUSES, 'failed'].includes(status)) return false;
      return 3000;
    },
    refetchIntervalInBackground: false,
  });

  // React Query v5 removed onSuccess from useQuery — use an effect instead.
  // Track previous status so we fire only once on transition → completed.
  const prevStatusRef = useRef(null);
  useEffect(() => {
    if (!audit) return;
    if (COMPLETE_STATUSES.includes(audit.status) && !COMPLETE_STATUSES.includes(prevStatusRef.current)) {
      queryClient.invalidateQueries({ queryKey: ['seo', 'audits'] });
      onComplete?.();
    }
    prevStatusRef.current = audit.status;
  }, [audit?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const isActive = audit && ACTIVE_STATUSES.includes(audit.status);

  const issueMap = {
    Technical: audit?.technicalIssues ?? [],
    Content:   audit?.contentIssues   ?? [],
    Structure: audit?.structureIssues  ?? [],
  };
  const issueTabCounts = {
    Technical: issueMap.Technical.length,
    Content:   issueMap.Content.length,
    Structure: issueMap.Structure.length,
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-2xl bg-bg-card border-l border-border flex flex-col overflow-hidden shadow-2xl">
        {/* Panel header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <p className="text-xs text-text-secondary mb-0.5">SEO Audit</p>
            <p className="text-sm font-semibold text-text-primary truncate max-w-[400px]">
              {audit?.url ?? '…'}
            </p>
            {audit && (
              <div className="flex items-center gap-2 mt-1">
                <AuditStatusBadge status={audit.status} />
                <span className="text-xs text-text-secondary">
                  {new Date(audit.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Export PDF */}
            {audit && COMPLETE_STATUSES.includes(audit.status) && (
              <button
                onClick={handleExportPdf}
                title="Export as PDF"
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors"
              >
                <Printer className="w-4 h-4" />
              </button>
            )}
            {/* Re-run audit */}
            {audit && !showRerunConfirm && (
              <button
                onClick={() => setShowRerunConfirm(true)}
                title="Re-run audit"
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            {/* Close */}
            <button onClick={onClose} className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Re-run confirmation strip */}
        {showRerunConfirm && (
          <div className="px-5 py-3 bg-orange-500/8 border-b border-orange-500/20 flex items-center justify-between gap-3 shrink-0">
            <p className="text-xs text-text-secondary">Re-run a fresh audit for this URL?</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRerunConfirm(false)}
                className="px-3 py-1 text-xs rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRerun}
                disabled={rerunMutation.isPending}
                className="px-3 py-1 text-xs rounded-lg bg-accent-blue text-white hover:bg-accent-blue/90 transition-colors disabled:opacity-50"
              >
                {rerunMutation.isPending ? 'Starting…' : 'Confirm Re-run'}
              </button>
            </div>
          </div>
        )}

        {/* Panel body */}
        <div className="flex-1 overflow-y-auto">
          {/* Loading skeleton */}
          {isLoading && (
            <div className="p-6 space-y-4">
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
            </div>
          )}

          {/* In progress */}
          {!isLoading && isActive && <InProgressState status={audit.status} />}

          {/* Failed */}
          {!isLoading && audit?.status === 'failed' && <FailedState audit={audit} />}

          {/* Completed */}
          {!isLoading && COMPLETE_STATUSES.includes(audit?.status) && (
            <div className="p-5 space-y-7">

              {/* ── LLM Executive Summary (when available) ────────────────── */}
              {audit.executiveSummary && (
                <ExecutiveSummaryPanel summary={audit.executiveSummary} />
              )}

              {!audit.executiveSummary && (
                <SummaryUnavailableCard
                  onRetry={() => retrySummaryMutation.mutate()}
                  isRetrying={retrySummaryMutation.isPending}
                />
              )}

              {/* ── Overview: gauge + category bars ──────────────────────── */}
              <section className="card">
                <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                  <ScoreGauge score={audit.summary?.score} grade={audit.summary?.grade} />
                  <div className="flex-1 w-full space-y-4">
                    {audit.categories?.map((cat) => (
                      <CategoryBar
                        key={cat.id}
                        label={cat.label}
                        score={cat.score}
                        weight={cat.weight}
                        deducted={cat.deducted}
                        fallback={cat.fallback}
                      />
                    ))}
                    {audit.categories?.some((c) => c.fallback) && (
                      <p className="text-xs text-text-secondary">* Fallback score — Lighthouse data unavailable</p>
                    )}
                  </div>
                </div>

                {/* Issue counts */}
                <div className="mt-5 pt-5 border-t border-border grid grid-cols-4 gap-3">
                  {[
                    { label: 'Critical', count: audit.summary?.criticalIssues, color: 'text-red-400' },
                    { label: 'High',     count: audit.summary?.highIssues,     color: 'text-orange-400' },
                    { label: 'Medium',   count: audit.summary?.mediumIssues,   color: 'text-yellow-400' },
                    { label: 'Low',      count: audit.summary?.lowIssues,      color: 'text-text-secondary' },
                  ].map(({ label, count, color }) => (
                    <div key={label} className="text-center">
                      <p className={`text-2xl font-bold ${color}`}>{count ?? 0}</p>
                      <p className="text-xs text-text-secondary mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* ── Performance metrics ───────────────────────────────────── */}
              {audit.performance && !audit.performance.fallback && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <Zap className="w-4 h-4 text-accent-blue" />
                      Performance
                    </h3>
                    <span className="text-xs text-text-secondary">
                      {audit.performance.pagesAnalyzed} page{audit.performance.pagesAnalyzed !== 1 ? 's' : ''} audited
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(audit.performance.metrics ?? {}).map(([key, data]) => (
                      <PerfMetric key={key} metricKey={key} data={data} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Issues by category ────────────────────────────────────── */}
              <section>
                <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-accent-blue" />
                  Issues
                </h3>
                {/* Issue sub-tabs */}
                <div className="flex gap-1 border-b border-border mb-4">
                  {['Technical', 'Content', 'Structure'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setIssueTab(tab)}
                      className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                        issueTab === tab
                          ? 'border-accent-blue text-accent-blue'
                          : 'border-transparent text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {tab}
                      <span className="ml-1.5 text-xs opacity-60">({issueTabCounts[tab]})</span>
                    </button>
                  ))}
                </div>
                {issueMap[issueTab].length === 0 ? (
                  <div className="py-10 text-center">
                    <CheckCircle className="w-10 h-10 mx-auto text-accent-green opacity-50 mb-3" />
                    <p className="text-sm text-text-secondary">No {issueTab.toLowerCase()} issues found.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {issueMap[issueTab].map((issue, i) => (
                      <IssueCard key={issue.id ?? i} issue={issue} />
                    ))}
                  </div>
                )}
              </section>

              {/* ── Crawl stats ───────────────────────────────────────────── */}
              {audit.crawlStats && (
                <section>
                  <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-accent-blue" />
                    Crawl Stats
                  </h3>
                  <CrawlStatsGrid stats={audit.crawlStats} />
                  {audit.crawlStats.robotsBlocksCrawl && (
                    <div className="mt-3 flex items-start gap-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-3 py-2.5 text-xs">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      robots.txt is blocking this crawler. Crawl data may be incomplete.
                    </div>
                  )}
                </section>
              )}

              {/* ── Top recommendations ───────────────────────────────────── */}
              {audit.recommendations?.filter((r) => !r.error).length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-accent-blue" />
                    Recommendations
                  </h3>
                  <div className="space-y-2">
                    {audit.recommendations.filter((r) => !r.error).map((rec, i) => (
                      <div key={rec.issueId ?? i} className="flex items-start gap-3 bg-bg-secondary rounded-xl px-4 py-3">
                        <SeverityBadge severity={rec.severity} />
                        <p className="text-sm text-text-primary flex-1 leading-relaxed">{rec.text}</p>
                        {rec.autoFixable && (
                          <span className="text-xs text-accent-green shrink-0 mt-0.5">Auto-fixable</span>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── New: Effort badge for priority roadmap items ─────────────────────────────
function EffortBadge({ effort }) {
  const cfg = {
    'quick-win':  { label: '⚡ Quick Win',   cls: 'bg-accent-green/10 text-accent-green border-accent-green/20' },
    'medium':     { label: '🔨 Medium',      cls: 'bg-accent-blue/10  text-accent-blue  border-accent-blue/20' },
    'heavy-lift': { label: '🏗️ Heavy Lift', cls: 'bg-orange-500/10   text-orange-400   border-orange-500/20' },
  };
  const c = cfg[effort] ?? cfg['medium'];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${c.cls}`}>
      {c.label}
    </span>
  );
}

function ImpactBadge({ impact }) {
  const cfg = {
    high:   'bg-red-500/10 text-red-400 border-red-500/20',
    medium: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    low:    'bg-text-secondary/10 text-text-secondary border-text-secondary/20',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg[impact] ?? cfg.medium}`}>
      {(impact ?? 'medium').charAt(0).toUpperCase() + (impact ?? 'medium').slice(1)} Impact
    </span>
  );
}

// ─── New: Executive Summary Panel ─────────────────────────────────────────────
function ExecutiveSummaryPanel({ summary }) {
  if (!summary) return null;
  const { executiveSummary, priorityRoadmap, businessImpact } = summary;

  return (
    <section className="space-y-5">
      {/* Executive summary paragraphs */}
      {executiveSummary && (
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <FileText className="w-4 h-4 text-accent-blue" />
            Executive Summary
          </h3>
          {executiveSummary.split('\n\n').filter(Boolean).map((para, i) => (
            <p key={i} className="text-sm text-text-secondary leading-relaxed">{para.trim()}</p>
          ))}
        </div>
      )}

      {/* Priority roadmap */}
      {priorityRoadmap?.length > 0 && (
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent-blue" />
            Priority Roadmap
          </h3>
          <ol className="space-y-3">
            {priorityRoadmap.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-accent-blue/10 text-accent-blue text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <p className="text-sm font-medium text-text-primary leading-snug">{item.title}</p>
                  <p className="text-xs text-text-secondary leading-relaxed">{item.description}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <EffortBadge effort={item.effort} />
                    <ImpactBadge impact={item.impact} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Business impact */}
      {businessImpact && (
        <div className="flex items-start gap-3 bg-orange-500/8 border border-orange-500/20 rounded-xl px-4 py-3.5">
          <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-orange-400 mb-1">Business Impact</p>
            <p className="text-sm text-text-secondary leading-relaxed">{businessImpact}</p>
          </div>
        </div>
      )}
    </section>
  );
}

function SummaryUnavailableCard({ onRetry, isRetrying }) {
  return (
    <section className="card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <FileText className="w-4 h-4 text-accent-blue" />
          Executive Summary Unavailable
        </h3>
        <p className="text-sm text-text-secondary mt-2">
          The audit completed, but the AI summary was not generated. This usually means the configured AI provider is unavailable or not set up in this environment.
        </p>
      </div>
      <button
        onClick={onRetry}
        disabled={isRetrying}
        className="btn-secondary whitespace-nowrap"
      >
        {isRetrying ? 'Retrying…' : 'Retry Summary'}
      </button>
    </section>
  );
}

// ─── Generate Brief Modal ──────────────────────────────────────────────────────
function GenerateBriefModal({ onClose }) {
  const queryClient = useQueryClient();
  const [targetKeyword, setTargetKeyword] = useState('');

  const mutation = useMutation({
    mutationFn: (data) => api.post('/seo/briefs', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo', 'briefs'] });
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!targetKeyword.trim()) return;
    mutation.mutate({ targetKeyword: targetKeyword.trim() });
  };

  const errMsg = mutation.error?.response?.data?.error?.message || mutation.error?.message;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={!mutation.isPending ? onClose : undefined} />
      <div className="relative w-full sm:max-w-md bg-bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary">Generate Content Brief</h2>
          {!mutation.isPending && (
            <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {mutation.isPending ? (
          <div className="px-6 py-10 flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-accent-purple/10 flex items-center justify-center">
              <Zap className="w-6 h-6 text-accent-purple animate-pulse" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-text-primary">AI is writing your brief…</p>
              <p className="text-xs text-text-secondary mt-1">Analysing "{targetKeyword}" — this may take a few seconds</p>
            </div>
            <div className="w-full space-y-2 mt-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton h-3 rounded-full" style={{ width: `${85 - i * 10}%` }} />
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {errMsg && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-3 py-2 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errMsg}</span>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Target Keyword</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. best running shoes 2025"
                value={targetKeyword}
                onChange={(e) => setTargetKeyword(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Generate Brief</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Brief Detail Modal ────────────────────────────────────────────────────────
const INTENT_COLORS = {
  informational: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  commercial:    'bg-purple-500/10 text-purple-400 border-purple-500/20',
  transactional: 'bg-green-500/10 text-green-400 border-green-500/20',
  navigational:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
};

function BriefDetailModal({ brief, onClose, onDelete }) {
  const [expandedSections, setExpandedSections] = useState({});
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggleSection = (idx) =>
    setExpandedSections((s) => ({ ...s, [idx]: !s[idx] }));

  const copyBrief = () => {
    const lines = [
      `# ${brief.title}`,
      ``,
      `**Target Keyword:** ${brief.targetKeyword}`,
      brief.metaDescription ? `**Meta Description:** ${brief.metaDescription}` : null,
      brief.targetWordCount  ? `**Target Word Count:** ${brief.targetWordCount}` : null,
      brief.searchIntent     ? `**Search Intent:** ${brief.searchIntent}` : null,
      ``,
      `## Outline`,
      ...(brief.outline || []).flatMap((s, i) => [
        `### ${i + 1}. ${s.heading}`,
        ...(s.subpoints || []).map((p) => `- ${p}`),
        ``,
      ]),
      brief.competitorAngle ? [`## Competitor Angle`, brief.competitorAngle, ``] : null,
      brief.callToAction    ? [`## Call to Action`, brief.callToAction] : null,
    ].flat().filter(Boolean).join('\n');

    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const intentClass = INTENT_COLORS[brief.searchIntent] || INTENT_COLORS.informational;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-2xl bg-bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent-purple/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-accent-purple" />
            </div>
            <span className="text-sm font-semibold text-text-primary">Content Brief</span>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Title */}
          <div>
            <h2 className="text-lg font-bold text-text-primary leading-snug">{brief.title}</h2>
            {brief.metaDescription && (
              <p className="mt-1.5 text-sm text-text-secondary italic">{brief.metaDescription}</p>
            )}
          </div>

          {/* Chips */}
          <div className="flex flex-wrap gap-2">
            {brief.searchIntent && (
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${intentClass}`}>
                <Tag className="w-3 h-3" />
                {brief.searchIntent}
              </span>
            )}
            {brief.targetWordCount && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border bg-accent-blue/10 text-accent-blue border-accent-blue/20">
                ~{brief.targetWordCount.toLocaleString()} words
              </span>
            )}
            {brief.outline?.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border bg-border/50 text-text-secondary border-border">
                {brief.outline.length} sections
              </span>
            )}
          </div>

          {/* Outline accordion */}
          {brief.outline?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Outline</p>
              <div className="space-y-1.5">
                {brief.outline.map((section, idx) => (
                  <div key={idx} className="border border-border rounded-lg overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-white/3 transition-colors"
                      onClick={() => toggleSection(idx)}
                    >
                      <span className="text-sm font-medium text-text-primary">{section.heading}</span>
                      {expandedSections[idx]
                        ? <ChevronUp className="w-4 h-4 text-text-secondary shrink-0" />
                        : <ChevronDown className="w-4 h-4 text-text-secondary shrink-0" />}
                    </button>
                    {expandedSections[idx] && section.subpoints?.length > 0 && (
                      <ul className="px-4 pb-3 space-y-1">
                        {section.subpoints.map((pt, pi) => (
                          <li key={pi} className="flex items-start gap-2 text-xs text-text-secondary">
                            <span className="mt-1.5 w-1 h-1 rounded-full bg-accent-blue shrink-0" />
                            {pt}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related keywords */}
          {brief.relatedKeywords?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Related Keywords</p>
              <div className="flex flex-wrap gap-1.5">
                {brief.relatedKeywords.map((kw) => (
                  <button
                    key={kw}
                    onClick={() => navigator.clipboard.writeText(kw)}
                    title="Click to copy"
                    className="text-xs px-2.5 py-1 rounded-full border border-border bg-bg-primary hover:border-accent-blue/40 hover:text-accent-blue text-text-secondary transition-colors"
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </div>
          )}

          {brief.peopleAlsoAsk?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">People Also Ask</p>
              <div className="space-y-2">
                {brief.peopleAlsoAsk.map((question, idx) => (
                  <div key={idx} className="text-sm text-text-secondary bg-bg-primary border border-border rounded-lg px-4 py-3">
                    {question}
                  </div>
                ))}
              </div>
            </div>
          )}

          {brief.titleOptions?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Title Options</p>
              <div className="space-y-2">
                {brief.titleOptions.map((title, idx) => (
                  <div key={idx} className="text-sm text-text-secondary bg-bg-primary border border-border rounded-lg px-4 py-3">
                    {title}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Competitor angle */}
          {brief.competitorAngle && (
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Competitor Angle</p>
              <p className="text-sm text-text-secondary bg-bg-primary border border-border rounded-lg px-4 py-3">{brief.competitorAngle}</p>
            </div>
          )}

          {brief.uniqueAngle && (
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Unique Angle</p>
              <p className="text-sm text-text-secondary bg-bg-primary border border-border rounded-lg px-4 py-3">{brief.uniqueAngle}</p>
            </div>
          )}

          {/* CTA */}
          {brief.callToAction && (
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Call to Action</p>
              <p className="text-sm text-text-secondary bg-bg-primary border border-border rounded-lg px-4 py-3">{brief.callToAction}</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0">
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />Delete Brief
          </button>
          <button onClick={copyBrief} className="btn-secondary flex items-center gap-1.5 text-xs">
            {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy Brief'}
          </button>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete brief?"
          message={`This will permanently delete the brief for "${brief.targetKeyword}".`}
          onConfirm={onDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

// ─── Confirm dialog ────────────────────────────────────────────────────────────
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

// ─── Bulk Audit Modal ─────────────────────────────────────────────────────────
function BulkAuditModal({ onClose, onAuditStarted }) {
  const [text, setText] = useState('');
  const [results, setResults] = useState([]); // [{url, status, auditId, error}]
  const [running, setRunning] = useState(false);

  const urls = text.split('\n').map(u => u.trim()).filter(u => u.length > 4).slice(0, 10);

  const runAll = async () => {
    if (!urls.length) return;
    setRunning(true);
    setResults(urls.map(url => ({ url, status: 'pending' })));

    for (let i = 0; i < urls.length; i++) {
      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'running' } : r));
      try {
        const res = await api.post('/seo/audit', { url: urls[i] });
        const auditId = res.data.data?.auditId;
        setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'done', auditId } : r));
        if (onAuditStarted) onAuditStarted(auditId);
      } catch (err) {
        const msg = err?.response?.data?.error?.message || 'Failed';
        setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'error', error: msg } : r));
      }
      if (i < urls.length - 1) await new Promise(r => setTimeout(r, 1200));
    }
    setRunning(false);
  };

  const STATUS_ICON = {
    pending: <span className="text-xs text-text-secondary">Waiting</span>,
    running: <Activity className="w-4 h-4 text-accent-blue animate-pulse" />,
    done:    <CheckCircle className="w-4 h-4 text-accent-green" />,
    error:   <AlertCircle className="w-4 h-4 text-red-400" />,
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-text-primary">Bulk Audit</h3>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!results.length ? (
            <>
              <p className="text-xs text-text-secondary">Paste up to 10 URLs, one per line.</p>
              <textarea
                className="input-field w-full resize-none"
                rows={6}
                placeholder={`https://example.com\nhttps://another-site.com\nhttps://...`}
                value={text}
                onChange={e => setText(e.target.value)}
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-text-secondary">{urls.length} URL{urls.length !== 1 ? 's' : ''} detected</span>
                <button
                  onClick={runAll}
                  disabled={!urls.length}
                  className="btn-primary flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  Run All
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              {results.map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-bg-secondary/40 border border-border">
                  <span className="text-sm text-text-primary truncate flex-1">{r.url}</span>
                  <div className="shrink-0">
                    {STATUS_ICON[r.status]}
                    {r.error && <span className="text-xs text-red-400 ml-2">{r.error}</span>}
                  </div>
                </div>
              ))}
              {!running && (
                <div className="flex justify-end pt-2">
                  <button onClick={onClose} className="btn-secondary">Done</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Audits Tab (updated) ─────────────────────────────────────────────────────
function AuditsTab({ initialUrl = '', autoRun = false }) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState(initialUrl);
  const [selectedAuditId, setSelectedAuditId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // audit object | 'all' | null
  const [showBulk, setShowBulk] = useState(false);

  const { data: audits, isLoading, error } = useQuery({
    queryKey: ['seo', 'audits'],
    queryFn:  () => api.get('/seo/audits').then((r) => r.data.data?.audits ?? r.data.data?.items ?? (Array.isArray(r.data.data) ? r.data.data : [])),
  });

  const auditMutation = useMutation({
    mutationFn: (data) => api.post('/seo/audit', data),
    onSuccess:  (res) => {
      const auditId = res.data.data?.auditId;
      queryClient.invalidateQueries({ queryKey: ['seo', 'audits'] });
      setUrl('');
      if (auditId) setSelectedAuditId(auditId); // auto-open result panel
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/seo/audit/${id}`),
    onSuccess:  (_, id) => {
      if (selectedAuditId === id) setSelectedAuditId(null);
      queryClient.invalidateQueries({ queryKey: ['seo', 'audits'] });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => api.delete('/seo/audits'),
    onSuccess:  () => {
      setSelectedAuditId(null);
      queryClient.invalidateQueries({ queryKey: ['seo', 'audits'] });
    },
  });

  // Auto-trigger audit when navigated from onboarding with ?url=...&autorun=true
  useEffect(() => {
    if (!autoRun || !initialUrl.trim()) return;
    const t = setTimeout(() => {
      auditMutation.mutate({ url: initialUrl.trim() });
    }, 800);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirmDelete = () => {
    if (confirmDelete === 'all') {
      deleteAllMutation.mutate();
    } else if (confirmDelete) {
      deleteMutation.mutate(confirmDelete.id);
    }
    setConfirmDelete(null);
  };

  const handleRunAudit = (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    auditMutation.mutate({ url: url.trim() });
  };

  const errMsg = auditMutation.error?.response?.data?.error?.message || auditMutation.error?.message;

  return (
    <div className="space-y-6">
      {/* Run audit form */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-primary">Run New Audit</h3>
          <button
            onClick={() => setShowBulk(true)}
            className="btn-secondary text-xs flex items-center gap-1.5 py-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Bulk Audit
          </button>
        </div>
        <form onSubmit={handleRunAudit} className="flex flex-col sm:flex-row gap-3">
          <input
            type="url"
            className="input-field flex-1"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={auditMutation.isPending}
            className="btn-primary flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Search className="w-4 h-4" />
            {auditMutation.isPending ? 'Queuing…' : 'Run Audit'}
          </button>
        </form>
        {errMsg && (
          <p className="mt-3 flex items-center gap-1.5 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />{errMsg}
          </p>
        )}
      </div>

      {/* Audit list */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Past Audits</h3>
          <div className="flex items-center gap-3">
            <p className="text-xs text-text-secondary hidden sm:block">Click any row to view full report</p>
            {audits?.length > 0 && (
              <>
                <button
                  onClick={() => exportToCSV(
                    (audits || []).map(a => ({
                      url: a.url,
                      score: a.overallScore ?? a.summary?.score ?? '',
                      grade: a.grade ?? a.summary?.grade ?? '',
                      status: a.status,
                      date: new Date(a.createdAt).toLocaleDateString(),
                    })),
                    ['url', 'score', 'grade', 'status', 'date'],
                    'seo-audits'
                  )}
                  className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                </button>
                <button
                  onClick={() => setConfirmDelete('all')}
                  className="flex items-center gap-1 text-xs text-text-secondary hover:text-red-400 transition-colors"
                  title="Delete all audits"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear All
                </button>
              </>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-400 text-sm">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-60" />
            Failed to load audits.
          </div>
        ) : !audits?.length ? (
          <div className="p-12 text-center text-text-secondary text-sm">
            No audits yet. Run your first audit above.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {audits.map((audit) => {
              const isSelected  = selectedAuditId === audit.id;
              const isComplete  = COMPLETE_STATUSES.includes(audit.status);
              const isRunning   = ACTIVE_STATUSES.includes(audit.status);
              // v1 API puts score/grade inside summary; v2 hoists them to top-level
              const displayScore = audit.summary?.score ?? audit.overallScore ?? null;
              const displayGrade = audit.summary?.grade ?? audit.grade ?? null;
              const issueTotal   = audit.summary?.totalIssues ?? audit.categoryScores?.issueCount?.total ?? null;

              return (
                <div
                  key={audit.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedAuditId(audit.id)}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedAuditId(audit.id)}
                  className={`group w-full flex items-center gap-4 px-5 py-4 hover:bg-bg-secondary/40 transition-colors cursor-pointer ${isSelected ? 'bg-accent-blue/5 border-l-2 border-l-accent-blue' : ''}`}
                >
                  {/* Score or status indicator */}
                  {isComplete ? (
                    <ScoreCircle score={displayScore} />
                  ) : audit.status === 'failed' ? (
                    <div className="w-12 h-12 rounded-full border-2 border-red-400/40 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-5 h-5 text-red-400" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-full border-2 border-accent-blue/30 flex items-center justify-center shrink-0">
                      <Activity className="w-5 h-5 text-accent-blue animate-pulse" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{audit.url}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <AuditStatusBadge status={audit.status} />
                      <span className="text-xs text-text-secondary">
                        {new Date(audit.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {isComplete && (
                      <>
                        {displayGrade && (
                          <p className="text-lg font-bold text-text-primary">{displayGrade}</p>
                        )}
                        {issueTotal != null && (
                          <p className="text-xs text-text-secondary">{issueTotal} issue{issueTotal !== 1 ? 's' : ''}</p>
                        )}
                      </>
                    )}
                    {isRunning && (
                      <p className="text-xs text-text-secondary">In progress…</p>
                    )}
                  </div>

                  {/* Right-edge: chevron fades out on hover, trash button fades in */}
                  <div className="relative w-6 h-6 shrink-0">
                    <ChevronRight className="absolute inset-0 m-auto w-4 h-4 text-text-secondary transition-opacity group-hover:opacity-0" />
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(audit); }}
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-red-500/10 text-text-secondary hover:text-red-400"
                      title="Delete audit"
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

      {/* Result panel */}
      {selectedAuditId && (
        <AuditResultPanel
          auditId={selectedAuditId}
          onClose={() => setSelectedAuditId(null)}
          onComplete={() => queryClient.invalidateQueries({ queryKey: ['seo', 'audits'] })}
          onRerun={(newId) => setSelectedAuditId(newId)}
        />
      )}

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <ConfirmDialog
          title={confirmDelete === 'all' ? 'Delete all audits?' : 'Delete audit?'}
          message={
            confirmDelete === 'all'
              ? 'This will permanently delete all audits. This cannot be undone.'
              : `Delete audit for ${confirmDelete.url}? This cannot be undone.`
          }
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Bulk audit modal */}
      {showBulk && (
        <BulkAuditModal
          onClose={() => { setShowBulk(false); queryClient.invalidateQueries({ queryKey: ['seo', 'audits'] }); }}
          onAuditStarted={(id) => setSelectedAuditId(id)}
        />
      )}
    </div>
  );
}

// ─── Add Keyword Modal ─────────────────────────────────────────────────────────
function AddKeywordModal({ onClose, onSaved, audits }) {
  const [keyword,     setKeyword]     = useState('');
  const [trackedUrl,  setTrackedUrl]  = useState('');
  const [discoverUrl, setDiscoverUrl] = useState('');
  const [suggestions, setSuggestions] = useState(null);  // null = not fetched yet
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverErr, setDiscoverErr] = useState('');

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/seo/keywords', data),
    onSuccess:  () => onSaved(),
  });

  const handleDiscover = async () => {
    setDiscoverErr('');
    setSuggestions(null);
    setDiscoverLoading(true);
    try {
      // Find the most recent completed audit for the given URL
      const matched = (audits ?? []).find(
        (a) => a.url === discoverUrl.trim() && (a.status === 'completed' || a.status === 'complete')
      );
      if (!matched) {
        setDiscoverErr('No completed audit found for this URL. Run an audit first.');
        setDiscoverLoading(false);
        return;
      }
      const res = await api.post('/seo/keywords/discover-from-audit', { auditId: matched.id });
      setSuggestions(res.data.data?.suggestions ?? []);
    } catch (e) {
      setDiscoverErr(e.response?.data?.error?.message || 'Discovery failed.');
    }
    setDiscoverLoading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    createMutation.mutate({
      keyword: keyword.trim(),
      trackedUrl: trackedUrl.trim() || undefined,
    });
  };

  const errMsg = createMutation.error?.response?.data?.error?.message || createMutation.error?.message;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
      <div className="bg-bg-card border border-border rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
          <h3 className="text-base font-semibold text-text-primary">Add Keyword</h3>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Keyword input */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Keyword <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              className="input-field w-full"
              placeholder="e.g. seo audit tool"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              maxLength={200}
              required
            />
          </div>

          {/* Tracked URL */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Tracked URL <span className="text-text-secondary font-normal">(optional)</span>
            </label>
            <input
              type="url"
              className="input-field w-full"
              placeholder="https://example.com"
              value={trackedUrl}
              onChange={(e) => setTrackedUrl(e.target.value)}
            />
          </div>

          {/* Discover from audit — collapsible */}
          <div className="border border-border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setDiscoverOpen((v) => !v)}
              className="w-full flex items-center gap-2 px-4 py-3 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-secondary/40 transition-colors text-left"
            >
              <Zap className="w-3.5 h-3.5 text-accent-blue shrink-0" />
              Discover suggestions from audit
              <ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform ${discoverOpen ? 'rotate-180' : ''}`} />
            </button>

            {discoverOpen && (
              <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border bg-bg-secondary/20">
                <div className="flex gap-2">
                  <input
                    type="url"
                    className="input-field flex-1 text-xs"
                    placeholder="https://example.com"
                    value={discoverUrl}
                    onChange={(e) => setDiscoverUrl(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleDiscover}
                    disabled={discoverLoading || !discoverUrl.trim()}
                    className="btn-secondary text-xs px-3 whitespace-nowrap"
                  >
                    {discoverLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Discover'}
                  </button>
                </div>

                {discoverErr && (
                  <p className="text-red-400 text-xs flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />{discoverErr}
                  </p>
                )}

                {suggestions !== null && (
                  suggestions.length === 0
                    ? <p className="text-text-secondary text-xs">No suggestions found in that audit.</p>
                    : (
                      <div className="flex flex-wrap gap-1.5">
                        {suggestions.map((s) => (
                          <button
                            key={s.keyword}
                            type="button"
                            onClick={() => setKeyword(s.keyword)}
                            className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                              keyword === s.keyword
                                ? 'bg-accent-blue/15 border-accent-blue/40 text-accent-blue'
                                : 'border-border text-text-secondary hover:border-accent-blue/40 hover:text-text-primary'
                            }`}
                          >
                            {s.keyword}
                          </button>
                        ))}
                      </div>
                    )
                )}
              </div>
            )}
          </div>

          {errMsg && (
            <p className="text-red-400 text-xs flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />{errMsg}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary text-sm px-4">Cancel</button>
            <button
              type="submit"
              disabled={createMutation.isPending || !keyword.trim()}
              className="btn-primary text-sm px-4"
            >
              {createMutation.isPending ? 'Adding…' : 'Add Keyword'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Keywords Tab ──────────────────────────────────────────────────────────────
function KeywordsTab() {
  const queryClient = useQueryClient();
  const [showAddModal,    setShowAddModal]    = useState(false);
  const [confirmDeleteKw, setConfirmDeleteKw] = useState(null); // keyword object | null

  const { data: keywords, isLoading, error } = useQuery({
    queryKey: ['seo', 'keywords'],
    queryFn:  () => api.get('/seo/keywords').then((r) => r.data.data?.keywords ?? r.data.data?.items ?? (Array.isArray(r.data.data) ? r.data.data : [])),
  });

  // Fetch audit list so the discover modal can match URL → auditId
  const { data: audits } = useQuery({
    queryKey: ['seo', 'audits'],
    queryFn:  () => api.get('/seo/audits').then((r) => r.data.data?.audits ?? r.data.data?.items ?? (Array.isArray(r.data.data) ? r.data.data : [])),
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post('/seo/keywords/sync'),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['seo', 'keywords'] });
      queryClient.invalidateQueries({ queryKey: ['seo', 'gaps'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/seo/keywords/${id}`),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['seo', 'keywords'] }),
  });

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {syncMutation.isSuccess && <span className="text-accent-green text-xs">Synced {syncMutation.data?.data?.data?.synced ?? ''} keywords</span>}
          {syncMutation.error && <span className="text-red-400 text-xs">Sync failed.</span>}
        </div>
        <div className="flex items-center gap-2">
          {(keywords?.length > 0) && (
            <button
              onClick={() => exportToCSV(
                (keywords ?? []).map(k => ({
                  keyword: k.keyword,
                  rank: k.currentRank ?? '—',
                  prev: k.previousRank ?? '—',
                  url: k.trackedUrl ?? '',
                  active: k.isActive ? 'Yes' : 'No',
                })),
                ['keyword', 'rank', 'prev', 'url', 'active'],
                'keywords',
                { rank: 'Current Rank', prev: 'Previous Rank', url: 'Tracked URL' }
              )}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />Export
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Keyword
          </button>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            {syncMutation.isPending ? 'Syncing…' : 'Sync Ranks'}
          </button>
        </div>
      </div>

      {/* Keyword table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-secondary/50">
                {['Keyword', 'Volume', 'Difficulty', 'Rank', 'Change', 'Opportunity', ''].map((h) => (
                  <th key={h} className="text-left text-text-secondary font-medium px-5 py-3.5 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? [...Array(6)].map((_, i) => <SkeletonRow key={i} cols={7} />) :
               error ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-red-400 text-sm">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-60" />
                  Failed to load keywords.
                </td></tr>
               ) : !keywords?.length ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-text-secondary text-sm">
                  No keywords tracked yet. Click <strong className="text-text-primary">Add Keyword</strong> to start.
                </td></tr>
               ) : keywords.map((kw) => (
                <tr key={kw.id} className="group hover:bg-bg-secondary/30 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-text-primary max-w-[200px]">
                    <span className="truncate block">{kw.keyword}</span>
                    {kw.trackedUrl && (
                      <span className="text-xs text-text-secondary truncate block max-w-[180px]">{kw.trackedUrl}</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-text-secondary whitespace-nowrap">
                    {(() => { const v = kw.volume ?? kw.searchVolume; return (v && v > 0) ? Number(v).toLocaleString() : '—'; })()}
                  </td>
                  <td className="px-5 py-3.5"><DifficultyBar value={kw.difficulty || 0} /></td>
                  <td className="px-5 py-3.5 text-text-secondary">{kw.currentRank != null ? kw.currentRank : '—'}</td>
                  <td className="px-5 py-3.5">
                    {(kw.previousRank != null || kw.currentRank != null) ? <RankChange change={kw.change ?? 0} /> : <span className="text-text-secondary text-xs">—</span>}
                  </td>
                  <td className="px-5 py-3.5"><OpportunityBadge score={kw.opportunityScore || 0} /></td>
                  {/* Delete button — group-hover reveal */}
                  <td className="px-3 py-3.5 w-10">
                    <div className="relative w-6 h-6">
                      <button
                        onClick={() => setConfirmDeleteKw(kw)}
                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-red-500/10 text-text-secondary hover:text-red-400"
                        title="Delete keyword"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
               ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add keyword modal */}
      {showAddModal && (
        <AddKeywordModal
          audits={audits}
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false);
            // Auto-sync to immediately populate volume/difficulty/opportunity
            syncMutation.mutate();
          }}
        />
      )}

      {/* Delete confirm dialog */}
      {confirmDeleteKw && (
        <ConfirmDialog
          title="Delete keyword?"
          message={`Remove "${confirmDeleteKw.keyword}" from tracking? This cannot be undone.`}
          onConfirm={() => { deleteMutation.mutate(confirmDeleteKw.id); setConfirmDeleteKw(null); }}
          onCancel={() => setConfirmDeleteKw(null)}
        />
      )}
    </div>
  );
}

// ─── Gaps Tab (unchanged) ─────────────────────────────────────────────────────
function GapsTab() {
  const { data: gaps, isLoading, error } = useQuery({
    queryKey: ['seo', 'gaps'],
    queryFn:  () => api.get('/seo/gaps').then((r) => r.data.data.gaps ?? []),
  });

  return (
    <div className="card p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-secondary/50">
              {['Keyword', 'Competitor', 'Their Rank', 'Our Rank', 'Priority'].map((h) => (
                <th key={h} className="text-left text-text-secondary font-medium px-5 py-3.5 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? [...Array(5)].map((_, i) => <SkeletonRow key={i} cols={5} />) :
             error ? (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-red-400 text-sm"><AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-60" />Failed to load gaps.</td></tr>
             ) : !gaps?.length ? (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-text-secondary text-sm">No keyword gaps found.</td></tr>
             ) : gaps.map((gap) => (
              <tr key={gap.id || `${gap.keyword}-${gap.competitor}`} className="hover:bg-bg-secondary/30 transition-colors">
                <td className="px-5 py-3.5 font-medium text-text-primary max-w-[180px] truncate">{gap.keyword}</td>
                <td className="px-5 py-3.5 text-text-secondary max-w-[160px] truncate">{gap.competitor}</td>
                <td className="px-5 py-3.5 text-text-secondary">{gap.theirRank ?? gap.competitorRank ?? '—'}</td>
                <td className="px-5 py-3.5 text-text-secondary">{gap.ourRank ?? gap.myRank ?? '—'}</td>
                <td className="px-5 py-3.5"><PriorityBadge priority={gap.priority} /></td>
              </tr>
             ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Content Briefs ────────────────────────────────────────────────────────────
const INTENT_CHIP = {
  informational: 'bg-blue-500/10 text-blue-400',
  commercial:    'bg-purple-500/10 text-purple-400',
  transactional: 'bg-green-500/10 text-green-400',
  navigational:  'bg-yellow-500/10 text-yellow-400',
};

function ContentBriefs() {
  const queryClient = useQueryClient();
  const [showGenerate, setShowGenerate] = useState(false);
  const [selectedBrief, setSelectedBrief]   = useState(null);
  const [pendingDelete, setPendingDelete]    = useState(null);

  const { data: briefs, isLoading, error } = useQuery({
    queryKey: ['seo', 'briefs'],
    queryFn:  () => api.get('/seo/briefs').then((r) => r.data.data?.briefs ?? r.data.data?.items ?? (Array.isArray(r.data.data) ? r.data.data : [])),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/seo/briefs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo', 'briefs'] });
      setPendingDelete(null);
      if (selectedBrief?.id === pendingDelete) setSelectedBrief(null);
    },
  });

  const handleDeleteConfirm = () => deleteMutation.mutate(pendingDelete);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Content Briefs</h2>
          <p className="text-xs text-text-secondary mt-0.5">AI-generated content strategy documents</p>
        </div>
        <button onClick={() => setShowGenerate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />Generate Brief
        </button>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-32 rounded-xl" />)}
        </div>
      ) : error ? (
        <div className="card text-center text-red-400 text-sm py-8">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-60" />Failed to load briefs.
        </div>
      ) : !briefs?.length ? (
        <div className="card text-center text-text-secondary text-sm py-10">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No content briefs yet</p>
          <p className="mt-1">Generate a brief using a target keyword to get started.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {briefs.map((brief) => {
            const intentChip = INTENT_CHIP[brief.searchIntent];
            const sectionCount = brief.outline?.length ?? 0;
            return (
              <div
                key={brief.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedBrief(brief)}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedBrief(brief)}
                className="card group hover:border-accent-blue/40 transition-colors cursor-pointer relative"
              >
                {/* Trash icon — top-right, reveal on hover */}
                <button
                  onClick={(e) => { e.stopPropagation(); setPendingDelete(brief.id); }}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/10 text-text-secondary hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-lg bg-accent-purple/10 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-accent-purple" />
                  </div>
                  {intentChip && (
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${intentChip}`}>
                      {brief.searchIntent}
                    </span>
                  )}
                </div>

                <h3 className="mt-3 text-sm font-semibold text-text-primary leading-snug line-clamp-2">
                  {brief.targetKeyword || brief.title}
                </h3>

                <div className="mt-2 flex items-center gap-3 text-xs text-text-secondary">
                  {sectionCount > 0 && <span>{sectionCount} sections</span>}
                  <span>{new Date(brief.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showGenerate && <GenerateBriefModal onClose={() => setShowGenerate(false)} />}

      {selectedBrief && (
        <BriefDetailModal
          brief={selectedBrief}
          onClose={() => setSelectedBrief(null)}
          onDelete={() => { setPendingDelete(selectedBrief.id); setSelectedBrief(null); }}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete brief?"
          message="This will permanently delete this content brief."
          onConfirm={handleDeleteConfirm}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

// ─── Monitors Tab ─────────────────────────────────────────────────────────────

function MonitorSparkline({ data }) {
  if (!data || data.length < 2) {
    return <div className="h-9 flex items-center justify-center text-xs text-text-secondary italic">No data yet</div>;
  }
  const scores = data.map((d) => d.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = Math.max(max - min, 10);
  const W = 120, H = 36, PAD = 3;
  const pts = scores.map((s, i) => {
    const x = PAD + (i / (scores.length - 1)) * (W - PAD * 2);
    const y = PAD + ((max - s) / range) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const last = scores[scores.length - 1];
  const color = last >= 75 ? '#10B981' : last >= 55 ? '#F59E0B' : '#EF4444';
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MonitorStatusBadge({ status }) {
  const cfg = {
    active:  { cls: 'bg-accent-green/10 text-accent-green border-accent-green/20',  label: 'Active' },
    paused:  { cls: 'bg-text-secondary/10 text-text-secondary border-text-secondary/20', label: 'Paused' },
    running: { cls: 'bg-accent-blue/10 text-accent-blue border-accent-blue/20',     label: 'Running' },
  };
  const { cls, label } = cfg[status] ?? cfg.active;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {status === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-accent-blue animate-pulse" />}
      {label}
    </span>
  );
}

function ScoreDeltaBadge({ delta }) {
  if (delta === null || delta === undefined) return <span className="text-xs text-text-secondary">—</span>;
  if (delta > 0) return <span className="flex items-center gap-0.5 text-accent-green text-xs font-medium"><TrendingUp className="w-3 h-3" />+{delta}</span>;
  if (delta < 0) return <span className="flex items-center gap-0.5 text-red-400 text-xs font-medium"><TrendingDown className="w-3 h-3" />{delta}</span>;
  return <span className="text-xs text-text-secondary">±0</span>;
}

function AddMonitorModal({ onClose, onSuccess }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ url: '', name: '', schedule: 'weekly' });
  const [err, setErr] = useState('');

  const mut = useMutation({
    mutationFn: (data) => api.post('/seo/monitors', data).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries(['monitors']);
      onSuccess?.();
      onClose();
    },
    onError: (e) => setErr(e.response?.data?.error?.message ?? 'Failed to create monitor'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-text-primary">Add SEO Monitor</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Website URL</label>
            <input
              className="input w-full"
              placeholder="https://example.com"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Monitor Name</label>
            <input
              className="input w-full"
              placeholder="My Main Site"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Check Schedule</label>
            <select
              className="input w-full"
              value={form.schedule}
              onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))}
            >
              <option value="weekly">Weekly</option>
              <option value="daily">Daily</option>
            </select>
          </div>
          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-border">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary flex-1"
            disabled={!form.url || !form.name || mut.isPending}
            onClick={() => mut.mutate(form)}
          >
            {mut.isPending ? 'Creating…' : 'Create Monitor'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MonitorDetailPanel({ monitor, onClose }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['monitor-timeline', monitor.id],
    queryFn:  () => api.get(`/seo/monitors/${monitor.id}/timeline?limit=20`).then((r) => r.data.data),
  });

  const pauseMut = useMutation({
    mutationFn: () => api.patch(`/seo/monitors/${monitor.id}/pause`).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries(['monitors']),
  });
  const resumeMut = useMutation({
    mutationFn: () => api.patch(`/seo/monitors/${monitor.id}/resume`).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries(['monitors']),
  });
  const runNowMut = useMutation({
    mutationFn: () => api.post(`/seo/monitors/${monitor.id}/run-now`).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries(['monitors']),
  });
  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/seo/monitors/${monitor.id}`),
    onSuccess: () => { qc.invalidateQueries(['monitors']); onClose(); },
  });

  const history = data?.history ?? [];
  const chartData = history.map((h) => ({
    date:  new Date(h.recordedAt).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    score: h.score,
    regressions:  h.regressions,
    improvements: h.improvements,
  }));

  const lastEntry = history[history.length - 1];
  const lastAlerts = lastEntry?.alerts ?? monitor.latestAlerts ?? [];

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-bg-card border-l border-border w-full max-w-lg h-full overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-text-primary">{monitor.name}</h2>
            <p className="text-xs text-text-secondary font-mono mt-0.5 truncate max-w-xs">{monitor.url}</p>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary ml-3 mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-6 space-y-6">
          {/* Action bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <MonitorStatusBadge status={monitor.status} />
            <span className="text-xs text-text-secondary bg-bg-secondary px-2.5 py-1 rounded-full capitalize">
              {monitor.schedule}
            </span>
            <div className="flex gap-2 ml-auto">
              <button
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                disabled={runNowMut.isPending || monitor.status === 'running'}
                onClick={() => runNowMut.mutate()}
              >
                <Play className="w-3 h-3" />
                {runNowMut.isPending ? 'Queued' : 'Run Now'}
              </button>
              {monitor.status === 'paused' ? (
                <button
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                  disabled={resumeMut.isPending}
                  onClick={() => resumeMut.mutate()}
                >
                  <Play className="w-3 h-3 text-accent-green" />
                  Resume
                </button>
              ) : (
                <button
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                  disabled={pauseMut.isPending || monitor.status === 'running'}
                  onClick={() => pauseMut.mutate()}
                >
                  <Pause className="w-3 h-3" />
                  Pause
                </button>
              )}
              <button
                className="btn-secondary text-xs px-3 py-1.5 text-red-400 hover:bg-red-500/10"
                disabled={deleteMut.isPending}
                onClick={() => { if (confirm('Delete this monitor?')) deleteMut.mutate(); }}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Score trend chart */}
          <div className="card">
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-3">Score History</p>
            {isLoading ? (
              <div className="skeleton h-40 rounded-lg" />
            ) : chartData.length < 2 ? (
              <div className="h-40 flex items-center justify-center text-sm text-text-secondary">
                <BarChart2 className="w-8 h-8 opacity-30 mr-2" />
                Run at least 2 audits to see a trend
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid stroke="#1A1E2E" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fill: '#8B92A5', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#8B92A5', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#141720', border: '1px solid #1E2236', borderRadius: 8 }}
                    labelStyle={{ color: '#8B92A5', fontSize: 11 }}
                    itemStyle={{ color: '#E8ECF4', fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={{ fill: '#3B82F6', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Latest alerts */}
          {lastAlerts.length > 0 && (
            <div className="card">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-3">
                Latest Alerts ({lastAlerts.length})
              </p>
              <div className="space-y-2">
                {lastAlerts.map((alert, i) => {
                  const sev = {
                    critical: 'text-red-400 bg-red-500/10 border-red-500/20',
                    high:     'text-orange-400 bg-orange-500/10 border-orange-500/20',
                    medium:   'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
                    info:     'text-accent-green bg-accent-green/10 border-accent-green/20',
                  }[alert.severity] ?? 'text-text-secondary bg-bg-secondary border-border';
                  return (
                    <div key={i} className={`border rounded-lg px-3 py-2.5 ${sev}`}>
                      <p className="text-xs font-medium">{alert.type.replace(/_/g, ' ').toUpperCase()}</p>
                      <p className="text-xs opacity-80 mt-0.5">{alert.message}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Regression / improvement table */}
          {history.length > 0 && (
            <div className="card">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-3">Run History</p>
              <div className="space-y-2">
                {[...history].reverse().slice(0, 8).map((h) => (
                  <div key={h.id} className="flex items-center justify-between gap-3 text-xs py-1.5 border-b border-border last:border-0">
                    <span className="text-text-secondary">
                      {new Date(h.recordedAt).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="font-semibold text-text-primary">{h.score}</span>
                    <span className="text-red-400">↓{h.regressions} regr.</span>
                    <span className="text-accent-green">↑{h.improvements} improv.</span>
                    <span className="text-text-secondary">{(h.alerts ?? []).length} alerts</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MonitorCard({ monitor, onSelect }) {
  const scoreDelta = monitor.scoreDelta;
  const lastScore  = monitor.lastScore;
  const alerts     = monitor.latestAlerts ?? [];
  const hasAlert   = alerts.some((a) => ['critical', 'high'].includes(a.severity));

  return (
    <div
      className={`card cursor-pointer hover:border-accent-blue/40 transition-colors ${hasAlert ? 'border-red-500/30' : ''}`}
      onClick={() => onSelect(monitor)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(monitor)}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-text-primary truncate">{monitor.name}</p>
            {hasAlert && <Bell className="w-3.5 h-3.5 text-red-400 shrink-0" />}
          </div>
          <p className="text-xs text-text-secondary font-mono truncate mt-0.5">{monitor.url}</p>
        </div>
        <MonitorStatusBadge status={monitor.status} />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-2xl font-bold text-text-primary">{lastScore ?? '—'}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <ScoreDeltaBadge delta={scoreDelta} />
            <span className="text-xs text-text-secondary capitalize">{monitor.schedule}</span>
          </div>
        </div>
        <MonitorSparkline data={monitor.sparkline} />
      </div>

      {alerts.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-text-secondary">{alerts.length} alert(s) — {alerts[0]?.message}</p>
        </div>
      )}

      {monitor.nextRunAt && (
        <p className="text-xs text-text-secondary mt-2">
          Next run: {new Date(monitor.nextRunAt).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  );
}

function MonitorsTab() {
  const [showAdd, setShowAdd]         = useState(false);
  const [selectedMonitor, setSelected] = useState(null);

  const { data: monitors = [], isLoading } = useQuery({
    queryKey: ['monitors'],
    queryFn:  () => api.get('/seo/monitors').then((r) => r.data.data),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">SEO Monitors</h2>
          <p className="text-xs text-text-secondary mt-0.5">Scheduled re-audits with regression detection</p>
        </div>
        <button className="btn-primary flex items-center gap-2 text-sm" onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4" />
          Add Monitor
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-36 rounded-xl" />)}
        </div>
      ) : monitors.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <BarChart2 className="w-12 h-12 text-text-secondary/30 mb-4" />
          <p className="text-sm font-medium text-text-primary">No monitors yet</p>
          <p className="text-xs text-text-secondary mt-1 max-w-xs">
            Add a monitor to track your site's SEO score over time and get alerts on regressions.
          </p>
          <button className="btn-primary mt-5 flex items-center gap-2" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4" />
            Add Your First Monitor
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {monitors.map((m) => (
            <MonitorCard key={m.id} monitor={m} onSelect={setSelected} />
          ))}
        </div>
      )}

      {showAdd && <AddMonitorModal onClose={() => setShowAdd(false)} />}
      {selectedMonitor && (
        <MonitorDetailPanel
          monitor={selectedMonitor}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const TABS = ['Audits', 'Keywords', 'Gaps', 'Monitors'];

export default function SeoPage() {
  const [searchParams] = useSearchParams();
  const initialUrl = searchParams.get('url') || '';
  const autoRun    = searchParams.get('autorun') === 'true';
  const [activeTab, setActiveTab] = useState('Audits');

  const feature = FEATURES.beacon;

  return (
    <div className="space-y-8">
      <FeatureHeader
        codename={feature.codename}
        label={feature.label}
        description={feature.description}
        color={feature.color}
        icon={Shield}
        badge={feature.badge}
        stats={feature.stats}
      />

      <div className="border-b border-border">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-accent-blue text-accent-blue'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'Audits'   && <AuditsTab initialUrl={initialUrl} autoRun={autoRun} />}
      {activeTab === 'Keywords' && <KeywordsTab />}
      {activeTab === 'Gaps'     && <GapsTab />}
      {activeTab === 'Monitors' && <MonitorsTab />}

      <div className="border-t border-border" />
      <ContentBriefs />
    </div>
  );
}
