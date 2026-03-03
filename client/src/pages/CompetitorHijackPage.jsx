import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Crosshair, Search, Target, Sparkles, CheckCircle2,
  TrendingUp, DollarSign, Key, Loader2, FlaskConical,
  Globe, Code, MousePointer, AlertCircle,
} from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../components/ui/Toast';
import Badge from '../components/ui/Badge';
import FeatureHeader from '../components/ui/FeatureHeader';
import MockDataBanner from '../components/ui/MockDataBanner';
import { FEATURES } from '../config/features';

// ─── Progress steps animation ─────────────────────────────────────────────────
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
          <div
            key={i}
            className={`h-1 w-8 rounded-full transition-colors duration-500 ${i <= step ? 'bg-accent-blue' : 'bg-border'}`}
          />
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
};

function TechBadge({ name }) {
  const cls = TECH_COLORS[name] || 'bg-border/40 text-text-secondary border-border';
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${cls}`}>
      {name}
    </span>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CompetitorHijackPage() {
  const toast       = useToast();
  const queryClient = useQueryClient();
  const [domain, setDomain]           = useState('');
  const [analysisStep, setAnalysisStep] = useState(0);
  const [result, setResult]           = useState(null);
  const [analyzing, setAnalyzing]     = useState(false);

  const handleAnalyze = async () => {
    if (!domain.trim()) return;
    setAnalyzing(true);
    setResult(null);
    setAnalysisStep(0);

    const interval = setInterval(() => setAnalysisStep((s) => s + 1), 1200);

    try {
      const res = await api.get(`/research/hijack-analysis?domain=${encodeURIComponent(domain.trim())}`);
      clearInterval(interval);
      setResult(res.data.data);
    } catch (err) {
      clearInterval(interval);
      toast.error(err?.response?.data?.error?.message || 'Analysis failed');
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

  const feature = FEATURES.radar;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ── Feature Header ──────────────────────────────────────────────── */}
      <FeatureHeader
        codename={feature.codename}
        label={feature.label}
        description={feature.description}
        color={feature.color}
        icon={Crosshair}
        badge={feature.badge}
        stats={feature.stats}
      />

      {/* ── Analysis input ─────────────────────────────────────────────── */}
      <div className="card space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Analyze Competitor</h3>
          <p className="text-xs text-text-secondary mt-0.5">
            Enter a competitor domain to reveal their real page structure, keywords, tech stack, and CTAs
          </p>
        </div>
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
            onClick={handleAnalyze}
            disabled={!domain.trim() || analyzing}
            className="btn-primary whitespace-nowrap flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            {analyzing ? 'Analyzing…' : 'Analyze Competitor'}
          </button>
        </div>
      </div>

      {/* ── Analyzing animation ────────────────────────────────────────── */}
      {analyzing && <AnalyzingAnimation step={analysisStep} />}

      {/* ── Results ────────────────────────────────────────────────────── */}
      {result && !analyzing && (
        <div className="space-y-6">
          {/* Data quality banner */}
          {!result.isReal && (
            <MockDataBanner
              message="Live crawl was blocked by this site. Showing sample data structure — real data available for most sites."
            />
          )}
          {result.isReal && !result.hasAiInsights && (
            <MockDataBanner
              message="Real crawl data shown. Connect Gemini API for AI-powered keyword gap analysis and messaging insights."
            />
          )}

          {/* Site overview */}
          {result.title && (
            <div className="card space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Globe className="w-4 h-4 text-accent-blue shrink-0" />
                    <span className="text-xs text-text-secondary font-medium truncate">{result.url}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-text-primary leading-tight">{result.title}</h3>
                  {result.description && (
                    <p className="text-xs text-text-secondary mt-1 leading-relaxed line-clamp-2">{result.description}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-text-secondary">Links</p>
                  <p className="text-lg font-bold text-text-primary">{result.linkCount ?? '—'}</p>
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
                    {result.techStack.map(tech => <TechBadge key={tech} name={tech} />)}
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
                      <span key={i} className="text-xs px-2.5 py-1 rounded-lg bg-accent-green/10 text-accent-green border border-accent-green/20">
                        {cta}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-text-secondary" />
                <p className="text-xs text-text-secondary font-medium">Est. Ad Spend</p>
              </div>
              <p className="text-base font-bold text-text-primary">
                {result.adSpend ?? 'Data unavailable'}
              </p>
              {result.adSpendNote && (
                <p className="text-[10px] text-amber-400/80 mt-1 leading-snug">{result.adSpendNote}</p>
              )}
            </div>
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
                <p className="text-xs text-text-secondary font-medium">Opportunities</p>
              </div>
              <p className="text-xl font-bold text-text-primary">{result.winbackOpportunities?.length ?? 0}</p>
            </div>
          </div>

          {/* H1/H2 headings from their site */}
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
                    <span className="text-xs text-text-primary font-medium">{kw.word}</span>
                    {kw.frequency && (
                      <span className="text-[10px] text-text-secondary">×{kw.frequency}</span>
                    )}
                    <button
                      onClick={() => addKeywordMutation.mutate(kw.word)}
                      disabled={addKeywordMutation.isPending}
                      className="text-[10px] text-accent-blue hover:underline ml-1"
                    >
                      Track
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Keyword Gaps (AI-generated or crawl-based) */}
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
                          <td className="px-4 py-2.5 text-accent-green text-xs font-semibold">
                            {gap.theirRank ? `#${gap.theirRank}` : 'Ranking'}
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            {gap.yourRank
                              ? <span className="text-yellow-400">#{gap.yourRank}</span>
                              : <span className="text-text-secondary italic">Not ranking</span>}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-text-secondary max-w-[200px]">
                            {gap.opportunity || gap.difficulty || '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            <button
                              onClick={() => addKeywordMutation.mutate(gap.keyword)}
                              disabled={addKeywordMutation.isPending}
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

          {/* Competitor Ads */}
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
                    {ad.description && (
                      <p className="text-xs text-text-secondary leading-relaxed">{ad.description}</p>
                    )}
                    {ad.cta && (
                      <p className="text-xs text-accent-green font-medium">CTA: {ad.cta}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Win-back Opportunities */}
          {result.winbackOpportunities?.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-text-primary mb-3">Win-back Opportunities</h2>
              <div className="space-y-3">
                {result.winbackOpportunities.map((opp, i) => (
                  <div key={i} className="card space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent-purple/10 text-accent-purple border border-accent-purple/20 font-medium">
                          {opp.angle}
                        </span>
                        <p className="text-sm font-semibold text-text-primary mt-2">{opp.suggestedHeadline}</p>
                        <p className="text-xs text-text-secondary mt-1 leading-relaxed">{opp.reason}</p>
                      </div>
                    </div>
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
                  <span key={angle} className="text-xs px-3 py-1.5 rounded-full border border-border text-text-secondary">
                    {angle}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Weaknesses (AI only) */}
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
        </div>
      )}

      {/* ── Feature grid (no results yet) ─────────────────────────────── */}
      {!result && !analyzing && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: Globe,    color: 'text-accent-blue',    bg: 'bg-accent-blue/10',    title: 'Real Site Crawl',           desc: 'See their actual page structure, headlines, CTAs, and technology stack' },
            { icon: Key,      color: 'text-accent-blue',    bg: 'bg-accent-blue/10',    title: 'Keyword Intelligence',      desc: 'Extract the keywords they emphasize most — and track the gaps' },
            { icon: Target,   color: 'text-accent-purple',  bg: 'bg-accent-purple/10',  title: 'Messaging Angle Analysis',  desc: 'Identify their positioning and find gaps your brand can own' },
            { icon: Sparkles, color: 'text-accent-green',   bg: 'bg-accent-green/10',   title: 'AI Strategic Insights',     desc: 'Gemini AI generates keyword gaps, weaknesses, and counter-ad ideas' },
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
