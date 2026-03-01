import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield, Search, RefreshCw, Plus, X, AlertCircle,
  TrendingUp, TrendingDown, Minus, FileText,
  ChevronUp, ChevronDown, ChevronRight, Zap,
  CheckCircle, Clock, Activity, Globe, Link, AlertTriangle,
  Printer,
} from 'lucide-react';
import api from '../lib/api';

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

// ─── Generate Brief Modal (unchanged) ─────────────────────────────────────────
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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-bg-card border border-border rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary">Generate Content Brief</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
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
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? 'Generating…' : 'Generate Brief'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Audits Tab (updated) ─────────────────────────────────────────────────────
function AuditsTab() {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [selectedAuditId, setSelectedAuditId] = useState(null);

  const { data: audits, isLoading, error } = useQuery({
    queryKey: ['seo', 'audits'],
    queryFn:  () => api.get('/seo/audits').then((r) => r.data.data),
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
        <h3 className="text-sm font-semibold text-text-primary mb-3">Run New Audit</h3>
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
          <p className="text-xs text-text-secondary">Click any row to view full report</p>
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
                <button
                  key={audit.id}
                  onClick={() => setSelectedAuditId(audit.id)}
                  className={`w-full flex items-center gap-4 px-5 py-4 hover:bg-bg-secondary/40 transition-colors text-left ${isSelected ? 'bg-accent-blue/5 border-l-2 border-l-accent-blue' : ''}`}
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

                  <ChevronRight className="w-4 h-4 text-text-secondary shrink-0" />
                </button>
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
    </div>
  );
}

// ─── Keywords Tab (unchanged) ─────────────────────────────────────────────────
function KeywordsTab() {
  const queryClient = useQueryClient();

  const { data: keywords, isLoading, error } = useQuery({
    queryKey: ['seo', 'keywords'],
    queryFn:  () => api.get('/seo/keywords').then((r) => r.data.data),
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post('/seo/keywords/sync'),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['seo', 'keywords'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} className="btn-secondary flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          {syncMutation.isPending ? 'Syncing…' : 'Sync Ranks'}
        </button>
      </div>
      {syncMutation.isSuccess && <p className="text-accent-green text-sm">Ranks synced successfully.</p>}
      {syncMutation.error && <p className="text-red-400 text-sm">{syncMutation.error?.response?.data?.error?.message || 'Sync failed.'}</p>}

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-secondary/50">
                {['Keyword', 'Volume', 'Difficulty', 'Current Rank', 'Change', 'Opportunity'].map((h) => (
                  <th key={h} className="text-left text-text-secondary font-medium px-5 py-3.5 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? [...Array(6)].map((_, i) => <SkeletonRow key={i} cols={6} />) :
               error ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-red-400 text-sm"><AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-60" />Failed to load keywords.</td></tr>
               ) : !keywords?.length ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-text-secondary text-sm">No keywords tracked yet.</td></tr>
               ) : keywords.map((kw) => (
                <tr key={kw.id || kw.keyword} className="hover:bg-bg-secondary/30 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-text-primary max-w-[200px] truncate">{kw.keyword}</td>
                  <td className="px-5 py-3.5 text-text-secondary whitespace-nowrap">{Number(kw.volume || 0).toLocaleString()}</td>
                  <td className="px-5 py-3.5"><DifficultyBar value={kw.difficulty} /></td>
                  <td className="px-5 py-3.5 text-text-secondary">{kw.currentRank ?? kw.rank ?? '—'}</td>
                  <td className="px-5 py-3.5"><RankChange change={kw.change} /></td>
                  <td className="px-5 py-3.5"><OpportunityBadge score={kw.opportunityScore ?? kw.opportunity} /></td>
                </tr>
               ))}
            </tbody>
          </table>
        </div>
      </div>
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

// ─── Content Briefs (unchanged) ───────────────────────────────────────────────
function ContentBriefs() {
  const [showModal, setShowModal] = useState(false);

  const { data: briefs, isLoading, error } = useQuery({
    queryKey: ['seo', 'briefs'],
    queryFn:  () => api.get('/seo/briefs').then((r) => r.data.data),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Content Briefs</h2>
          <p className="text-xs text-text-secondary mt-0.5">AI-generated content strategy documents</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />Generate Brief
        </button>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-28 rounded-xl" />)}</div>
      ) : error ? (
        <div className="card text-center text-red-400 text-sm py-8"><AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-60" />Failed to load briefs.</div>
      ) : !briefs?.length ? (
        <div className="card text-center text-text-secondary text-sm py-10">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No content briefs yet</p>
          <p className="mt-1">Generate a brief using a target keyword to get started.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {briefs.map((brief) => (
            <div key={brief.id} className="card hover:border-accent-blue/40 transition-colors cursor-pointer">
              <div className="flex items-start justify-between gap-2">
                <div className="w-8 h-8 rounded-lg bg-accent-purple/10 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-accent-purple" />
                </div>
                <PriorityBadge priority={brief.priority || 'medium'} />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-text-primary leading-snug line-clamp-2">
                {brief.targetKeyword || brief.title}
              </h3>
              <p className="mt-1 text-xs text-text-secondary">
                {new Date(brief.createdAt || brief.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      )}

      {showModal && <GenerateBriefModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const TABS = ['Audits', 'Keywords', 'Gaps'];

export default function SeoPage() {
  const [activeTab, setActiveTab] = useState('Audits');

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-green/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-accent-green" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">SEO Intelligence</h1>
          <p className="text-sm text-text-secondary">Audits, keyword tracking, and competitive gaps</p>
        </div>
      </div>

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

      {activeTab === 'Audits'   && <AuditsTab />}
      {activeTab === 'Keywords' && <KeywordsTab />}
      {activeTab === 'Gaps'     && <GapsTab />}

      <div className="border-t border-border" />
      <ContentBriefs />
    </div>
  );
}
