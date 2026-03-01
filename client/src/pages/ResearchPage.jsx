import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Globe, Search, Plus, Trash2, TrendingUp, Target, Copy, ChevronRight,
  AlertCircle, Zap, Loader2, Sparkles, DollarSign, Key,
} from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../components/ui/Toast';
import Badge from '../components/ui/Badge';

// ─── Competitor section ───────────────────────────────────────────────────────
function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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
          <div className="px-5 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-text-primary">Tracked Competitors</h3>
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
const MOCK_RESEARCH = {
  traffic: '42,000–68,000 / mo',
  topKeywords: ['seo audit tool', 'website seo checker', 'free seo analysis', 'technical seo tool', 'on-page seo'],
  competitors: ['semrush.com', 'ahrefs.com', 'moz.com', 'sitechecker.pro'],
  opportunities: ['Long-tail informational content', 'Comparison pages vs competitors', 'Video tutorials / how-to guides'],
};

function MarketResearchSection() {
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    if (!url.trim()) return;
    setLoading(true);
    // Simulate API call with mock data
    await new Promise((r) => setTimeout(r, 1500));
    setResult(MOCK_RESEARCH);
    setLoading(false);
    toast.success('Market analysis complete');
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
            <Zap className="w-4 h-4" />
            {loading ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
      </div>

      {result && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="card">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Est. Monthly Traffic</p>
            <p className="text-2xl font-bold text-text-primary">{result.traffic}</p>
          </div>
          <div className="card">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Top Competitors</p>
            <div className="space-y-1.5">
              {result.competitors.map((c) => (
                <div key={c} className="flex items-center gap-2 text-sm text-text-secondary">
                  <ChevronRight className="w-3 h-3 text-accent-blue" />{c}
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Top Keywords</p>
            <div className="flex flex-wrap gap-1.5">
              {result.topKeywords.map((kw) => (
                <span key={kw} className="text-xs px-2.5 py-1 rounded-full border border-border text-text-secondary">{kw}</span>
              ))}
            </div>
          </div>
          <div className="card">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Opportunities</p>
            <div className="space-y-1.5">
              {result.opportunities.map((o) => (
                <div key={o} className="flex items-start gap-2 text-sm text-text-secondary">
                  <Target className="w-3.5 h-3.5 text-accent-green mt-0.5 shrink-0" />{o}
                </div>
              ))}
            </div>
          </div>
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
  const [loading, setLoading] = useState(false);
  const [step, setStep]       = useState(0);

  const research = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    setStep(0);

    const interval = setInterval(() => setStep((s) => s + 1), 900);

    try {
      const res = await api.get(`/research/hijack-analysis?domain=${encodeURIComponent(url.trim())}`);
      clearInterval(interval);
      setResult(res.data.data);
    } catch (err) {
      clearInterval(interval);
      toast.error(err?.response?.data?.error?.message || 'Analysis failed');
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
      </div>

      {result && !loading && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card text-center py-3">
              <p className="text-lg font-bold text-text-primary">{result.estimatedAdSpend}</p>
              <p className="text-xs text-text-secondary">Est. Ad Spend</p>
            </div>
            <div className="card text-center py-3">
              <p className="text-lg font-bold text-text-primary">{result.topKeywords?.length ?? 0}</p>
              <p className="text-xs text-text-secondary">Keywords Found</p>
            </div>
            <div className="card text-center py-3">
              <p className="text-lg font-bold text-text-primary">{result.winbackOpportunities?.length ?? 0}</p>
              <p className="text-xs text-text-secondary">Opportunities</p>
            </div>
          </div>

          {/* Ad examples */}
          <div>
            <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Competitor Ads Running Now</h4>
            <div className="space-y-2">
              {(result.adExamples ?? []).map((ad, i) => (
                <div key={i} className="card group">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge status={ad.platform.toLowerCase()} />
                      </div>
                      <p className="text-sm font-semibold text-accent-blue">{ad.headline}</p>
                      <p className="text-xs text-text-secondary mt-1 leading-relaxed">{ad.description}</p>
                      <p className="text-xs text-accent-green mt-1">CTA: {ad.cta}</p>
                    </div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(`${ad.headline}\n${ad.description}`); toast.success('Copied'); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs text-text-secondary hover:text-accent-blue shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />Copy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Keyword gaps */}
          <div>
            <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Keyword Gaps</h4>
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-bg-secondary/30">
                      {['Keyword', 'Their Rank', 'Your Rank', 'Volume', ''].map((h) => (
                        <th key={h} className="text-left text-xs text-text-secondary font-medium px-4 py-2.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(result.keywordGaps ?? []).map((g, i) => (
                      <tr key={i} className="hover:bg-bg-secondary/20">
                        <td className="px-4 py-2.5 text-text-primary text-xs font-medium">{g.keyword}</td>
                        <td className="px-4 py-2.5 text-accent-green text-xs font-semibold">#{g.theirRank}</td>
                        <td className="px-4 py-2.5 text-xs">
                          {g.yourRank ? <span className="text-yellow-400">#{g.yourRank}</span> : <span className="text-text-secondary italic">Not ranking</span>}
                        </td>
                        <td className="px-4 py-2.5 text-text-secondary text-xs">{g.volume?.toLocaleString()}/mo</td>
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => addKeyword.mutate(g.keyword)}
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

          {/* Win-back opportunities */}
          <div>
            <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Win-back Opportunities</h4>
            <div className="space-y-2">
              {(result.winbackOpportunities ?? []).map((opp, i) => (
                <div key={i} className="card space-y-1.5">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent-purple/10 text-accent-purple border border-accent-purple/20 font-medium inline-block">{opp.angle}</span>
                  <p className="text-sm font-semibold text-text-primary">{opp.suggestedHeadline}</p>
                  <p className="text-xs text-text-secondary leading-relaxed">{opp.reason}</p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(opp.suggestedHeadline); toast.success('Headline copied'); }}
                    className="text-xs flex items-center gap-1 text-text-secondary hover:text-accent-blue transition-colors"
                  >
                    <Copy className="w-3 h-3" />Copy headline
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const TABS = ['Competitors', 'Market Research', 'Ad Intelligence'];

export default function ResearchPage() {
  const [activeTab, setActiveTab] = useState('Competitors');

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-purple/10 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-accent-purple" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">Research Hub</h1>
          <p className="text-sm text-text-secondary">Competitor analysis, market intelligence, and ad research</p>
        </div>
      </div>

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

      {activeTab === 'Competitors'       && <CompetitorSection />}
      {activeTab === 'Market Research'   && <MarketResearchSection />}
      {activeTab === 'Ad Intelligence'   && <AdIntelSection />}
    </div>
  );
}
