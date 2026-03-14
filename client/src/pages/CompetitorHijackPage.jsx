import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Crosshair, Search, Target, Sparkles, CheckCircle2,
  TrendingUp, Key, Loader2,
  Globe, Code, MousePointer, AlertCircle, Clock,
  ChevronDown, BarChart3, ShieldAlert,
} from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../components/ui/Toast';
import Badge from '../components/ui/Badge';
import FeatureHeader from '../components/ui/FeatureHeader';
import MockDataBanner from '../components/ui/MockDataBanner';
import { FEATURES } from '../config/features';

// ─── Progress steps ────────────────────────────────────────────────────────────
const STEPS = [
  'Crawling their website…',
  'Extracting keywords and CTAs…',
  'Analyzing messaging angles…',
  'Generating AI insights…',
];

function AnalyzingAnimation({ step }) {
  return (
    <div className="card py-12 text-center space-y-4">
      <Loader2 className="w-8 h-8 text-accent-blue mx-auto animate-spin" />
      <p className="text-sm font-semibold text-text-primary">{STEPS[step % STEPS.length]}</p>
      <div className="flex justify-center gap-1.5 mt-2">
        {STEPS.map((_, i) => (
          <div key={i} className={`h-1 w-8 rounded-full transition-colors duration-500 ${i <= step ? 'bg-accent-blue' : 'bg-border'}`} />
        ))}
      </div>
    </div>
  );
}

// ─── Tech stack badge ──────────────────────────────────────────────────────────
const TECH_COLORS = {
  'Google Analytics': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'Facebook Pixel':   'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'React':            'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  'Next.js':          'bg-white/10 text-white/70 border-white/20',
  'WordPress':        'bg-sky-500/10 text-sky-400 border-sky-500/20',
  'Shopify':          'bg-green-500/10 text-green-400 border-green-500/20',
  'HubSpot':          'bg-orange-500/10 text-orange-300 border-orange-500/20',
  'Stripe':           'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Hotjar':           'bg-red-500/10 text-red-400 border-red-500/20',
  'Intercom':         'bg-blue-500/10 text-blue-300 border-blue-500/20',
  'Klaviyo':          'bg-green-500/10 text-green-300 border-green-500/20',
};

function TechBadge({ name }) {
  const cls = TECH_COLORS[name] || 'bg-border/40 text-text-secondary border-border';
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${cls}`}>{name}</span>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const secs = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ThreatBadge({ level }) {
  const map = {
    high:   'bg-red-500/10 text-red-400 border-red-500/20',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    low:    'bg-green-500/10 text-green-400 border-green-500/20',
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold uppercase tracking-wide ${map[level] || map.medium}`}>
      {level || 'unknown'} threat
    </span>
  );
}

