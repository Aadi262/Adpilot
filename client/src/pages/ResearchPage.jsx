import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Globe, Search, Plus, Trash2, Target,
  AlertCircle, Zap, Loader2, Sparkles, FlaskConical, Download, ChevronDown,
} from 'lucide-react';
import { downloadMarkdownReport } from '../lib/exportReport';
import api from '../lib/api';
import { useToast } from '../components/ui/Toast';
import FeatureHeader from '../components/ui/FeatureHeader';
import { FEATURES } from '../config/features';

// ─── Competitor section ───────────────────────────────────────────────────────
function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
      <div className="bg-bg-card border border-border rounded-xl shadow-2xl max-w-sm w-full p-6">
        <h3 className="text-base font-semibold text-text-primary mb-2">{title}</h3>
        <p className="text-sm text-text-secondary mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="btn-secondary text-sm px-4">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function CompetitorSection() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [domain, setDomain] = useState('');
  const [name, setName]     = useState('');
  const [pendingDel, setPendingDel] = useState(null);

  const { data: competitors, isLoading } = useQuery({
    queryKey: ['competitors'],
    queryFn:  () => api.get('/competitors').then((r) => r.data.data?.competitors ?? r.data.data ?? []),
  });

  const { data: gaps } = useQuery({
    queryKey: ['seo', 'gaps'],
    queryFn:  () => api.get('/seo/gaps').then((r) => r.data.data),
  });

  const addMutation = useMutation({
    mutationFn: () => api.post('/competitors', { domain: domain.trim(), name: name.trim() || domain.trim() }),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['competitors'] });
      setDomain(''); setName('');
      toast.success('Competitor added');
    },
    onError: (err) => toast.error(err?.response?.data?.error?.message || 'Failed to add competitor'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/competitors/${id}`),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['competitors'] }); setPendingDel(null); toast.success('Competitor removed'); },
  });

  const gapRows = gaps?.gaps ?? gaps ?? [];

  return (
    <div className="space-y-4">
      {/* Early access banner */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
          <FlaskConical className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-amber-400">Research Engine</p>
          <p className="text-xs text-white/40 mt-0.5">
            Live crawl, SERP, traffic, and intent signals are surfaced source-by-source. Missing premium APIs are shown as data gaps instead of fake confidence.
          </p>
        </div>
      </div>

      {/* Add competitor */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Add Competitor</h3>
        <div className="flex gap-2">
          <input
            className="input-field flex-1"
            placeholder="competitor.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          />
          <input
            className="input-field w-40"
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            onClick={() => addMutation.mutate()}
            disabled={!domain.trim() || addMutation.isPending}
            className="btn-primary whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Competitor list */}
      {!isLoading && (competitors ?? []).length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Tracked Competitors</h3>
            <button
              onClick={() => downloadMarkdownReport('Competitor Tracking Report', [
                {
                  title: 'Summary',
                  items: [
                    `Tracked competitors: ${(competitors ?? []).length}`,
                    `Gap rows available: ${gapRows.length}`,
                  ],
                },
                {
                  title: 'Tracked Competitors',
                  table: {
                    headers: ['Domain', 'Name', 'Added'],
                    rows: (competitors ?? []).map((c) => [
                      c.domain,
                      c.name ?? c.domain,
                      new Date(c.createdAt).toLocaleDateString(),
                    ]),
                  },
                },
              ], 'competitors-report')}
              className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              <Download className="w-3.5 h-3.5" />Export
            </button>
          </div>
          <div className="divide-y divide-border">
            {(competitors ?? []).map((c) => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3 group">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded bg-accent-blue/10 flex items-center justify-center">
                    <Globe className="w-3.5 h-3.5 text-accent-blue" />
                  </div>
                  <div>
                    <p className="text-sm text-text-primary font-medium">{c.name || c.domain}</p>
                    <p className="text-xs text-text-secondary">{c.domain}</p>
                  </div>
                </div>
                <button
                  onClick={() => setPendingDel(c)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Keyword gaps */}
      {gapRows.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Keyword Opportunities</h3>
            <span className="text-xs text-text-secondary">{gapRows.length} gaps found</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-secondary/30">
                  {['Keyword', 'Competitor Rank', 'Your Rank', 'Opportunity'].map((h) => (
                    <th key={h} className="text-left text-xs text-text-secondary font-medium px-5 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {gapRows.slice(0, 10).map((g, i) => (
                  <tr key={i} className="hover:bg-bg-secondary/20">
                    <td className="px-5 py-2.5 text-text-primary font-medium">{g.keyword}</td>
                    <td className="px-5 py-2.5 text-green-400">#{g.competitorRank ?? g.competitor_rank ?? '—'}</td>
                    <td className="px-5 py-2.5 text-text-secondary">#{g.ourRank ?? g.our_rank ?? '—'}</td>
                    <td className="px-5 py-2.5">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent-purple/10 text-accent-purple">
                        High
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pendingDel && (
        <ConfirmDialog
          title="Remove competitor?"
          message={`Remove "${pendingDel.name || pendingDel.domain}" from your tracked list?`}
          onConfirm={() => deleteMutation.mutate(pendingDel.id)}
          onCancel={() => setPendingDel(null)}
        />
      )}
    </div>
  );
}

// ─── Market Research section ──────────────────────────────────────────────────
function normalizeMarketResearchResult(data = {}) {
  return {
    domain: data.domain,
    crawlFailed: data.crawlFailed || !data.isReal,
    isReal: data.isReal,
    title: data.title || data.domain,
    description: data.description || '',
    topKeywords: (data.topKeywords || []).slice(0, 8).map((k) => ({
      keyword: typeof k === 'string' ? k : k.word || k.keyword || '',
      position: typeof k === 'string' ? null : k.position ?? null,
      volume: typeof k === 'string' ? null : k.volume ?? k.searchVolume ?? null,
    })).filter((k) => k.keyword),
    headlines: (data.headings || []).slice(0, 6).map((h) => (typeof h === 'string' ? h : h.text || '')).filter(Boolean),
    techStack: data.techStack || [],
    ctas: (data.ctas || []).slice(0, 6),
    messagingAngles: data.messagingAngles || [],
    weaknesses: data.weaknesses || [],
    strengths: data.strengths || [],
    keywordGaps: (data.keywordGaps || []).slice(0, 5),
    hasAiInsights: data.hasAiInsights || false,
    threatLevel: data.threatLevel || null,
    contentTypes: data.contentStrategy?.contentTypes || [],
    topics: data.contentStrategy?.topics || [],
    companySnapshot: data.companySnapshot || {},
    technicalSignals: data.technicalSignals || {},
    trafficSignals: data.trafficSignals || {},
    techSignals: data.techSignals || {},
    intentSignals: data.intentSignals || {},
    sourceMatrix: data.sourceMatrix || [],
    evidenceLog: data.evidenceLog || [],
    dataGaps: data.dataGaps || [],
    socialLinks: data.socialLinks || [],
    siteSurfaces: data.siteSurfaces || {},
    contentFootprint: data.contentFootprint || {},
    structuredDataTypes: data.structuredDataTypes || [],
    ragContext: data.ragContext || {},
    savedAt: data.savedAt || null,
  };
}

function normalizeAdIntelResult(data = {}) {
  return {
    ...data,
    sourceMatrix: data.sourceMatrix || [],
    evidenceLog: data.evidenceLog || [],
    dataGaps: data.dataGaps || [],
    companySnapshot: data.companySnapshot || {},
    technicalSignals: data.technicalSignals || {},
    trafficSignals: data.trafficSignals || {},
    techSignals: data.techSignals || {},
    intentSignals: data.intentSignals || {},
    contentFootprint: data.contentFootprint || {},
    siteSurfaces: data.siteSurfaces || {},
    socialLinks: data.socialLinks || [],
    structuredDataTypes: data.structuredDataTypes || [],
    ragContext: data.ragContext || {},
  };
}

function SavedReportCard({ title, subtitle, isExpanded, onToggle, children }) {
  return (
    <div className="card">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">{title}</p>
          {subtitle && <p className="text-xs text-text-secondary mt-1">{subtitle}</p>}
        </div>
        {isExpanded ? <ChevronDown className="w-4 h-4 text-text-secondary rotate-180 transition-transform" /> : <ChevronDown className="w-4 h-4 text-text-secondary transition-transform" />}
      </button>
      {isExpanded && <div className="mt-4">{children}</div>}
    </div>
  );
}

function SourcePill({ item }) {
  const status = item?.status || 'unavailable';
  const cls =
    status === 'ok' ? 'bg-accent-green/10 text-accent-green border-accent-green/20' :
    status === 'degraded_cache' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
    status === 'quota_exhausted' || status === 'rate_limited' || status === 'unavailable' || status === 'missing_key'
      ? 'bg-red-500/10 text-red-300 border-red-500/20'
      : 'bg-accent-blue/10 text-accent-blue border-accent-blue/20';

  return (
    <div className={`rounded-xl border px-3 py-2 ${cls}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider">{String(item?.source || 'source').replace(/_/g, ' ')}</p>
        {(item?.confidence || item?.freshness) && (
          <span className="text-[10px] uppercase tracking-wider opacity-80">
            {[item?.confidence, item?.freshness].filter(Boolean).join(' · ')}
          </span>
        )}
      </div>
      <p className="text-xs mt-1 leading-relaxed">{item?.detail || item?.message || 'No detail available'}</p>
    </div>
  );
}

