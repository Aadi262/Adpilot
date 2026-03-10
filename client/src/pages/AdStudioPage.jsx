import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Zap, Sparkles, RefreshCw, Copy, CheckCircle, Trash2,
  Play, Pause, ChevronRight, AlertCircle, Plus, LayoutGrid,
} from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../components/ui/Toast';
import Badge from '../components/ui/Badge';
import FeatureHeader from '../components/ui/FeatureHeader';
import { FEATURES } from '../config/features';

// ─── Shared helpers ────────────────────────────────────────────────────────────
function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
      <div className="bg-bg-card border border-border rounded-xl shadow-2xl max-w-sm w-full p-6">
        <h3 className="text-base font-semibold text-text-primary mb-2">{title}</h3>
        <p className="text-sm text-text-secondary mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="btn-secondary text-sm px-4">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── All Ads tab ──────────────────────────────────────────────────────────────
function AllAdsTab() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [pendingDel, setPendingDel] = useState(null);
  const [selected, setSelected] = useState(null);

  const { data: campaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/campaigns').then((r) => r.data.data.campaigns ?? r.data.data ?? []),
  });

  const { data: ads, isLoading } = useQuery({
    queryKey: ['ads', 'all'],
    queryFn: () => {
      const ids = (campaigns ?? []).map((c) => c.id);
      if (!ids.length) return [];
      // Fetch ads for first few campaigns (simple approach)
      return Promise.all(
        ids.slice(0, 5).map((id) => api.get(`/campaigns/${id}/ads`).then((r) => {
          const list = r.data.data?.ads ?? r.data.data ?? [];
          return list.map((a) => ({ ...a, campaignName: (campaigns ?? []).find((c) => c.id === id)?.name }));
        }))
      ).then((results) => results.flat());
    },
    enabled: !!(campaigns?.length),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/ads/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ads'] }); setPendingDel(null); toast.success('Ad deleted'); },
  });

  const allAds = ads ?? [];

  return (
    <div className="card p-0 overflow-hidden">
      {isLoading ? (
        <div className="p-8 text-center text-text-secondary text-sm">Loading ads…</div>
      ) : allAds.length === 0 ? (
        <div className="py-16 text-center text-text-secondary">
          <LayoutGrid className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-sm">No ads yet</p>
          <p className="text-xs mt-1">Generate your first ad using the Generate tab.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-secondary/30">
                {['Headline', 'Campaign', 'Platform', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left text-xs text-text-secondary font-medium px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allAds.map((ad) => (
                <tr
                  key={ad.id}
                  className="hover:bg-bg-secondary/20 cursor-pointer"
                  onClick={() => setSelected(ad)}
                >
                  <td className="px-5 py-3 text-text-primary font-medium max-w-[200px] truncate">{ad.headline}</td>
                  <td className="px-5 py-3 text-text-secondary text-xs">{ad.campaignName ?? '—'}</td>
                  <td className="px-5 py-3"><Badge status={ad.platform} /></td>
                  <td className="px-5 py-3"><Badge status={ad.status} showDot /></td>
                  <td className="px-5 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); setPendingDel(ad); }}
                      className="p-1.5 rounded text-text-secondary hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Side panel */}
      {selected && (
        <div className="fixed inset-y-0 right-0 w-80 bg-bg-card border-l border-border z-40 overflow-y-auto">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-text-primary">Ad Details</h3>
            <button onClick={() => setSelected(null)} className="text-text-secondary hover:text-text-primary">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs text-text-secondary mb-1">Headline</p>
              <p className="text-sm font-semibold text-text-primary">{selected.headline}</p>
            </div>
            {selected.primaryText && (
              <div>
                <p className="text-xs text-text-secondary mb-1">Primary Text</p>
                <p className="text-sm text-text-secondary">{selected.primaryText}</p>
              </div>
            )}
            {selected.callToAction && (
              <div>
                <p className="text-xs text-text-secondary mb-1">Call to Action</p>
                <p className="text-sm text-text-primary">{selected.callToAction}</p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Badge status={selected.platform} />
              <Badge status={selected.status} showDot />
            </div>
          </div>
        </div>
      )}

      {pendingDel && (
        <ConfirmDialog
          title="Delete ad?"
          message="This ad will be permanently removed."
          onConfirm={() => deleteMutation.mutate(pendingDel.id)}
          onCancel={() => setPendingDel(null)}
        />
      )}
    </div>
  );
}

// ─── Generate tab ─────────────────────────────────────────────────────────────

const ANGLE_COLORS = {
  'Social Proof':     { bg: 'rgba(16,185,129,0.12)',  color: '#10b981' },
  'Problem/Solution': { bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6' },
  'Curiosity':        { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  'Fear of Missing Out': { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
  'Authority':        { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
};

function QualityBar({ score }) {
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Quality score</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{score}/100</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 2, width: `${score}%`,
          background: `linear-gradient(90deg, #8b5cf6, ${color})`,
          transition: 'width 0.8s ease',
        }} />
      </div>
    </div>
  );
}

function AdVariationCard({ ad, isBest, onCopy, onSave, savePending }) {
  const [copied, setCopied] = useState(false);
  const angleStyle = ANGLE_COLORS[ad.angle] || ANGLE_COLORS['Curiosity'];

  const handleCopy = () => {
    const text = `${ad.headline}\n\n${ad.body || ad.primaryText || ''}\n\nCTA: ${ad.cta || ad.callToAction || ''}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.();
    });
  };

  return (
    <div style={{
      background: isBest ? 'rgba(139,92,246,0.06)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${isBest ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 14, padding: 20,
      display: 'flex', flexDirection: 'column', gap: 14,
      transition: 'transform 0.2s, border-color 0.2s',
    }}>
      {/* Header: angle badge + best label */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          background: angleStyle.bg, color: angleStyle.color,
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', padding: '3px 10px', borderRadius: 20,
        }}>
          {ad.angle || 'Variation'}
        </span>
        {isBest && (
          <span style={{
            background: 'rgba(139,92,246,0.2)', color: '#8b5cf6',
            fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
          }}>
            BEST
          </span>
        )}
      </div>

      {/* Headline */}
      <div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>HEADLINE</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.9)', lineHeight: 1.4 }}>
          {ad.headline}
        </div>
      </div>

      {/* Body */}
      {(ad.body || ad.primaryText) && (
        <div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>BODY</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.55 }}>
            {(ad.body || ad.primaryText || '').slice(0, 160)}{(ad.body || ad.primaryText || '').length > 160 ? '…' : ''}
          </div>
        </div>
      )}

      {/* CTA */}
      {(ad.cta || ad.callToAction) && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 11, color: '#10b981', fontWeight: 600,
        }}>
          <span style={{ fontSize: 9 }}>▶</span>
          CTA: {ad.cta || ad.callToAction}
        </div>
      )}

      {/* Quality */}
      {ad.qualityScore !== undefined && <QualityBar score={ad.qualityScore} />}

      {(ad.relevance !== undefined || ad.emotionalTrigger !== undefined || ad.ctaClarity !== undefined || ad.uniqueness !== undefined) && (
        <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary">
          <div>Relevance: {ad.relevance ?? '—'}</div>
          <div>Emotion: {ad.emotionalTrigger ?? '—'}</div>
          <div>CTA clarity: {ad.ctaClarity ?? '—'}</div>
          <div>Uniqueness: {ad.uniqueness ?? '—'}</div>
        </div>
      )}

      {(ad.displayUrl || ad.sitelinks?.length || ad.targetAudienceNote) && (
        <div className="space-y-1 text-xs text-text-secondary">
          {ad.displayUrl && <div>Display URL: {ad.displayUrl}</div>}
          {ad.sitelinks?.length ? <div>Sitelinks: {ad.sitelinks.join(' • ')}</div> : null}
          {ad.targetAudienceNote ? <div>Audience: {ad.targetAudienceNote}</div> : null}
        </div>
      )}

      {/* Why it works */}
      {(ad.qualityReason || ad.hook) && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', lineHeight: 1.4 }}>
          {ad.qualityReason || ad.hook}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
        <button
          onClick={handleCopy}
          style={{
            flex: 1, padding: '7px 0', borderRadius: 8,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: copied ? '#10b981' : 'rgba(255,255,255,0.6)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button
          onClick={() => onSave(ad)}
          disabled={savePending}
          style={{
            flex: 1, padding: '7px 0', borderRadius: 8,
            background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)',
            color: '#8b5cf6', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

function GenerateTab() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    keyword: '', platform: 'meta', goal: 'conversions',
    targetAudience: '', productName: '', campaignId: '',
  });
  const [result, setResult] = useState(null);

  const { data: campaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/campaigns').then((r) => r.data.data.campaigns ?? r.data.data ?? []),
  });

  const generateMutation = useMutation({
    mutationFn: () => api.post(
      form.campaignId ? `/campaigns/${form.campaignId}/ads/generate` : '/ads/generate',
      { keyword: form.keyword, platform: form.platform, goal: form.goal,
        targetAudience: form.targetAudience, productName: form.productName, count: 4 }
    ),
    onSuccess: (res) => {
      const data = res.data.data;
      // Handle both API formats: {variations:[...]} and [{headline,...},...]
      const variations = Array.isArray(data) ? data
        : Array.isArray(data?.variations) ? data.variations
        : [];
      setResult({ variations, keyInsight: data?.keyInsight });
    },
    onError: (err) => toast.error(err?.response?.data?.error?.message || 'Generation failed. Try again.'),
  });

  const saveMutation = useMutation({
    mutationFn: (ad) => api.post(
      form.campaignId ? `/campaigns/${form.campaignId}/ads` : `/campaigns/${(campaigns?.[0])?.id}/ads`,
      { headline: ad.headline, primaryText: ad.body || ad.primaryText, callToAction: ad.cta || ad.callToAction,
        platform: form.platform, status: 'draft' }
    ),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ads'] }); toast.success('Ad saved'); },
    onError: () => toast.error('Save failed — select a campaign first'),
  });

  const variations = result?.variations ?? [];
  const bestIdx = variations.length > 0
    ? variations.reduce((best, v, i) => (v.qualityScore || 0) > (variations[best]?.qualityScore || 0) ? i : best, 0)
    : -1;

  const canGenerate = form.keyword.trim().length >= 2;

  return (
    <div className="space-y-5">
      {/* Form */}
      <div className="card space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">AI Creative Studio</h3>
          <p className="text-xs text-text-secondary mt-0.5">Generate 4 ad angles — Social Proof, Problem/Solution, Curiosity, and FOMO</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="sm:col-span-3">
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Keyword / Product *</label>
            <input
              className="input-field"
              placeholder="e.g. protein shake, CRM software, online yoga course…"
              value={form.keyword}
              onChange={(e) => setForm({ ...form, keyword: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Platform</label>
            <select className="input-field" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
              <option value="meta">Meta (Facebook/Instagram)</option>
              <option value="google">Google Search</option>
              <option value="tiktok">TikTok</option>
              <option value="linkedin">LinkedIn</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Goal</label>
            <select className="input-field" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })}>
              <option value="conversions">Conversions / Sales</option>
              <option value="leads">Lead Generation</option>
              <option value="traffic">Drive Traffic</option>
              <option value="awareness">Brand Awareness</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Campaign (optional)</label>
            <select className="input-field" value={form.campaignId} onChange={(e) => setForm({ ...form, campaignId: e.target.value })}>
              <option value="">No campaign — just generate</option>
              {(campaigns ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Target Audience (optional)</label>
            <input
              className="input-field"
              placeholder="e.g. working adults 25-40, gym-goers, B2B SaaS founders…"
              value={form.targetAudience}
              onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
            />
          </div>
        </div>

        <button
          onClick={() => generateMutation.mutate()}
          disabled={!canGenerate || generateMutation.isPending}
          className="btn-primary flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          {generateMutation.isPending ? 'AI is writing your ads…' : 'Generate 4 Ad Variations'}
        </button>
      </div>

      {/* Loading skeleton */}
      {generateMutation.isPending && (
        <div className="grid sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card space-y-3">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Sparkles className="w-4 h-4 text-accent-purple animate-pulse" />
                <span className="text-xs text-text-secondary">Crafting {['social proof', 'problem/solution', 'curiosity', 'FOMO'][i]} angle…</span>
              </div>
              {[...Array(4)].map((__, j) => <div key={j} className="skeleton h-3 rounded" style={{ width: `${85 - j * 12}%` }} />)}
            </div>
          ))}
        </div>
      )}

      {/* AI Insight */}
      {result?.keyInsight && !generateMutation.isPending && (
        <div style={{
          background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)',
          borderRadius: 10, padding: '12px 16px',
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <Sparkles className="w-4 h-4 text-accent-purple shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-semibold text-accent-purple mb-1">AI INSIGHT</div>
            <div className="text-xs text-text-secondary leading-relaxed">{result.keyInsight}</div>
          </div>
        </div>
      )}

      {/* Variation cards */}
      {variations.length > 0 && !generateMutation.isPending && (
        <div className="grid sm:grid-cols-2 gap-4">
          {variations.map((ad, i) => (
            <AdVariationCard
              key={i}
              ad={ad}
              isBest={i === bestIdx && variations.length > 1}
              onCopy={() => toast.success('Copied to clipboard')}
              onSave={(ad) => saveMutation.mutate(ad)}
              savePending={saveMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── A/B Tests tab ────────────────────────────────────────────────────────────
function ABTestsTab() {
  return (
    <div className="card py-14 text-center text-text-secondary">
      <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="font-medium text-sm">A/B Testing</p>
      <p className="text-xs mt-1">Create tests to compare ad performance side-by-side.</p>
      <button className="mt-4 btn-secondary text-sm opacity-50 cursor-not-allowed">
        Coming Soon
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const TABS = ['All Ads', 'Generate', 'A/B Tests'];

export default function AdStudioPage() {
  const [activeTab, setActiveTab] = useState('Generate');

  const feature = FEATURES.forge;

  return (
    <div className="space-y-5">
      <FeatureHeader
        codename={feature.codename}
        label={feature.label}
        description={feature.description}
        color={feature.color}
        icon={Zap}
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

      {activeTab === 'All Ads'   && <AllAdsTab />}
      {activeTab === 'Generate'  && <GenerateTab />}
      {activeTab === 'A/B Tests' && <ABTestsTab />}
    </div>
  );
}