// ─── Result renderer (shared between live and loaded-from-db) ─────────────────
function AnalysisResult({ result, onReanalyze, onAddKeyword, addKeywordPending }) {
  return (
    <div className="space-y-6">
      {/* Data quality banner */}
      {!result.isReal && (
        <MockDataBanner message="Live crawl was blocked by this site. Showing sample data structure — real data available for most sites." />
      )}
      {result.isReal && !result.hasAiInsights && (
        <MockDataBanner message="Real crawl data shown. AI attack-plan recommendations are limited until an AI provider is configured." />
      )}

      {/* From-cache notice */}
      {result._fromCache && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-bg-secondary border border-border text-xs text-text-secondary">
          <span className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            Loaded from last analysis {result._cachedAt ? timeAgo(result._cachedAt) : ''}
          </span>
          <button onClick={onReanalyze} className="text-accent-blue hover:underline">Run fresh analysis</button>
        </div>
      )}

      {/* Site overview */}
      {result.title && (
        <div className="card space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="w-4 h-4 text-accent-blue shrink-0" />
                <span className="text-xs text-text-secondary font-medium truncate">{result.url || result.domain}</span>
              </div>
              <h3 className="text-sm font-semibold text-text-primary leading-tight">{result.title}</h3>
              {result.description && (
                <p className="text-xs text-text-secondary mt-1 leading-relaxed line-clamp-2">{result.description}</p>
              )}
            </div>
            <div className="shrink-0 text-right space-y-1">
              <div>
                <p className="text-xs text-text-secondary">Links</p>
                <p className="text-lg font-bold text-text-primary">{result.linkCount ?? '—'}</p>
              </div>
              {result.threatLevel && <ThreatBadge level={result.threatLevel} />}
            </div>
          </div>

          {/* Tech stack */}
          {result.techStack?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Code className="w-3.5 h-3.5 text-text-secondary" />
                <span className="text-xs text-text-secondary font-medium">Tech Stack Detected</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.techStack.map((tech) => <TechBadge key={tech} name={tech} />)}
              </div>
            </div>
          )}

          {/* CTAs */}
          {result.ctas?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <MousePointer className="w-3.5 h-3.5 text-text-secondary" />
                <span className="text-xs text-text-secondary font-medium">Their Conversion CTAs</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.ctas.map((cta, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 rounded-lg bg-accent-green/10 text-accent-green border border-accent-green/20">{cta}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats row — real data only, no fakes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <Key className="w-4 h-4 text-accent-blue" />
            <p className="text-xs text-text-secondary font-medium">Keywords Found</p>
          </div>
          <p className="text-xl font-bold text-text-primary">{result.topKeywords?.length ?? 0}</p>
          {result.isReal && <p className="text-[10px] text-accent-blue/60 mt-0.5">from live crawl</p>}
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-accent-purple" />
            <p className="text-xs text-text-secondary font-medium">Actionable Moves</p>
          </div>
          <p className="text-xl font-bold text-text-primary">{(result.attackVectors?.length ?? 0) + (result.winbackOpportunities?.length ?? 0)}</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-accent-green" />
            <p className="text-xs text-text-secondary font-medium">Funnel Stage</p>
          </div>
          <p className="text-sm font-bold text-text-primary capitalize">
            {result.intentSignals?.summary?.funnelStage
              ? `${result.intentSignals.summary.funnelStage}-funnel`
              : result.intentSignals?.summary?.primaryIntent
              ? result.intentSignals.summary.primaryIntent
              : result.hasAiInsights ? 'See analysis' : '—'}
          </p>
          {result.intentSignals?.summary?.primaryIntent && (
            <p className="text-[10px] text-text-secondary mt-0.5 capitalize">{result.intentSignals.summary.primaryIntent} intent</p>
          )}
        </div>
      </div>

      {/* H1/H2 headings */}
      {result.headings?.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-text-primary mb-3">Their Page Structure</h2>
          <div className="card space-y-2">
            {result.headings.slice(0, 8).map((h, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-border/60 text-text-secondary font-mono shrink-0 mt-0.5">{h.tag}</span>
                <p className="text-xs text-text-primary leading-relaxed">{h.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top keywords from crawl */}
      {result.topKeywords?.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-text-primary mb-3">
            Top Keywords on Their Site
            {result.isReal && <span className="ml-2 text-[10px] text-accent-blue/70 font-normal">real crawl data</span>}
          </h2>
          <div className="flex flex-wrap gap-2">
            {result.topKeywords.slice(0, 15).map((kw, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-bg-secondary border border-border">
                <span className="text-xs text-text-primary font-medium">{kw.keyword || kw.word}</span>
                {kw.frequency && <span className="text-[10px] text-text-secondary">×{kw.frequency}</span>}
                <button
                  onClick={() => onAddKeyword(kw.keyword || kw.word)}
                  disabled={addKeywordPending}
                  className="text-[10px] text-accent-blue hover:underline ml-1"
                >
                  Track
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Keyword Gaps */}
      {result.keywordGaps?.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-text-primary mb-3">
            Keyword Gaps
            {result.hasAiInsights
              ? <span className="ml-2 text-[10px] text-accent-purple/70 font-normal">AI analysis</span>
              : <span className="ml-2 text-[10px] text-text-secondary font-normal">from crawl</span>}
          </h2>
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-bg-secondary/30">
                    {['Keyword', 'Their Rank', 'Your Rank', 'Opportunity', 'Action'].map((h) => (
                      <th key={h} className="text-left text-xs text-text-secondary font-medium px-4 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.keywordGaps.map((gap, i) => (
                    <tr key={i} className="hover:bg-bg-secondary/20">
                      <td className="px-4 py-2.5 text-text-primary font-medium text-xs">{gap.keyword}</td>
                      <td className="px-4 py-2.5 text-accent-green text-xs font-semibold">{gap.theirRank ? `#${gap.theirRank}` : 'Ranking'}</td>
                      <td className="px-4 py-2.5 text-xs">
                        {gap.yourRank
                          ? <span className="text-yellow-400">#{gap.yourRank}</span>
                          : <span className="text-text-secondary italic">Not ranking</span>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-text-secondary max-w-[180px]">{gap.opportunity || gap.difficulty || '—'}</td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => onAddKeyword(gap.keyword)}
                          disabled={addKeywordPending}
                          className="text-xs px-2 py-1 rounded-lg bg-accent-blue/10 hover:bg-accent-blue/20 text-accent-blue transition-colors"
                        >
                          Track
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* AI Counter-Ads / Competitor Ad Examples */}
      {result.adExamples?.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-text-primary mb-3">
            {result.hasAiInsights ? 'AI-Suggested Counter-Ads' : 'Competitor Ad Examples'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {result.adExamples.map((ad, i) => (
              <div key={i} className="card space-y-2">
                <div className="flex items-center justify-between">
                  <Badge status={ad.platform?.toLowerCase()} />
                  <span className="text-[10px] text-text-secondary">Ad #{i + 1}</span>
                </div>
                <p className="text-sm font-semibold text-accent-blue">{ad.headline}</p>
                {ad.description && <p className="text-xs text-text-secondary leading-relaxed">{ad.description}</p>}
                {ad.cta && <p className="text-xs text-accent-green font-medium">CTA: {ad.cta}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Win-back Opportunities */}
      <div>
        <h2 className="text-sm font-semibold text-text-primary mb-3">Win-back Opportunities</h2>
        {result.winbackOpportunities?.length > 0 ? (
          <div className="space-y-3">
            {result.winbackOpportunities.map((opp, i) => (
              <div key={i} className="card space-y-2">
                <div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent-purple/10 text-accent-purple border border-accent-purple/20 font-medium">
                    {opp.angle}
                  </span>
                  <p className="text-sm font-semibold text-text-primary mt-2">{opp.suggestedHeadline}</p>
                  <p className="text-xs text-text-secondary mt-1 leading-relaxed">{opp.reason}</p>
                  {opp.action && <p className="text-xs text-accent-blue mt-1">Move: {opp.action}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-xs text-text-secondary leading-relaxed">
            {result.winbackUnavailableReason || 'No evidence-backed win-back opportunity is available yet.'}
          </div>
        )}
      </div>

      {/* Counter-Ad Templates */}
      {result.counterAdTemplates?.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-text-primary mb-3">Counter-Ad Templates</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {result.counterAdTemplates.map((ad, i) => (
              <div key={i} className="card space-y-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-accent-purple/10 text-accent-purple border border-accent-purple/20 font-medium">{ad.angle}</span>
                <p className="text-sm font-semibold text-text-primary">{ad.headline}</p>
                <p className="text-xs text-text-secondary">{ad.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messaging angles */}
      {result.messagingAngles?.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Their Messaging Angles</h3>
          <div className="flex flex-wrap gap-2">
            {result.messagingAngles.map((angle) => (
              <span key={angle} className="text-xs px-3 py-1.5 rounded-full border border-border text-text-secondary">{angle}</span>
            ))}
          </div>
        </div>
      )}

      {/* Weaknesses */}
      {result.weaknesses?.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary mb-3">
            Their Weaknesses to Exploit
            <span className="ml-2 text-[10px] text-accent-purple/70 font-normal">AI analysis</span>
          </h3>
          <ul className="space-y-2">
            {result.weaknesses.map((w, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-accent-green shrink-0 mt-0.5" />
                <span className="text-xs text-text-secondary leading-relaxed">{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Attack vectors */}
      {result.attackVectors?.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            Attack Vectors
          </h3>
          <ul className="space-y-2">
            {result.attackVectors.map((v, i) => (
              <li key={i} className="flex items-start gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-accent-orange shrink-0 mt-0.5" />
                <span className="text-xs text-text-secondary leading-relaxed">{typeof v === 'string' ? v : v.description || v.angle || JSON.stringify(v)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Data gaps */}
      {result.dataGaps?.length > 0 && (
        <div className="rounded-xl border border-border px-4 py-3 text-xs text-text-secondary space-y-1">
          <p className="font-semibold text-text-primary mb-2">Data Gaps</p>
          {result.dataGaps.map((g, i) => (
            <p key={i} className="flex items-start gap-1.5"><span className="text-amber-400">⚠</span>{g}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CompetitorHijackPage() {
  const toast       = useToast();
  const queryClient = useQueryClient();
  const [domain, setDomain]             = useState('');
  const [analysisStep, setAnalysisStep] = useState(0);
  const [result, setResult]             = useState(null);
  const [analyzing, setAnalyzing]       = useState(false);
  const [errorMsg, setErrorMsg]         = useState('');
  const [showHistory, setShowHistory]   = useState(false);

  const feature = FEATURES.radar;

  // Load tracked competitors for quick-analyze
  const { data: trackedCompetitors } = useQuery({
    queryKey: ['competitors'],
    queryFn: () => api.get('/competitors').then((r) => r.data.data?.competitors ?? []),
  });

  // Load recent Radar analyses from DB
  const { data: recentReports } = useQuery({
    queryKey: ['research', 'reports', 'adIntel'],
    queryFn: () => api.get('/research/reports?kind=adIntel&limit=8').then((r) => r.data.data?.reports ?? []),
  });

  // Auto-load last analysis on first mount if no current result
  const { data: latestReport } = useQuery({
    queryKey: ['research', 'reports', 'latest', 'adIntel'],
    queryFn: () => api.get('/research/reports/latest?kind=adIntel').then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!result && !analyzing && latestReport?.adAnalysis) {
      const data = latestReport.adAnalysis;
      setResult({ ...data, _fromCache: true, _cachedAt: latestReport.createdAt });
      if (data.domain) setDomain(data.domain);
    }
  }, [latestReport]);

  const handleAnalyze = async (overrideDomain) => {
    const target = (overrideDomain || domain).trim();
    if (!target) return;
    setDomain(target);
    setAnalyzing(true);
    setResult(null);
    setErrorMsg('');
    setAnalysisStep(0);

    const interval = setInterval(() => setAnalysisStep((s) => s + 1), 1200);

    try {
      const res = await api.get(`/research/hijack-analysis?domain=${encodeURIComponent(target)}`);
      clearInterval(interval);
      setResult(res.data.data);
      queryClient.invalidateQueries({ queryKey: ['research', 'reports'] });
    } catch (err) {
      clearInterval(interval);
      const message = err?.response?.data?.error?.message || 'Analysis failed';
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setAnalyzing(false);
    }
  };

  const addKeywordMutation = useMutation({
    mutationFn: (keyword) => api.post('/seo/keywords', { keyword }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo', 'keywords'] });
      toast.success('Keyword added to tracking');
    },
    onError: (err) => toast.error(err?.response?.data?.error?.message || 'Failed to add keyword'),
  });

  const loadReport = (report) => {
    if (!report?.adAnalysis) return;
    setResult({ ...report.adAnalysis, _fromCache: true, _cachedAt: report.createdAt });
    if (report.adAnalysis.domain) setDomain(report.adAnalysis.domain);
    setShowHistory(false);
    setErrorMsg('');
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <FeatureHeader
        codename={feature.codename}
        label={feature.label}
        description={feature.description}
        color={feature.color}
        icon={Crosshair}
        badge={feature.badge}
        stats={feature.stats}
      />

      {/* ── Analysis input ───────────────────────────────────────────────── */}
      <div className="card space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Analyze Competitor</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Enter a domain to reveal their page structure, keywords, tech stack, CTAs, and AI attack plan
            </p>
          </div>
          {recentReports?.length > 0 && (
            <div className="relative shrink-0">
              <button
                onClick={() => setShowHistory((v) => !v)}
                className="flex items-center gap-1.5 btn-secondary text-xs"
              >
                <Clock className="w-3.5 h-3.5" />
                History
                <ChevronDown className={`w-3 h-3 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
              </button>
              {showHistory && (
                <div className="absolute right-0 mt-1 w-64 bg-bg-card border border-border rounded-xl shadow-xl z-20 overflow-hidden">
                  <p className="text-xs text-text-secondary font-medium px-3 py-2 border-b border-border">Recent Analyses</p>
                  {recentReports.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => loadReport(r)}
                      className="w-full text-left px-3 py-2.5 hover:bg-bg-secondary transition-colors border-b border-border/50 last:border-0"
                    >
                      <p className="text-xs font-medium text-text-primary truncate">{r.adAnalysis?.domain || r.query || 'Unknown'}</p>
                      <p className="text-[10px] text-text-secondary mt-0.5">{timeAgo(r.createdAt)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick-analyze tracked competitors */}
        {trackedCompetitors?.length > 0 && (
          <div>
            <p className="text-xs text-text-secondary mb-2">Tracked competitors:</p>
            <div className="flex flex-wrap gap-1.5">
              {trackedCompetitors.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleAnalyze(c.domain)}
                  disabled={analyzing}
                  className="text-xs px-2.5 py-1 rounded-lg border border-border text-text-secondary hover:text-accent-purple hover:border-accent-purple/30 hover:bg-accent-purple/5 transition-colors"
                >
                  {c.domain}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <input
            className="input-field flex-1"
            placeholder="competitor.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
            disabled={analyzing}
          />
          <button
            onClick={() => handleAnalyze()}
            disabled={!domain.trim() || analyzing}
            className="btn-primary whitespace-nowrap flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            {analyzing ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
      </div>

      {/* ── Analyzing animation ──────────────────────────────────────────── */}
      {analyzing && <AnalyzingAnimation step={analysisStep} />}

      {errorMsg && !analyzing && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-300">Competitor analysis failed</p>
              <p className="text-xs text-text-secondary mt-1">{errorMsg}</p>
            </div>
          </div>
          <button onClick={() => handleAnalyze()} className="btn-secondary text-sm whitespace-nowrap">Try Again</button>
        </div>
      )}

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {result && !analyzing && (
        <AnalysisResult
          result={result}
          onReanalyze={() => handleAnalyze()}
          onAddKeyword={(kw) => addKeywordMutation.mutate(kw)}
          addKeywordPending={addKeywordMutation.isPending}
        />
      )}

      {/* ── Empty state (no result, no analyzing) ────────────────────────── */}
      {!result && !analyzing && !errorMsg && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: Globe,    color: 'text-accent-blue',   bg: 'bg-accent-blue/10',   title: 'Real Site Crawl',         desc: 'See their actual page structure, headlines, CTAs, and technology stack' },
            { icon: Key,      color: 'text-accent-blue',   bg: 'bg-accent-blue/10',   title: 'Keyword Intelligence',    desc: 'Extract keywords they emphasize most — and track the gaps against your site' },
            { icon: Target,   color: 'text-accent-purple', bg: 'bg-accent-purple/10', title: 'Messaging Analysis',      desc: 'Identify their positioning, funnel stage, and buyer intent signals' },
            { icon: Sparkles, color: 'text-accent-green',  bg: 'bg-accent-green/10',  title: 'AI Attack Plan',          desc: 'AI generates keyword gaps, weaknesses, and counter-ad templates from live crawl' },
          ].map((f) => (
            <div key={f.title} className="card">
              <div className={`w-9 h-9 rounded-xl ${f.bg} flex items-center justify-center mb-3`}>
                <f.icon className={`w-4 h-4 ${f.color}`} />
              </div>
              <p className="text-sm font-semibold text-text-primary">{f.title}</p>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
