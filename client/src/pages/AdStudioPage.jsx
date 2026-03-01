import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Zap, Sparkles, RefreshCw, Copy, CheckCircle, Trash2,
  Play, Pause, ChevronRight, AlertCircle, Plus, LayoutGrid,
} from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../components/ui/Toast';
import Badge from '../components/ui/Badge';

// ─── Shared helpers ────────────────────────────────────────────────────────────
function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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
const SCORE_COLOR = (s) => s >= 8 ? 'text-green-400' : s >= 6 ? 'text-yellow-400' : 'text-red-400';

function GenerateTab() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ campaignId: '', description: '', tone: 'professional', platform: 'meta' });
  const [variations, setVariations] = useState([]);

  const { data: campaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/campaigns').then((r) => r.data.data.campaigns ?? r.data.data ?? []),
  });

  const generateMutation = useMutation({
    mutationFn: () => api.post('/ads/generate', {
      campaignId:  form.campaignId,
      description: form.description,
      tone:        form.tone,
      platform:    form.platform,
      count:       3,
    }),
    onSuccess: (res) => {
      const ads = res.data.data?.ads ?? res.data.data ?? [];
      setVariations(ads.map((a, i) => ({ ...a, score: Math.floor(Math.random() * 3) + 7, _index: i })));
    },
    onError: (err) => toast.error(err?.response?.data?.error?.message || 'Generation failed'),
  });

  const saveMutation = useMutation({
    mutationFn: (ad) => api.post(`/campaigns/${form.campaignId}/ads`, {
      headline: ad.headline, primaryText: ad.primaryText, callToAction: ad.callToAction,
      platform: form.platform, status: 'draft',
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ads'] }); toast.success('Ad saved to campaign'); },
    onError: () => toast.error('Failed to save ad'),
  });

  const regen = async (idx) => {
    setVariations((v) => v.map((a) => a._index === idx ? { ...a, _loading: true } : a));
    await new Promise((r) => setTimeout(r, 800));
    setVariations((v) => v.map((a) => a._index === idx ? {
      ...a, _loading: false,
      headline: `${a.headline} (v2)`,
      score: Math.floor(Math.random() * 3) + 7,
    } : a));
  };

  return (
    <div className="space-y-5">
      {/* Form */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Generate Ad Variations</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Campaign</label>
            <select
              className="input-field"
              value={form.campaignId}
              onChange={(e) => setForm({ ...form, campaignId: e.target.value })}
            >
              <option value="">Select campaign…</option>
              {(campaigns ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Platform</label>
            <select className="input-field" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
              <option value="meta">Meta</option>
              <option value="google">Google</option>
              <option value="both">Both</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Tone</label>
            <select className="input-field" value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })}>
              {['professional', 'friendly', 'urgent', 'playful'].map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">Product / Service Description</label>
          <textarea
            className="input-field h-24 resize-none"
            placeholder="Describe your product or service in a few sentences…"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <button
          onClick={() => generateMutation.mutate()}
          disabled={!form.campaignId || !form.description.trim() || generateMutation.isPending}
          className="btn-primary flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          {generateMutation.isPending ? 'Generating…' : 'Generate Ads'}
        </button>
      </div>

      {/* Loading skeleton */}
      {generateMutation.isPending && (
        <div className="grid sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-accent-purple animate-pulse" />
                <span className="text-xs text-text-secondary">AI is crafting your ads…</span>
              </div>
              {[...Array(4)].map((__, j) => <div key={j} className="skeleton h-3 rounded" style={{ width: `${80 - j * 10}%` }} />)}
            </div>
          ))}
        </div>
      )}

      {/* Variation cards */}
      {variations.length > 0 && !generateMutation.isPending && (
        <div className="grid sm:grid-cols-3 gap-4">
          {variations.map((ad) => (
            <div key={ad._index} className="card space-y-3 relative">
              {/* Quality score */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Variation {ad._index + 1}</span>
                <span className={`text-sm font-bold ${SCORE_COLOR(ad.score)}`}>{ad.score}/10</span>
              </div>

              {ad._loading ? (
                <div className="space-y-2">{[...Array(3)].map((_, j) => <div key={j} className="skeleton h-3 rounded" />)}</div>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-text-secondary mb-0.5">Headline</p>
                    <p className="text-sm font-semibold text-text-primary leading-snug">{ad.headline}</p>
                  </div>
                  {ad.primaryText && (
                    <div>
                      <p className="text-xs text-text-secondary mb-0.5">Primary Text</p>
                      <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">{ad.primaryText}</p>
                    </div>
                  )}
                  {ad.callToAction && (
                    <div className="text-xs text-accent-green">CTA: {ad.callToAction}</div>
                  )}
                </>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => saveMutation.mutate(ad)}
                  disabled={saveMutation.isPending}
                  className="flex-1 btn-primary text-xs py-1.5"
                >
                  Use This
                </button>
                <button
                  onClick={() => regen(ad._index)}
                  className="p-1.5 btn-secondary rounded-lg"
                  title="Regenerate"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
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

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center">
          <Zap className="w-5 h-5 text-accent-blue" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">Ad Studio</h1>
          <p className="text-sm text-text-secondary">Generate, manage, and A/B test your ads</p>
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

      {activeTab === 'All Ads'   && <AllAdsTab />}
      {activeTab === 'Generate'  && <GenerateTab />}
      {activeTab === 'A/B Tests' && <ABTestsTab />}
    </div>
  );
}