function DossierSection({ title, subtitle, children }) {
  return (
    <div className="card space-y-3">
      <div>
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{title}</p>
        {subtitle && <p className="text-xs text-text-secondary mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function SignalCard({ title, value, subtitle, tone = 'blue' }) {
  const toneMap = {
    blue: 'text-accent-blue',
    green: 'text-accent-green',
    amber: 'text-amber-400',
    purple: 'text-accent-purple',
  };
  return (
    <div className="rounded-xl border border-border px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wider text-text-secondary">{title}</p>
      <p className={`text-sm font-semibold mt-1 ${toneMap[tone] || toneMap.blue}`}>{value}</p>
      {subtitle && <p className="text-[11px] text-text-secondary mt-1 leading-relaxed">{subtitle}</p>}
    </div>
  );
}

function MarketResearchSection() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [result, setResult] = useState(null);
  const [expandedReportId, setExpandedReportId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [step, setStep] = useState(0);
  const resultRef = useRef(null);
  const ANALYZE_STEPS = ['Crawling site…', 'Analyzing keywords…', 'Generating insights…'];

  const { data: latestMarketReport } = useQuery({
    queryKey: ['research', 'latest', 'market'],
    queryFn: () => api.get('/research/reports/latest?kind=market').then((r) => r.data.data.report),
    staleTime: 5 * 60 * 1000,
  });

  const { data: marketReports = [] } = useQuery({
    queryKey: ['research', 'reports', 'market'],
    queryFn: () => api.get('/research/reports?kind=market&limit=8').then((r) => r.data.data.reports || []),
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (!latestMarketReport?.analysis) return;
    setResult(normalizeMarketResearchResult({
      ...latestMarketReport.analysis,
      savedAt: latestMarketReport.createdAt,
    }));
    setExpandedReportId((current) => current ?? latestMarketReport.id);
  }, [latestMarketReport]);

  const analyze = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setErrorMsg('');
    setResult(null);
    setStep(0);
    const interval = setInterval(() => setStep((s) => s + 1), 1100);
    try {
      const res = await api.post('/competitors/analyze', { url: url.trim() });
      const data = res.data.data;
      setResult(normalizeMarketResearchResult(data));
      setUrl('');
      setExpandedReportId(data.reportId || null);
      queryClient.invalidateQueries({ queryKey: ['research', 'latest', 'market'] });
      queryClient.invalidateQueries({ queryKey: ['research', 'reports', 'market'] });
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      toast.success((!data.isReal) ? 'Analysis complete (demo data — site blocked crawl)' : 'Market analysis complete');
    } catch (err) {
      const message = err.response?.data?.error?.message || 'Analysis failed';
      setErrorMsg(message);
      toast.error(message);
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Analyze Market</h3>
          <p className="text-xs text-text-secondary mt-0.5">Enter your target URL to discover market positioning and opportunities</p>
        </div>
        <div className="flex gap-2">
          <input
            className="input-field flex-1"
            placeholder="https://yourdomain.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            onClick={analyze}
            disabled={!url.trim() || loading}
            className="btn-primary whitespace-nowrap flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {loading ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>

        {loading && (
          <div className="pt-2 space-y-2">
            <p className="text-xs text-text-secondary">{ANALYZE_STEPS[step % ANALYZE_STEPS.length]}</p>
            <div className="flex gap-1.5">
              {ANALYZE_STEPS.map((_, i) => (
                <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-accent-blue' : 'bg-border'}`} />
              ))}
            </div>
          </div>
        )}

        {errorMsg && !loading && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-300">Analysis failed</p>
                <p className="text-xs text-text-secondary mt-1">{errorMsg}</p>
              </div>
            </div>
            <button onClick={analyze} className="btn-secondary text-sm whitespace-nowrap">Try Again</button>
          </div>
        )}
      </div>

      {(marketReports.length > 0 || result) && (
        <div ref={resultRef} className="space-y-4">
          {marketReports.map((report) => {
            const savedResult = normalizeMarketResearchResult({
              ...(report.analysis || {}),
              savedAt: report.createdAt,
            });
            const expanded = expandedReportId === report.id;
            return (
              <SavedReportCard
                key={report.id}
                title={savedResult.title || savedResult.domain || report.query}
                subtitle={`${report.query} • ${new Date(report.createdAt).toLocaleString()}`}
                isExpanded={expanded}
                onToggle={() => setExpandedReportId(expanded ? null : report.id)}
              >
                <div className="space-y-4">
                  {savedResult.crawlFailed && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      Demo data shown — site blocked automated crawl. Add as competitor for ongoing tracking.
                    </div>
                  )}

                  <div className="text-xs text-text-secondary">
                    Saved {new Date(savedResult.savedAt).toLocaleString()}
                  </div>

                  <div className="card space-y-3">
                    <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">{savedResult.domain}</p>
                    <p className="text-sm text-text-primary font-medium">{savedResult.title}</p>
                    {savedResult.description && <p className="text-xs text-text-secondary mt-1 line-clamp-2">{savedResult.description}</p>}
                    {savedResult.threatLevel && <p className="text-xs text-accent-blue mt-2">Threat level: {savedResult.threatLevel}</p>}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl border border-border px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wider text-text-secondary">Observed URLs</p>
                        <p className="text-sm font-semibold text-text-primary mt-1">{savedResult.contentFootprint?.totalInternalPagesObserved || 0}</p>
                      </div>
                      <div className="rounded-xl border border-border px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wider text-text-secondary">Schema Types</p>
                        <p className="text-sm font-semibold text-text-primary mt-1">{savedResult.structuredDataTypes?.length || 0}</p>
                      </div>
                      <div className="rounded-xl border border-border px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wider text-text-secondary">Social Links</p>
                        <p className="text-sm font-semibold text-text-primary mt-1">{savedResult.socialLinks?.length || 0}</p>
                      </div>
                    </div>
                  </div>

                  {savedResult.sourceMatrix?.length > 0 && (
                    <DossierSection title="Research Sources" subtitle="What powered this report">
                      <div className="grid sm:grid-cols-2 gap-2">
                        {savedResult.sourceMatrix.map((item, idx) => (
                          <SourcePill key={`${item.source}-${idx}`} item={item} />
                        ))}
                      </div>
                    </DossierSection>
                  )}

                  {savedResult.companySnapshot?.primaryOffer && (
                    <DossierSection title="Company Snapshot" subtitle="Derived from the live crawl and research layer">
                      <div className="space-y-2">
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-text-secondary">Primary Offer</p>
                          <p className="text-sm text-text-primary font-medium mt-1">{savedResult.companySnapshot.primaryOffer}</p>
                        </div>
                        {savedResult.companySnapshot.positioning && (
                          <div>
                            <p className="text-[11px] uppercase tracking-wider text-text-secondary">Positioning</p>
                            <p className="text-xs text-text-secondary mt-1 leading-relaxed">{savedResult.companySnapshot.positioning}</p>
                          </div>
                        )}
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div className="rounded-xl border border-border px-3 py-2">
                            <p className="text-[11px] uppercase tracking-wider text-text-secondary">Target Audience</p>
                            <p className="text-sm text-text-primary mt-1">{savedResult.companySnapshot.targetAudience || 'Unknown'}</p>
                          </div>
                          <div className="rounded-xl border border-border px-3 py-2">
                            <p className="text-[11px] uppercase tracking-wider text-text-secondary">Primary CTA</p>
                            <p className="text-sm text-text-primary mt-1">{savedResult.companySnapshot.primaryCallToAction || 'Unavailable'}</p>
                          </div>
                        </div>
                      </div>
                    </DossierSection>
                  )}

                  <div className="grid sm:grid-cols-2 gap-4">
                    <DossierSection title="Reach Signals" subtitle="External popularity and scale hints">
                      <div className="grid grid-cols-2 gap-2">
                        <SignalCard
                          title="Best Known Rank"
                          value={savedResult.trafficSignals?.summary?.bestKnownGlobalRank ? `#${savedResult.trafficSignals.summary.bestKnownGlobalRank}` : 'Unavailable'}
                          subtitle={savedResult.trafficSignals?.summary?.available ? `${savedResult.trafficSignals.summary.confidence} confidence` : 'No external rank provider available'}
                          tone="blue"
                        />
                        <SignalCard
                          title="Traffic Confidence"
                          value={savedResult.trafficSignals?.summary?.confidence || 'low'}
                          subtitle={savedResult.trafficSignals?.providers?.filter((item) => item.status === 'ok').length ? 'Provider-backed' : 'crawl-only fallback'}
                          tone="amber"
                        />
                      </div>
                      {(savedResult.trafficSignals?.providers || []).length > 0 && (
                        <div className="grid gap-2">
                          {savedResult.trafficSignals.providers.map((item) => (
                            <SourcePill key={item.source} item={{ source: item.source, status: item.status, detail: item.message, confidence: item.confidence, freshness: item.freshness }} />
                          ))}
                        </div>
                      )}
                    </DossierSection>

                    <DossierSection title="Intent Signals" subtitle="What kind of buyer journey the site is pushing">
                      <div className="grid grid-cols-2 gap-2">
                        <SignalCard
                          title="Primary Intent"
                          value={savedResult.intentSignals?.summary?.primaryIntent || 'Unavailable'}
                          subtitle={savedResult.intentSignals?.summary?.funnelStage ? `${savedResult.intentSignals.summary.funnelStage}-funnel` : 'No funnel stage inferred'}
                          tone="purple"
                        />
                        <SignalCard
                          title="Secondary Intent"
                          value={savedResult.intentSignals?.summary?.secondaryIntent || 'Unavailable'}
                          subtitle={savedResult.intentSignals?.summary?.confidence ? `${savedResult.intentSignals.summary.confidence} confidence` : 'Confidence unavailable'}
                          tone="green"
                        />
                      </div>
                      {(savedResult.intentSignals?.evidence || []).length > 0 && (
                        <div className="space-y-2">
                          {savedResult.intentSignals.evidence.map((item, idx) => (
                            <div key={idx} className="rounded-xl border border-border px-3 py-2 text-xs text-text-secondary">{item}</div>
                          ))}
                        </div>
                      )}
                    </DossierSection>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    {savedResult.topKeywords.length > 0 && (
                      <DossierSection title="Keyword Footprint" subtitle="Observed search and on-site demand signals">
                        <div className="space-y-2">
                          {savedResult.topKeywords.map((kw) => (
                            <div key={kw.keyword} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-xs">
                              <span className="text-text-primary font-medium">{kw.keyword}</span>
                              <div className="flex items-center gap-3 text-text-secondary">
                                <span>{kw.position ? `Rank #${kw.position}` : 'Rank unavailable'}</span>
                                <span>{kw.volume ? `${kw.volume.toLocaleString()}/mo` : 'Volume unavailable'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </DossierSection>
                    )}

                    <DossierSection title="Site Surfaces" subtitle="Which paths are visible from the crawl">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {[
                          ['Pricing', savedResult.siteSurfaces?.pricing || 0],
                          ['Blog', savedResult.siteSurfaces?.blog || 0],
                          ['Docs', savedResult.siteSurfaces?.docs || 0],
                          ['Features', savedResult.siteSurfaces?.features || 0],
                          ['Case Studies', savedResult.siteSurfaces?.caseStudies || 0],
                          ['Integrations', savedResult.siteSurfaces?.integrations || 0],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-xl border border-border px-3 py-2">
                            <p className="text-text-secondary">{label}</p>
                            <p className="text-sm text-text-primary font-semibold mt-1">{value}</p>
                          </div>
                        ))}
                      </div>
                      {savedResult.structuredDataTypes?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {savedResult.structuredDataTypes.map((item) => (
                            <span key={item} className="text-[11px] px-2 py-1 rounded-full border border-border text-text-secondary">
                              {item}
                            </span>
                          ))}
                        </div>
                      )}
                    </DossierSection>
                  </div>

                  {(savedResult.techSignals?.technologies?.length > 0 || savedResult.techStack?.length > 0) && (
                    <DossierSection title="Tech Stack Signals" subtitle="Detected tooling, categories, and instrumentation">
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <p className="text-[11px] uppercase tracking-wider text-text-secondary">Detected Technologies</p>
                          <div className="flex flex-wrap gap-1.5">
                            {(savedResult.techSignals?.technologies || savedResult.techStack.map((name) => ({ name, category: 'detected', confidence: 'low' }))).slice(0, 16).map((item) => (
                              <span key={item.name} className="text-[11px] px-2 py-1 rounded-full border border-border text-text-secondary">
                                {item.name}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[11px] uppercase tracking-wider text-text-secondary">Stack Categories</p>
                          <div className="grid grid-cols-2 gap-2">
                            {(savedResult.techSignals?.summary?.categories || []).slice(0, 6).map((item) => (
                              <div key={item.category} className="rounded-xl border border-border px-3 py-2">
                                <p className="text-xs text-text-secondary">{item.category}</p>
                                <p className="text-sm text-text-primary font-semibold mt-1">{item.count}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </DossierSection>
                  )}

                  <div className="grid sm:grid-cols-2 gap-4">
                    {savedResult.weaknesses.length > 0 && (
                      <DossierSection title="Weaknesses To Exploit" subtitle="Evidence-backed gaps worth attacking">
                        <div className="space-y-1.5">
                          {savedResult.weaknesses.map((w, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                              <Target className="w-3.5 h-3.5 text-accent-green mt-0.5 shrink-0" />{w}
                            </div>
                          ))}
                        </div>
                      </DossierSection>
                    )}

                    {savedResult.evidenceLog?.length > 0 && (
                      <DossierSection title="Evidence Highlights" subtitle="What the engine actually observed">
                        <div className="space-y-2">
                          {savedResult.evidenceLog.map((item, idx) => (
                            <div key={`${item.type}-${idx}`} className="rounded-xl border border-border px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wider text-text-secondary">{String(item.type || 'evidence').replace(/_/g, ' ')}</p>
                              <p className="text-xs text-text-primary mt-1 leading-relaxed">{item.detail}</p>
                            </div>
                          ))}
                        </div>
                      </DossierSection>
                    )}
                  </div>

                  {(savedResult.ragContext?.trackedKeywordOverlap?.length > 0 || savedResult.ragContext?.priorResearch?.length > 0) && (
                    <DossierSection title="RAG Context" subtitle="How this research connects to your team memory">
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <p className="text-[11px] uppercase tracking-wider text-text-secondary">Keyword Overlap</p>
                          {(savedResult.ragContext?.trackedKeywordOverlap || []).slice(0, 4).map((item) => (
                            <div key={item.keyword} className="rounded-xl border border-border px-3 py-2 text-xs">
                              <p className="text-text-primary font-medium">{item.keyword}</p>
                              <p className="text-text-secondary mt-1">Your rank: {item.currentRank ?? 'n/a'} • Volume: {item.searchVolume ?? 'n/a'}</p>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-2">
                          <p className="text-[11px] uppercase tracking-wider text-text-secondary">Prior Research</p>
                          {(savedResult.ragContext?.priorResearch || []).slice(0, 4).map((item, idx) => (
                            <div key={`${item.query}-${idx}`} className="rounded-xl border border-border px-3 py-2 text-xs">
                              <p className="text-text-primary font-medium">{item.query}</p>
                              <p className="text-text-secondary mt-1">{item.summary || item.kind}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </DossierSection>
                  )}

                  {savedResult.dataGaps?.length > 0 && (
                    <DossierSection title="Data Gaps" subtitle="Signals that still need a stronger source">
                      <div className="space-y-2">
                        {savedResult.dataGaps.map((gap, idx) => (
                          <div key={idx} className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-text-secondary">
                            {gap}
                          </div>
                        ))}
                      </div>
                    </DossierSection>
                  )}
                </div>
              </SavedReportCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Ad Intelligence section (Competitor Hijack Engine preview) ───────────────
const ANALYZE_STEPS = ['Scanning ad library…', 'Finding keyword gaps…', 'Analyzing angles…', 'Generating opportunities…'];

function AdIntelSection() {
  const toast        = useToast();
  const queryClient  = useQueryClient();
  const [url, setUrl]         = useState('');
  const [result, setResult]   = useState(null);
  const [expandedReportId, setExpandedReportId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep]       = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const { data: latestAdIntelReport } = useQuery({
    queryKey: ['research', 'latest', 'ad-intelligence'],
    queryFn: () => api.get('/research/reports/latest?kind=ad-intelligence').then((r) => r.data.data.report),
    staleTime: 5 * 60 * 1000,
  });

  const { data: adIntelReports = [] } = useQuery({
    queryKey: ['research', 'reports', 'ad-intelligence'],
    queryFn: () => api.get('/research/reports?kind=ad-intelligence&limit=8').then((r) => r.data.data.reports || []),
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (!latestAdIntelReport?.analysis) return;
    setResult(normalizeAdIntelResult({
      ...latestAdIntelReport.analysis,
      savedAt: latestAdIntelReport.createdAt,
    }));
    setExpandedReportId((current) => current ?? latestAdIntelReport.id);
  }, [latestAdIntelReport]);

  const research = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setErrorMsg('');
    setResult(null);
    setStep(0);

    const interval = setInterval(() => setStep((s) => s + 1), 900);

    try {
      const res = await api.get(`/research/hijack-analysis?domain=${encodeURIComponent(url.trim())}`);
      clearInterval(interval);
      setResult(normalizeAdIntelResult(res.data.data));
      setUrl('');
      setExpandedReportId(res.data.data.reportId || null);
      queryClient.invalidateQueries({ queryKey: ['research', 'latest', 'ad-intelligence'] });
      queryClient.invalidateQueries({ queryKey: ['research', 'reports', 'ad-intelligence'] });
    } catch (err) {
      clearInterval(interval);
      const message = err?.response?.data?.error?.message || 'Analysis failed';
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const addKeyword = useMutation({
    mutationFn: (keyword) => api.post('/seo/keywords', { keyword }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['seo', 'keywords'] }); toast.success('Keyword added'); },
    onError: (err) => toast.error(err?.response?.data?.error?.message || 'Failed'),
  });

  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Competitor Hijack Analysis</h3>
          <p className="text-xs text-text-secondary mt-0.5">Enter a competitor domain to reveal their ad strategy, keyword gaps, and win-back opportunities</p>
        </div>
        <div className="flex gap-2">
          <input
            className="input-field flex-1"
            placeholder="competitor.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && research()}
            disabled={loading}
          />
          <button
            onClick={research}
            disabled={!url.trim() || loading}
            className="btn-primary whitespace-nowrap flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Analyzing…' : 'Analyze Competitor'}
          </button>
        </div>

        {loading && (
          <div className="pt-2 space-y-2">
            <p className="text-xs text-text-secondary">{ANALYZE_STEPS[step % ANALYZE_STEPS.length]}</p>
            <div className="flex gap-1.5">
              {ANALYZE_STEPS.map((_, i) => (
                <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-accent-blue' : 'bg-border'}`} />
              ))}
            </div>
          </div>
        )}

        {errorMsg && !loading && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-300">Competitor analysis failed</p>
                <p className="text-xs text-text-secondary mt-1">{errorMsg}</p>
              </div>
            </div>
            <button onClick={research} className="btn-secondary text-sm whitespace-nowrap">Try Again</button>
          </div>
        )}
      </div>

      {(adIntelReports.length > 0 || result) && !loading && (
        <div className="space-y-4">
          {adIntelReports.map((report) => {
            const savedResult = normalizeAdIntelResult({ ...(report.analysis || {}), savedAt: report.createdAt });
            const expanded = expandedReportId === report.id;
            return (
              <SavedReportCard
                key={report.id}
                title={savedResult.domain || report.query}
                subtitle={`${report.query} • ${new Date(report.createdAt).toLocaleString()}`}
                isExpanded={expanded}
                onToggle={() => setExpandedReportId(expanded ? null : report.id)}
              >
                <div className="space-y-4">
                  <div className="text-xs text-text-secondary">
                    Saved {new Date(savedResult.savedAt).toLocaleString()}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="card text-center py-3">
                      <p className="text-lg font-bold text-text-primary">{savedResult.estimatedAdSpend || 'Unavailable'}</p>
                      <p className="text-xs text-text-secondary">{savedResult.estimatedAdSpend ? 'Est. Ad Spend' : 'Ad Spend Data'}</p>
                    </div>
                    <div className="card text-center py-3">
                      <p className="text-lg font-bold text-text-primary">{savedResult.topKeywords?.length ?? 0}</p>
                      <p className="text-xs text-text-secondary">Keywords Found</p>
                    </div>
                    <div className="card text-center py-3">
                      <p className="text-lg font-bold text-text-primary">{(savedResult.attackVectors?.length ?? 0) + (savedResult.winbackOpportunities?.length ?? 0)}</p>
                      <p className="text-xs text-text-secondary">Actionable Moves</p>
                    </div>
                  </div>

                  {savedResult.sourceMatrix?.length > 0 && (
                    <DossierSection title="Research Sources" subtitle="Which engines and evidence feeds powered this attack plan">
                      <div className="grid sm:grid-cols-2 gap-2">
                        {savedResult.sourceMatrix.map((item, idx) => (
                          <SourcePill key={`${item.source}-${idx}`} item={item} />
                        ))}
                      </div>
                    </DossierSection>
                  )}

                  {savedResult.companySnapshot?.primaryOffer && (
                    <DossierSection title="Positioning Snapshot" subtitle="Live offer and buyer framing observed on-site">
                      <div className="space-y-2">
                        <p className="text-sm text-text-primary font-medium">{savedResult.companySnapshot.primaryOffer}</p>
                        {savedResult.companySnapshot.positioning && (
                          <p className="text-xs text-text-secondary leading-relaxed">{savedResult.companySnapshot.positioning}</p>
                        )}
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div className="rounded-xl border border-border px-3 py-2">
                            <p className="text-[11px] uppercase tracking-wider text-text-secondary">Target Audience</p>
                            <p className="text-sm text-text-primary mt-1">{savedResult.companySnapshot.targetAudience || 'Unknown'}</p>
                          </div>
                          <div className="rounded-xl border border-border px-3 py-2">
                            <p className="text-[11px] uppercase tracking-wider text-text-secondary">Primary CTA</p>
                            <p className="text-sm text-text-primary mt-1">{savedResult.companySnapshot.primaryCallToAction || 'Unavailable'}</p>
                          </div>
                        </div>
                      </div>
                    </DossierSection>
                  )}

                  <div className="grid sm:grid-cols-2 gap-4">
                    <DossierSection title="Reach Signals" subtitle="How much external demand footprint we could confirm">
                      <div className="grid grid-cols-2 gap-2">
                        <SignalCard
                          title="Best Known Rank"
                          value={savedResult.trafficSignals?.summary?.bestKnownGlobalRank ? `#${savedResult.trafficSignals.summary.bestKnownGlobalRank}` : 'Unavailable'}
                          subtitle={savedResult.trafficSignals?.summary?.available ? `${savedResult.trafficSignals.summary.confidence} confidence` : 'No premium rank feed configured'}
                          tone="blue"
                        />
                        <SignalCard
                          title="Traffic Confidence"
                          value={savedResult.trafficSignals?.summary?.confidence || 'low'}
                          subtitle={savedResult.trafficSignals?.providers?.filter((item) => item.status === 'ok').length ? 'External provider-backed' : 'Only on-site evidence available'}
                          tone="amber"
                        />
                      </div>
                    </DossierSection>

                    <DossierSection title="Buyer Intent" subtitle="What intent the competitor is pushing hardest">
                      <div className="grid grid-cols-2 gap-2">
                        <SignalCard
                          title="Primary Intent"
                          value={savedResult.intentSignals?.summary?.primaryIntent || 'Unavailable'}
                          subtitle={savedResult.intentSignals?.summary?.funnelStage ? `${savedResult.intentSignals.summary.funnelStage}-funnel` : 'No funnel stage inferred'}
                          tone="purple"
                        />
                        <SignalCard
                          title="Secondary Intent"
                          value={savedResult.intentSignals?.summary?.secondaryIntent || 'Unavailable'}
                          subtitle={savedResult.intentSignals?.summary?.confidence ? `${savedResult.intentSignals.summary.confidence} confidence` : 'Confidence unavailable'}
                          tone="green"
                        />
                      </div>
                    </DossierSection>
                  </div>

                  {savedResult.researchBasis?.length > 0 && (
                    <DossierSection title="Research Basis" subtitle="Core observations behind the attack analysis">
                      <div className="space-y-2">
                        {savedResult.researchBasis.map((item, i) => (
                          <div key={i} className="card text-xs text-text-secondary">{item}</div>
                        ))}
                      </div>
                    </DossierSection>
                  )}

                  {savedResult.attackVectors?.length > 0 && (
                    <DossierSection title="Attack Vectors" subtitle="Fastest evidence-backed moves to intercept demand">
                      <div className="space-y-2">
                        {savedResult.attackVectors.map((vector, i) => (
                          <div key={i} className="card space-y-1.5">
                            <p className="text-sm font-semibold text-text-primary">{vector.title}</p>
                            <p className="text-xs text-text-secondary">{vector.evidence}</p>
                            <p className="text-xs text-accent-blue">{vector.move}</p>
                          </div>
                        ))}
                      </div>
                    </DossierSection>
                  )}

                  <DossierSection title="Win-back Opportunities" subtitle="Only shown when the evidence supports a real intercept move">
                    {(savedResult.winbackOpportunities ?? []).length > 0 ? (
                      <div className="space-y-2">
                        {(savedResult.winbackOpportunities ?? []).map((opp, i) => (
                          <div key={i} className="card space-y-1.5">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-accent-purple/10 text-accent-purple border border-accent-purple/20 font-medium inline-block">{opp.angle}</span>
                            <p className="text-sm font-semibold text-text-primary">{opp.suggestedHeadline}</p>
                            <p className="text-xs text-text-secondary leading-relaxed">{opp.reason}</p>
                            {opp.action && <p className="text-xs text-accent-blue">Move: {opp.action}</p>}
                            {opp.targetKeyword && <p className="text-[11px] text-text-secondary">Target keyword: {opp.targetKeyword}</p>}
                            {opp.source && <p className="text-[11px] text-text-secondary">Source: {opp.source === 'anthropic' ? 'Anthropic + live evidence' : opp.source}</p>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="card text-xs text-text-secondary leading-relaxed">
                        {savedResult.winbackUnavailableReason || 'No evidence-backed win-back opportunity is available yet. This section stays empty until the analysis has real recovery evidence.'}
                      </div>
                    )}
                  </DossierSection>

                  {savedResult.topKeywords?.length > 0 && (
                    <DossierSection title="Keyword Footprint" subtitle="Observed demand surface and rank signals">
                      <div className="space-y-2">
                        {savedResult.topKeywords.map((kw, i) => (
                          <div key={`${kw.keyword}-${i}`} className="card flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-text-primary">{kw.keyword}</p>
                              <p className="text-[11px] text-text-secondary mt-1">
                                {kw.position ? `Observed rank #${kw.position}${kw.rankSource ? ` via ${kw.rankSource}` : ''}` : 'Observed on-site keyword only'}
                              </p>
                            </div>
                            <div className="text-right text-xs text-text-secondary">
                              {kw.volume ? `${kw.volume.toLocaleString()}/mo` : 'Volume unavailable'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </DossierSection>
                  )}

                  {(savedResult.techSignals?.technologies?.length > 0 || savedResult.techStack?.length > 0) && (
                    <DossierSection title="Tech Stack Signals" subtitle="Detected stack and instrumentation behind the funnel">
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="flex flex-wrap gap-1.5">
                          {(savedResult.techSignals?.technologies || savedResult.techStack.map((name) => ({ name }))).slice(0, 16).map((item) => (
                            <span key={item.name} className="text-[11px] px-2 py-1 rounded-full border border-border text-text-secondary">
                              {item.name}
                            </span>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {(savedResult.techSignals?.summary?.categories || []).slice(0, 6).map((item) => (
                            <div key={item.category} className="rounded-xl border border-border px-3 py-2">
                              <p className="text-xs text-text-secondary">{item.category}</p>
                              <p className="text-sm text-text-primary font-semibold mt-1">{item.count}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </DossierSection>
                  )}

                  {(savedResult.evidenceLog?.length > 0 || savedResult.dataGaps?.length > 0) && (
                    <div className="grid sm:grid-cols-2 gap-4">
                      {savedResult.evidenceLog?.length > 0 && (
                        <DossierSection title="Evidence Highlights" subtitle="Observed signals the strategy is built on">
                          <div className="space-y-2">
                            {savedResult.evidenceLog.map((item, idx) => (
                              <div key={`${item.type}-${idx}`} className="rounded-xl border border-border px-3 py-2">
                                <p className="text-[11px] uppercase tracking-wider text-text-secondary">{String(item.type || 'evidence').replace(/_/g, ' ')}</p>
                                <p className="text-xs text-text-primary mt-1 leading-relaxed">{item.detail}</p>
                              </div>
                            ))}
                          </div>
                        </DossierSection>
                      )}

                      {savedResult.dataGaps?.length > 0 && (
                        <DossierSection title="Data Gaps" subtitle="Missing signals that still limit confidence">
                          <div className="space-y-2">
                            {savedResult.dataGaps.map((gap, idx) => (
                              <div key={idx} className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-text-secondary">
                                {gap}
                              </div>
                            ))}
                          </div>
                        </DossierSection>
                      )}
                    </div>
                  )}

                  {(savedResult.ragContext?.trackedKeywordOverlap?.length > 0 || savedResult.ragContext?.topOwnedKeywords?.length > 0) && (
                    <DossierSection title="RAG Context" subtitle="Where this competitor intersects with your owned demand and prior work">
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <p className="text-[11px] uppercase tracking-wider text-text-secondary">Tracked Overlap</p>
                          {(savedResult.ragContext?.trackedKeywordOverlap || []).slice(0, 4).map((item) => (
                            <div key={item.keyword} className="rounded-xl border border-border px-3 py-2 text-xs">
                              <p className="text-text-primary font-medium">{item.keyword}</p>
                              <p className="text-text-secondary mt-1">Your rank: {item.currentRank ?? 'n/a'} • Previous: {item.previousRank ?? 'n/a'}</p>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-2">
                          <p className="text-[11px] uppercase tracking-wider text-text-secondary">Top Owned Keywords</p>
                          {(savedResult.ragContext?.topOwnedKeywords || []).slice(0, 4).map((item) => (
                            <div key={item.keyword} className="rounded-xl border border-border px-3 py-2 text-xs">
                              <p className="text-text-primary font-medium">{item.keyword}</p>
                              <p className="text-text-secondary mt-1">Your rank: {item.currentRank ?? 'n/a'} • Volume: {item.searchVolume ?? 'n/a'}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </DossierSection>
                  )}
                </div>
              </SavedReportCard>
            );
          })}

        </div>
      )}
    </div>
  );
}

// ─── Keyword Research section ─────────────────────────────────────────────────
function Sparkline({ data, width = 180, height = 44 }) {
  if (!data || data.length < 2) return <div style={{ width, height, background: 'rgba(255,255,255,0.04)', borderRadius: 6 }} />;
  const max = Math.max(...data.map(d => d.score || 0), 1);
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d.score || 0) / max) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const polyPts = `${pts.join(' ')} ${width},${height} 0,${height}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={polyPts} fill="url(#sg)" />
      <polyline points={pts.join(' ')} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function KeywordResearchSection() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: kwResult, isFetching, error } = useQuery({
    queryKey: ['kw', 'research', searchTerm],
    queryFn: () => api.get(`/keywords/research?q=${encodeURIComponent(searchTerm)}`).then(r => r.data.data),
    enabled: !!searchTerm,
    staleTime: 2 * 60 * 60 * 1000, // 2h
  });

  const { data: tracked } = useQuery({
    queryKey: ['seo', 'keywords'],
    queryFn: () => api.get('/seo/keywords').then(r => r.data.data?.keywords ?? r.data.data?.items ?? (Array.isArray(r.data.data) ? r.data.data : [])),
  });

  const addKw = useMutation({
    mutationFn: (kw) => api.post('/seo/keywords', { keyword: kw }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['seo', 'keywords'] }); toast.success('Keyword tracked'); },
  });

  const search = () => { if (query.trim().length >= 2) setSearchTerm(query.trim()); };

  const trendColor = kwResult?.trend === 'rising' ? '#10b981' : kwResult?.trend === 'falling' ? '#ef4444' : '#f59e0b';
  const trendLabel = kwResult?.trend === 'rising' ? 'Rising' : kwResult?.trend === 'falling' ? 'Falling' : 'Stable';

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="card">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-text-primary">Trend Intelligence Center</h3>
          <p className="text-xs text-text-secondary mt-0.5">Discover search trends, related opportunities, and AI insights for any keyword</p>
        </div>
        <div className="flex gap-2">
          <input
            className="input-field flex-1"
            placeholder="Search any keyword or topic…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
          />
          <button onClick={search} disabled={query.trim().length < 2 || isFetching} className="btn-primary whitespace-nowrap flex items-center gap-2">
            <Search className="w-4 h-4" />
            {isFetching ? 'Searching…' : 'Analyze'}
          </button>
        </div>
      </div>

      {/* Results */}
      {isFetching && (
        <div className="card py-12 text-center">
          <Loader2 className="w-6 h-6 mx-auto text-accent-purple animate-spin mb-2" />
          <p className="text-xs text-text-secondary">Pulling trend data…</p>
        </div>
      )}

      {kwResult && !isFetching && (
        <div className="space-y-4">
          {/* Trend score banner */}
          <div className="card" style={{ borderColor: `${trendColor}30` }}>
            <div className="flex items-start justify-between gap-4">
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>"{kwResult.keyword}"</span>
                  <span style={{ background: `${trendColor}20`, color: trendColor, fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20 }}>
                    {trendLabel}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Trend Score</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: trendColor }}>{kwResult.trendScore || kwResult.trendAvg || 0}/100</div>
                  </div>
                  {kwResult.difficulty && (
                    <div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Difficulty</div>
                      <div style={{ fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>{kwResult.difficulty}{kwResult.difficultyLabel ? ` · ${kwResult.difficultyLabel}` : ''}</div>
                    </div>
                  )}
                  {kwResult.opportunityScore ? (
                    <div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Opportunity</div>
                      <div style={{ fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>{kwResult.opportunityScore}/100</div>
                    </div>
                  ) : null}
                  {kwResult.bestPlatform && (
                    <div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Best Platform</div>
                      <div style={{ fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>{kwResult.bestPlatform}</div>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <Sparkline data={kwResult.trendHistory || []} width={160} height={48} />
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 4 }}>90-day trend</div>
              </div>
            </div>
            <button
              onClick={() => addKw.mutate(kwResult.keyword)}
              disabled={addKw.isPending}
              style={{
                marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(139,92,246,0.15)', color: '#8b5cf6',
                border: '1px solid rgba(139,92,246,0.25)', borderRadius: 8,
                fontSize: 12, fontWeight: 600, padding: '6px 14px', cursor: 'pointer',
              }}
            >
              <Plus className="w-3.5 h-3.5" /> Track This Keyword
            </button>
          </div>

          {/* Related opportunities + AI Insight */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Related keywords */}
            {(kwResult.suggestions?.length > 0 || kwResult.relatedKeywords?.length > 0) && (
              <div className="card">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Related Opportunities</p>
                <div className="space-y-2">
                  {[
                    ...(kwResult.relatedKeywords || []).map(r => ({ keyword: r.keyword, trend: r.trend, rising: r.trend === 'rising' })),
                    ...(kwResult.suggestions || []).slice(0, 8).map(s => ({ keyword: s, trend: 'stable', rising: false })),
                  ].slice(0, 10).map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: item.rising ? '#10b981' : 'rgba(255,255,255,0.4)' }}>
                        {item.rising ? '↑' : '→'}
                      </span>
                      <span style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{item.keyword}</span>
                      <button
                        onClick={() => addKw.mutate(item.keyword)}
                        style={{ fontSize: 10, color: '#8b5cf6', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        +Track
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Insight */}
            {kwResult.aiInsight && (
              <div className="card" style={{ borderColor: 'rgba(139,92,246,0.2)', background: 'rgba(139,92,246,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <Sparkles className="w-4 h-4 text-accent-purple" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI INSIGHT</span>
                </div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>{kwResult.aiInsight}</p>
                <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                  Source: {kwResult.source || 'Google Trends + Autocomplete'}
                </div>
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {kwResult.intent && (
              <div className="card">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Intent</p>
                <p className="text-sm text-text-primary capitalize">{kwResult.intent}</p>
                {kwResult.intentExplanation && <p className="text-xs text-text-secondary mt-1 leading-relaxed">{kwResult.intentExplanation}</p>}
              </div>
            )}

            {kwResult.serpFeatures?.length > 0 && (
              <div className="card">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">SERP Features</p>
                <div className="flex flex-wrap gap-1.5">
                  {kwResult.serpFeatures.map((feature) => (
                    <span key={feature} className="text-xs px-2.5 py-1 rounded-full border border-border text-text-secondary">
                      {feature.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {kwResult.contentAngle && (
            <div className="card">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Content Angle</p>
              <p className="text-sm text-text-secondary leading-relaxed">{kwResult.contentAngle}</p>
            </div>
          )}
        </div>
      )}

      {/* Tracked keywords */}
      {(tracked?.length ?? 0) > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Your Tracked Keywords</p>
          </div>
          <div className="divide-y divide-border">
            {(tracked ?? []).slice(0, 10).map((kw) => {
              const rankChange = kw.previousRank && kw.currentRank ? kw.previousRank - kw.currentRank : 0;
              const trend = rankChange > 2 ? 'rising' : rankChange < -2 ? 'falling' : 'stable';
              return (
                <div key={kw.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/2">
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: trend === 'rising' ? '#10b981' : trend === 'falling' ? '#ef4444' : '#f59e0b', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{kw.keyword}</span>
                  {kw.currentRank && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Rank #{kw.currentRank}</span>}
                  <span style={{ fontSize: 11, color: trend === 'rising' ? '#10b981' : trend === 'falling' ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>
                    {trend}
                  </span>
                  <button
                    onClick={() => { setQuery(kw.keyword); setSearchTerm(kw.keyword); }}
                    style={{ fontSize: 11, color: '#8b5cf6', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Research
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const TABS = ['Competitors', 'Keyword Research', 'Market Research', 'Ad Intelligence'];

export default function ResearchPage() {
  const [activeTab, setActiveTab] = useState('Competitors');
  const feature = FEATURES.pulse;

  return (
    <div className="space-y-5">
      <FeatureHeader
        codename={feature.codename}
        label={feature.label}
        description={feature.description}
        color={feature.color}
        icon={Search}
        badge={feature.badge}
        stats={feature.stats}
      />

      <div className="border-b border-border">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === t ? 'border-accent-blue text-accent-blue' : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'Competitors'        && <CompetitorSection />}
      {activeTab === 'Keyword Research'  && <KeywordResearchSection />}
      {activeTab === 'Market Research'   && <MarketResearchSection />}
      {activeTab === 'Ad Intelligence'   && <AdIntelSection />}
    </div>
  );
}
