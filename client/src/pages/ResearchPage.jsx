import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Globe, Search, Plus, Trash2, TrendingUp, Target, Copy, ChevronRight,
  AlertCircle, Zap, Loader2, Sparkles, DollarSign, Key, FlaskConical, Download, ChevronDown,
} from 'lucide-react';
import { exportToCSV } from '../lib/exportCsv';
import api from '../lib/api';
import { useToast } from '../components/ui/Toast';
import Badge from '../components/ui/Badge';
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
      {/* Beta banner */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
          <FlaskConical className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-amber-400">Beta Feature</p>
          <p className="text-xs text-white/40 mt-0.5">
            Competitor intelligence is in early access. Data shown is illustrative. Full Meta Ad Library integration coming soon.
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
              onClick={() => exportToCSV(
                (competitors ?? []).map(c => ({
                  domain: c.domain, name: c.name ?? c.domain,
                  added: new Date(c.createdAt).toLocaleDateString(),
                })),
                ['domain', 'name', 'added'],
                'competitors'
              )}
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
    topKeywords: (data.topKeywords || []).slice(0, 8).map((k) => (typeof k === 'string' ? k : k.word || k.keyword || '')).filter(Boolean),
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
    savedAt: data.savedAt || null,
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

                  <div className="card">
                    <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">{savedResult.domain}</p>
                    <p className="text-sm text-text-primary font-medium">{savedResult.title}</p>
                    {savedResult.description && <p className="text-xs text-text-secondary mt-1 line-clamp-2">{savedResult.description}</p>}
                    {savedResult.threatLevel && <p className="text-xs text-accent-blue mt-2">Threat level: {savedResult.threatLevel}</p>}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    {savedResult.topKeywords.length > 0 && (
                      <div className="card">
                        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Keywords They Target</p>
                        <div className="flex flex-wrap gap-1.5">
                          {savedResult.topKeywords.map((kw) => (
                            <span key={kw} className="text-xs px-2.5 py-1 rounded-full border border-border text-text-secondary">{kw}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {savedResult.weaknesses.length > 0 && (
                      <div className="card">
                        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Weaknesses to Exploit</p>
                        <div className="space-y-1.5">
                          {savedResult.weaknesses.map((w, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                              <Target className="w-3.5 h-3.5 text-accent-green mt-0.5 shrink-0" />{w}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
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
    setResult({
      ...latestAdIntelReport.analysis,
      savedAt: latestAdIntelReport.createdAt,
    });
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
      setResult(res.data.data);
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
            const savedResult = { ...(report.analysis || {}), savedAt: report.createdAt };
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
                      <p className="text-lg font-bold text-text-primary">{savedResult.estimatedAdSpend}</p>
                      <p className="text-xs text-text-secondary">Est. Ad Spend</p>
                    </div>
                    <div className="card text-center py-3">
                      <p className="text-lg font-bold text-text-primary">{savedResult.topKeywords?.length ?? 0}</p>
                      <p className="text-xs text-text-secondary">Keywords Found</p>
                    </div>
                    <div className="card text-center py-3">
                      <p className="text-lg font-bold text-text-primary">{savedResult.winbackOpportunities?.length ?? 0}</p>
                      <p className="text-xs text-text-secondary">Opportunities</p>
                    </div>
                  </div>

                  {savedResult.researchBasis?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Research Basis</h4>
                      <div className="space-y-2">
                        {savedResult.researchBasis.map((item, i) => (
                          <div key={i} className="card text-xs text-text-secondary">{item}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {savedResult.attackVectors?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Attack Vectors</h4>
                      <div className="space-y-2">
                        {savedResult.attackVectors.map((vector, i) => (
                          <div key={i} className="card space-y-1.5">
                            <p className="text-sm font-semibold text-text-primary">{vector.title}</p>
                            <p className="text-xs text-text-secondary">{vector.evidence}</p>
                            <p className="text-xs text-accent-blue">{vector.move}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Win-back Opportunities</h4>
                    <div className="space-y-2">
                      {(savedResult.winbackOpportunities ?? []).map((opp, i) => (
                        <div key={i} className="card space-y-1.5">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-accent-purple/10 text-accent-purple border border-accent-purple/20 font-medium inline-block">{opp.angle}</span>
                          <p className="text-sm font-semibold text-text-primary">{opp.suggestedHeadline}</p>
                          <p className="text-xs text-text-secondary leading-relaxed">{opp.reason}</p>
                          {opp.action && <p className="text-xs text-accent-blue">Move: {opp.action}</p>}
                          {opp.targetKeyword && <p className="text-[11px] text-text-secondary">Target keyword: {opp.targetKeyword}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
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
