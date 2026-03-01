import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Crosshair, Search, Target, Sparkles, CheckCircle2, ChevronRight,
  TrendingUp, DollarSign, Key, Loader2, ExternalLink,
} from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../components/ui/Toast';
import Badge from '../components/ui/Badge';

// ─── Progress steps animation ─────────────────────────────────────────────────
const STEPS = [
  'Scanning ad library…',
  'Finding keyword gaps…',
  'Analyzing messaging angles…',
  'Generating opportunities…',
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

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CompetitorHijackPage() {
  const toast        = useToast();
  const queryClient  = useQueryClient();
  const [domain, setDomain] = useState('');
  const [analysisStep, setAnalysisStep] = useState(0);
  const [result, setResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    if (!domain.trim()) return;
    setAnalyzing(true);
    setResult(null);
    setAnalysisStep(0);

    // Animate through steps
    const interval = setInterval(() => setAnalysisStep((s) => s + 1), 900);

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

  const waitlistKey = 'hijack_waitlist';
  const [onWaitlist, setOnWaitlist] = useState(() => !!localStorage.getItem(waitlistKey));

  const joinWaitlist = () => {
    localStorage.setItem(waitlistKey, '1');
    setOnWaitlist(true);
    toast.success("You're on the waitlist! We'll notify you when this launches.");
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <Crosshair className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-text-primary">Competitor Hijack Engine</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">BETA</span>
            </div>
            <p className="text-sm text-text-secondary">Detect competitor weaknesses and auto-generate campaigns to steal their traffic</p>
          </div>
        </div>
        <button
          onClick={joinWaitlist}
          disabled={onWaitlist}
          className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
            onWaitlist
              ? 'bg-accent-green/10 text-accent-green border border-accent-green/20 cursor-default'
              : 'btn-secondary'
          }`}
        >
          {onWaitlist ? <><CheckCircle2 className="w-4 h-4 inline mr-1.5" />On Waitlist</> : 'Join Waitlist'}
        </button>
      </div>

      {/* ── Analysis input ─────────────────────────────────────────────── */}
      <div className="card space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Analyze Competitor</h3>
          <p className="text-xs text-text-secondary mt-0.5">Enter a competitor domain to reveal their ad strategy and keyword gaps</p>
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
          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-accent-green" />
                <p className="text-xs text-text-secondary font-medium">Est. Ad Spend</p>
              </div>
              <p className="text-xl font-bold text-text-primary">{result.estimatedAdSpend}</p>
            </div>
            <div className="card">
              <div className="flex items-center gap-2 mb-1">
                <Key className="w-4 h-4 text-accent-blue" />
                <p className="text-xs text-text-secondary font-medium">Keywords Found</p>
              </div>
              <p className="text-xl font-bold text-text-primary">{result.topKeywords?.length ?? 0}</p>
            </div>
            <div className="card">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-accent-purple" />
                <p className="text-xs text-text-secondary font-medium">Opportunities</p>
              </div>
              <p className="text-xl font-bold text-text-primary">{result.winbackOpportunities?.length ?? 0}</p>
            </div>
          </div>

          {/* Competitor Ads */}
          <div>
            <h2 className="text-sm font-semibold text-text-primary mb-3">Competitor Ads Running Now</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(result.adExamples ?? []).map((ad, i) => (
                <div key={i} className="card space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge status={ad.platform.toLowerCase()} />
                    <span className="text-[10px] text-text-secondary">Ad #{i + 1}</span>
                  </div>
                  <p className="text-sm font-semibold text-accent-blue">{ad.headline}</p>
                  <p className="text-xs text-text-secondary leading-relaxed">{ad.description}</p>
                  <p className="text-xs text-accent-green font-medium">CTA: {ad.cta}</p>
                  <button
                    onClick={() => toast.info('Counter-ad generation — coming in Phase D2 full release')}
                    className="w-full text-xs py-1.5 rounded-lg border border-border hover:border-accent-blue/40 text-text-secondary hover:text-accent-blue transition-colors flex items-center justify-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />Counter This Ad
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Keyword Gaps */}
          <div>
            <h2 className="text-sm font-semibold text-text-primary mb-3">Keyword Gaps — They rank, you don't</h2>
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-bg-secondary/30">
                      {['Keyword', 'Their Rank', 'Your Rank', 'Volume', 'Action'].map((h) => (
                        <th key={h} className="text-left text-xs text-text-secondary font-medium px-4 py-2.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(result.keywordGaps ?? []).map((gap, i) => (
                      <tr key={i} className="hover:bg-bg-secondary/20">
                        <td className="px-4 py-2.5 text-text-primary font-medium text-xs">{gap.keyword}</td>
                        <td className="px-4 py-2.5 text-accent-green text-xs font-semibold">#{gap.theirRank}</td>
                        <td className="px-4 py-2.5 text-xs">
                          {gap.yourRank
                            ? <span className="text-yellow-400">#{gap.yourRank}</span>
                            : <span className="text-text-secondary italic">Not ranking</span>}
                        </td>
                        <td className="px-4 py-2.5 text-text-secondary text-xs">{gap.volume?.toLocaleString()}/mo</td>
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

          {/* Win-back Opportunities */}
          <div>
            <h2 className="text-sm font-semibold text-text-primary mb-3">Win-back Opportunities</h2>
            <div className="space-y-3">
              {(result.winbackOpportunities ?? []).map((opp, i) => (
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
                  <button
                    onClick={() => toast.info('Full ad generation — coming in Phase D2 full release')}
                    className="text-xs px-3 py-1.5 rounded-lg bg-accent-purple/10 hover:bg-accent-purple/20 text-accent-purple transition-colors flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />Use This Angle
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Messaging angles */}
          <div className="card">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Their Messaging Angles</h3>
            <div className="flex flex-wrap gap-2">
              {(result.messagingAngles ?? []).map((angle) => (
                <span key={angle} className="text-xs px-3 py-1.5 rounded-full border border-border text-text-secondary">
                  {angle}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Feature grid (no results yet) ─────────────────────────────── */}
      {!result && !analyzing && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: Search,    color: 'text-red-400',         bg: 'bg-red-500/10',     title: 'Ad Spy',                  desc: 'See what ads your competitors are running right now across Meta and Google' },
            { icon: Key,       color: 'text-accent-blue',    bg: 'bg-accent-blue/10', title: 'Keyword Gap Sniper',       desc: 'Find keywords they rank for that you don\'t — and target them directly' },
            { icon: Target,    color: 'text-accent-purple',  bg: 'bg-accent-purple/10', title: 'Messaging Angle Detector', desc: 'Identify their positioning and find gaps your brand can own' },
            { icon: Sparkles,  color: 'text-accent-green',   bg: 'bg-accent-green/10', title: 'Win-back Templates',       desc: 'AI generates campaigns to target their customers with counter-messaging' },
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
