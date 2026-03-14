import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Zap, Sparkles, Copy, CheckCircle, Trash2,
  ChevronRight, AlertCircle, Plus, LayoutGrid,
  BookOpen, Monitor, Smartphone, Info, Edit2, Check,
  Facebook, Search as SearchIcon,
} from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../components/ui/Toast';
import Badge from '../components/ui/Badge';
import FeatureHeader from '../components/ui/FeatureHeader';
import { FEATURES } from '../config/features';

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// ─── Platform specs (useful for ad managers) ──────────────────────────────────
const PLATFORM_SPECS = {
  meta: {
    name: 'Meta (Facebook / Instagram)',
    icon: Facebook,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    placements: [
      { name: 'Feed Ad', headline: 40, primaryText: 125, desc: null, cta: '20' },
      { name: 'Story / Reel', headline: 40, primaryText: 125, desc: null, cta: null },
      { name: 'Right Column', headline: 40, primaryText: 125, desc: 30, cta: null },
    ],
    tips: [
      'First 2 lines of primary text visible before "See More" — lead with the hook.',
      'Use emojis sparingly. 1–2 max. They boost CTR ~15% on average.',
      'Numbers outperform adjectives: "Save $40" beats "Save big".',
      'Question headlines drive 14% more clicks than statement headlines.',
      'Add social proof in primary text — reviews, user counts, or press mentions.',
      'Avoid "you" and "your" in headlines — Meta flags it in some review categories.',
    ],
    compliance: [
      '20% text rule is enforced on images — keep overlay text minimal.',
      'Prohibited: misleading claims, before/after images, body shaming.',
      'Finance / health ads require a disclaimer or authorization.',
    ],
  },
  google: {
    name: 'Google Search Ads',
    icon: SearchIcon,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    placements: [
      { name: 'Responsive Search Ad', headline: 30, primaryText: null, desc: 90, cta: null },
      { name: 'Display Ad — Short', headline: 30, primaryText: null, desc: 90, cta: null },
      { name: 'Performance Max', headline: 30, primaryText: null, desc: 90, cta: null },
    ],
    tips: [
      'Write 8–15 headlines. Google picks the best-performing combo automatically.',
      'Include your keyword in at least 3 headlines for quality score.',
      'Use countdown timers in ad customizers for urgency ("Ends in {=countdown}").',
      'Pin headline 1 to your brand or primary keyword. Headlines 2–3 = benefits.',
      'Descriptions should complete your call-to-action from the headline.',
      'Use sentence case, not title case. Google studies show it converts better.',
    ],
    compliance: [
      'No excessive capitalization or symbols (e.g. "BEST!!!") — auto-disapproved.',
      'Price claims must be accurate and landing-page consistent.',
      'Healthcare / financial categories need certification.',
    ],
  },
  tiktok: {
    name: 'TikTok Ads',
    icon: Monitor,
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/20',
    placements: [
      { name: 'In-Feed Ad', headline: 80, primaryText: null, desc: null, cta: '20' },
      { name: 'TopView', headline: 80, primaryText: null, desc: null, cta: null },
    ],
    tips: [
      'Hook in 0–2 seconds. TikTok users scroll instantly.',
      'Native-feeling content (UGC-style) outperforms polished ads by 2×.',
      'Text overlay on video: keep it to 3–5 words, center-safe zone.',
      'Sound is ON by default. Write headlines that work with audio.',
      'Trending sounds boost discovery — check TikTok Creative Center.',
    ],
    compliance: [
      'No deceptive or misleading claims.',
      'Restricted: supplements, gambling, crypto without authorization.',
    ],
  },
  linkedin: {
    name: 'LinkedIn Ads',
    icon: Smartphone,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/20',
    placements: [
      { name: 'Sponsored Content', headline: 70, primaryText: 150, desc: null, cta: null },
      { name: 'Message Ad', headline: 60, primaryText: 500, desc: null, cta: '20' },
      { name: 'Text Ad', headline: 25, primaryText: 75, desc: null, cta: null },
    ],
    tips: [
      'B2B audiences respond to specificity: "For VP Sales at 50-200 person companies".',
      'Lead with value, not brand. What problem are you solving?',
      'Thought leadership angle (stat + insight) gets 2× more shares.',
      'First 150 chars visible before "See More" — front-load the offer.',
      'Job titles in targeting are powerful — match them in your copy.',
    ],
    compliance: [
      'No misleading claims about products or services.',
      'Financial services require appropriate disclaimers.',
    ],
  },
};

function CharLimit({ value = '', limit, label }) {
  const len = String(value).length;
  const over = limit && len > limit;
  const warn = limit && len > limit * 0.9;
  return (
    <div className="flex items-center justify-between text-[10px] mt-0.5">
      <span className="text-text-secondary">{label}</span>
      {limit ? (
        <span className={over ? 'text-red-400' : warn ? 'text-amber-400' : 'text-text-secondary'}>
          {len}/{limit}
        </span>
      ) : null}
    </div>
  );
}

// ─── All Ads tab ──────────────────────────────────────────────────────────────
function AllAdsTab() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [pendingDel, setPendingDel] = useState(null);
  const [selected, setSelected] = useState(null);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [editingStatus, setEditingStatus] = useState(false);

  const { data: campaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/campaigns').then((r) => r.data.data.campaigns ?? r.data.data ?? []),
  });

  const { data: ads, isLoading } = useQuery({
    queryKey: ['ads', 'all'],
    queryFn: () => {
      const ids = (campaigns ?? []).map((c) => c.id);
      if (!ids.length) return [];
      return Promise.all(
        ids.map((id) => api.get(`/campaigns/${id}/ads`).then((r) => {
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

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/ads/${id}`, { status }),
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['ads'] });
      setSelected((prev) => prev ? { ...prev, status } : prev);
      setEditingStatus(false);
      toast.success(`Status updated to ${status}`);
    },
  });

  const allAds = (ads ?? []).filter((a) => platformFilter === 'all' || a.platform === platformFilter);
  const PLATFORMS = ['all', 'meta', 'google', 'tiktok', 'linkedin'];

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-secondary">Platform:</span>
        {PLATFORMS.map((p) => (
          <button
            key={p}
            onClick={() => setPlatformFilter(p)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              platformFilter === p
                ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/30'
                : 'text-text-secondary border border-border hover:text-text-primary'
            }`}
          >
            {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
        <span className="ml-auto text-xs text-text-secondary">{allAds.length} ad{allAds.length !== 1 ? 's' : ''}</span>
      </div>

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
                  {['Headline', 'Campaign', 'Platform', 'Status', ''].map((h) => (
                    <th key={h} className="text-left text-xs text-text-secondary font-medium px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allAds.map((ad) => (
                  <tr
                    key={ad.id}
                    className="hover:bg-bg-secondary/20 cursor-pointer"
                    onClick={() => { setSelected(ad); setEditingStatus(false); }}
                  >
                    <td className="px-5 py-3 text-text-primary font-medium max-w-[220px] truncate">{ad.headline}</td>
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
      </div>

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
              <CharLimit value={selected.headline} limit={selected.platform === 'google' ? 30 : 40} label="" />
            </div>
            {selected.primaryText && (
              <div>
                <p className="text-xs text-text-secondary mb-1">Primary Text</p>
                <p className="text-sm text-text-secondary leading-relaxed">{selected.primaryText}</p>
                <CharLimit value={selected.primaryText} limit={125} label="" />
              </div>
            )}
            {selected.callToAction && (
              <div>
                <p className="text-xs text-text-secondary mb-1">Call to Action</p>
                <p className="text-sm text-text-primary">{selected.callToAction}</p>
              </div>
            )}
            <div className="flex gap-2 pt-2 flex-wrap">
              <Badge status={selected.platform} />
              <Badge status={selected.status} showDot />
            </div>

            {/* Status edit */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-text-secondary font-medium">Change Status</p>
                {!editingStatus && (
                  <button
                    onClick={() => setEditingStatus(true)}
                    className="text-xs text-accent-blue hover:underline flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                )}
              </div>
              {editingStatus ? (
                <div className="space-y-2">
                  {['draft', 'active', 'paused'].map((s) => (
                    <button
                      key={s}
                      onClick={() => updateStatusMutation.mutate({ id: selected.id, status: s })}
                      disabled={selected.status === s || updateStatusMutation.isPending}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                        selected.status === s
                          ? 'border-accent-blue/30 bg-accent-blue/10 text-accent-blue'
                          : 'border-border text-text-secondary hover:text-text-primary hover:border-border/80'
                      }`}
                    >
                      <span className="capitalize">{s}</span>
                      {selected.status === s && <Check className="w-3 h-3" />}
                    </button>
                  ))}
                  <button onClick={() => setEditingStatus(false)} className="text-xs text-text-secondary hover:text-text-primary mt-1">
                    Cancel
                  </button>
                </div>
              ) : (
                <p className="text-xs text-text-secondary">
                  Currently <span className="text-text-primary capitalize">{selected.status}</span>. Click Edit to change.
                </p>
              )}
            </div>

            {selected.campaignName && (
              <div className="border-t border-border pt-4">
                <p className="text-xs text-text-secondary mb-1">Campaign</p>
                <p className="text-sm text-text-primary">{selected.campaignName}</p>
              </div>
            )}
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

// ─── Shared quality bar ────────────────────────────────────────────────────────
const ANGLE_COLORS = {
  'Social Proof':        { bg: 'rgba(16,185,129,0.12)',  color: '#10b981' },
  'Problem/Solution':    { bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6' },
  'Curiosity':           { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  'Fear of Missing Out': { bg: 'rgba(239,68,68,0.12)',  color: '#ef4444' },
  'Authority':           { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
};

// Platform character limits for live hints
const CHAR_LIMITS = {
  meta:     { headline: 40,  body: 125 },
  google:   { headline: 30,  body: null, desc: 90 },
  tiktok:   { headline: 80,  body: null },
  linkedin: { headline: 70,  body: 150 },
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

function AdVariationCard({ ad, isBest, onCopy, onSave, savePending, platform = 'meta' }) {
  const [copied, setCopied] = useState(false);
  const angleStyle = ANGLE_COLORS[ad.angle] || ANGLE_COLORS['Curiosity'];
  const limits = CHAR_LIMITS[platform] || CHAR_LIMITS.meta;
  const headline = ad.headline || '';
  const body = ad.body || ad.primaryText || '';
  const headlineOver = limits.headline && headline.length > limits.headline;
  const bodyOver = limits.body && body.length > limits.body;

  const handleCopy = () => {
    const text = `${headline}\n\n${body}\n\nCTA: ${ad.cta || ad.callToAction || ''}`;
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
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          background: angleStyle.bg, color: angleStyle.color,
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', padding: '3px 10px', borderRadius: 20,
        }}>
          {ad.angle || 'Variation'}
        </span>
        {isBest && (
          <span style={{ background: 'rgba(139,92,246,0.2)', color: '#8b5cf6', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
            BEST
          </span>
        )}
      </div>

      {/* Headline */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>HEADLINE</div>
          {limits.headline && (
            <span style={{ fontSize: 10, color: headlineOver ? '#ef4444' : 'rgba(255,255,255,0.3)' }}>
              {headline.length}/{limits.headline}
            </span>
          )}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.9)', lineHeight: 1.4 }}>{headline}</div>
      </div>

      {/* Body */}
      {body && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {platform === 'google' ? 'DESCRIPTION' : 'BODY'}
            </div>
            {limits.body && (
              <span style={{ fontSize: 10, color: bodyOver ? '#ef4444' : 'rgba(255,255,255,0.3)' }}>
                {body.length}/{limits.body}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.55 }}>
            {body.slice(0, 200)}{body.length > 200 ? '…' : ''}
          </div>
        </div>
      )}

      {/* CTA */}
      {(ad.cta || ad.callToAction) && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#10b981', fontWeight: 600 }}>
          <span style={{ fontSize: 9 }}>▶</span>
          {ad.cta || ad.callToAction}
        </div>
      )}

      {/* Google-specific: display URL / sitelinks */}
      {platform === 'google' && (ad.displayUrl || ad.sitelinks?.length) && (
        <div className="space-y-1 text-xs text-text-secondary">
          {ad.displayUrl && <div>Display URL: {ad.displayUrl}</div>}
          {ad.sitelinks?.length ? <div>Sitelinks: {ad.sitelinks.join(' • ')}</div> : null}
        </div>
      )}

      {/* Quality */}
      {ad.qualityScore !== undefined && <QualityBar score={ad.qualityScore} />}

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
          {copied ? '✓ Copied' : 'Copy'}
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
          Save to Campaign
        </button>
      </div>
    </div>
  );
}

// ─── Generate tab ─────────────────────────────────────────────────────────────
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

  const limits = CHAR_LIMITS[form.platform] || CHAR_LIMITS.meta;

  const generateMutation = useMutation({
    mutationFn: () => api.post(
      form.campaignId ? `/campaigns/${form.campaignId}/ads/generate` : '/ads/generate',
      { keyword: form.keyword, platform: form.platform, goal: form.goal,
        targetAudience: form.targetAudience, productName: form.productName, count: 4 }
    ),
    onSuccess: (res) => {
      const data = res.data.data;
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ads'] }); toast.success('Ad saved to campaign'); },
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
          <p className="text-xs text-text-secondary mt-0.5">
            Generate 4 high-converting ad angles with platform-specific copy and real character limits
          </p>
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
            <select className="input-field" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value, campaignId: '' })}>
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
              placeholder="e.g. working adults 25–40, gym-goers, B2B SaaS founders…"
              value={form.targetAudience}
              onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
            />
          </div>
        </div>

        {/* Platform limits inline hint */}
        <div className="flex items-center gap-2 text-xs text-text-secondary bg-bg-secondary/40 rounded-lg px-3 py-2">
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span>
            {form.platform === 'meta' && 'Meta: headline ≤40 chars, primary text ≤125 chars'}
            {form.platform === 'google' && 'Google RSA: headline ≤30 chars, description ≤90 chars (up to 15 headlines)'}
            {form.platform === 'tiktok' && 'TikTok: headline ≤80 chars — hook in first 2 seconds'}
            {form.platform === 'linkedin' && 'LinkedIn: headline ≤70 chars, intro text ≤150 chars'}
          </span>
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
              platform={form.platform}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Platform Specs tab ────────────────────────────────────────────────────────
function PlatformSpecsTab() {
  const [activePlatform, setActivePlatform] = useState('meta');
  const spec = PLATFORM_SPECS[activePlatform];
  const Icon = spec.icon;

  return (
    <div className="space-y-5">
      {/* Platform selector */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(PLATFORM_SPECS).map(([key, s]) => {
          const PIcon = s.icon;
          return (
            <button
              key={key}
              onClick={() => setActivePlatform(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                activePlatform === key
                  ? `${s.bg} ${s.border} ${s.color}`
                  : 'border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              <PIcon className="w-3.5 h-3.5" />
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          );
        })}
      </div>

      {/* Character limits */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg ${spec.bg} flex items-center justify-center shrink-0`}>
            <Icon className={`w-4 h-4 ${spec.color}`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">{spec.name}</h3>
            <p className="text-xs text-text-secondary">Character limits per placement</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                {['Placement', 'Headline', 'Body / Primary Text', 'Description', 'CTA'].map((h) => (
                  <th key={h} className="text-left text-text-secondary font-medium pb-2 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {spec.placements.map((p) => (
                <tr key={p.name}>
                  <td className="py-2.5 pr-4 font-medium text-text-primary whitespace-nowrap">{p.name}</td>
                  <td className="py-2.5 pr-4 text-text-secondary">{p.headline ? <span className="font-mono">{p.headline}</span> : '—'}</td>
                  <td className="py-2.5 pr-4 text-text-secondary">{p.primaryText ? <span className="font-mono">{p.primaryText}</span> : '—'}</td>
                  <td className="py-2.5 pr-4 text-text-secondary">{p.desc ? <span className="font-mono">{p.desc}</span> : '—'}</td>
                  <td className="py-2.5 text-text-secondary">{p.cta ? <span className="font-mono">{p.cta}</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Copy tips */}
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-text-secondary" />
          Copy Tips That Convert
        </h3>
        <ul className="space-y-2.5">
          {spec.tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className={`text-xs mt-0.5 font-bold ${spec.color}`}>{i + 1}.</span>
              <span className="text-xs text-text-secondary leading-relaxed">{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Compliance */}
      <div className="card space-y-3 border-amber-500/20 bg-amber-500/5">
        <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          Policy & Compliance Flags
        </h3>
        <ul className="space-y-2">
          {spec.compliance.map((rule, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-amber-400 text-xs mt-0.5">⚠</span>
              <span className="text-xs text-text-secondary leading-relaxed">{rule}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const TABS = ['Generate', 'Ad Library', 'Platform Specs'];

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

      {activeTab === 'Generate'       && <GenerateTab />}
      {activeTab === 'Ad Library'     && <AllAdsTab />}
      {activeTab === 'Platform Specs' && <PlatformSpecsTab />}
    </div>
  );
}
