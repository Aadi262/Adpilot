import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import {
  Sparkles, FileText, TrendingUp, TrendingDown, Activity,
  Zap, X,
  Download, Copy, CheckCircle, Loader2, AlertCircle,
  Target, Bell, ChevronRight, ShieldAlert, Award, Eye,
} from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../components/ui/Toast';

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtCurrency(n) {
  const v = Number(n) || 0;
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

// ── Animated count-up ─────────────────────────────────────────────────────────
function CountUp({ target, duration = 1200 }) {
  const [val, setVal] = useState(0);
  const frame = useRef(null);

  useEffect(() => {
    if (!target) return;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(ease * target));
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, duration]);

  return val;
}

// ── Tiny SVG sparkline ─────────────────────────────────────────────────────────
function Sparkline({ points = [], color = '#10b981', height = 32, width = 80 }) {
  if (!points.length) return null;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const pts = points.map((v, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Health ring ────────────────────────────────────────────────────────────────
function HealthRing({ score, size = 80 }) {
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)' }}
      />
    </svg>
  );
}

// ── Priority badge ─────────────────────────────────────────────────────────────
const PRIORITY_STYLES = {
  CRITICAL: { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444',  label: 'CRITICAL' },
  HIGH:     { bg: 'rgba(239,68,68,0.10)',   color: '#ef4444',  label: 'HIGH' },
  MEDIUM:   { bg: 'rgba(245,158,11,0.10)',  color: '#f59e0b',  label: 'MED' },
  LOW:      { bg: 'rgba(59,130,246,0.10)',  color: '#60a5fa',  label: 'LOW' },
};

function PriorityBadge({ priority }) {
  const s = PRIORITY_STYLES[priority] || PRIORITY_STYLES.LOW;
  return (
    <span style={{
      background: s.bg, color: s.color,
      fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
      padding: '2px 7px', borderRadius: 20,
    }}>
      {s.label}
    </span>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────────
function KPICard({ label, value, delta, deltaLabel, positive = true, sparkPoints, icon: Icon, iconColor, href, loading }) {
  const navigate = useNavigate();
  const trend = delta !== undefined && delta !== null;

  if (loading) {
    return (
      <div className="card" style={{ borderRadius: 14 }}>
        <div className="skeleton h-4 w-20 mb-3 rounded" />
        <div className="skeleton h-8 w-28 mb-2 rounded" />
        <div className="skeleton h-3 w-16 rounded" />
      </div>
    );
  }

  return (
    <div
      onClick={() => href && navigate(href)}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        padding: '18px 20px',
        cursor: href ? 'pointer' : 'default',
        transition: 'border-color 0.2s',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
      onMouseEnter={e => href && (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)')}
      onMouseLeave={e => href && (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {label}
        </span>
        {Icon && (
          <div style={{ width: 28, height: 28, borderRadius: 8, background: `${iconColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={13} color={iconColor} />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'rgba(255,255,255,0.92)', lineHeight: 1 }}>
            {value ?? '—'}
          </div>
          {trend && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
              {positive ? (
                <TrendingUp size={11} color="#10b981" />
              ) : (
                <TrendingDown size={11} color="#ef4444" />
              )}
              <span style={{ fontSize: 11, color: positive ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                {positive ? '+' : ''}{delta} {deltaLabel}
              </span>
            </div>
          )}
        </div>
        {sparkPoints && <Sparkline points={sparkPoints} color={positive ? '#10b981' : '#ef4444'} />}
      </div>
    </div>
  );
}

// ── Recommendation Card ────────────────────────────────────────────────────────
function RecommendationCard({ rec }) {
  const navigate = useNavigate();

  const handleAction = () => {
    navigate(rec.ctaUrl);
  };

  return (
    <div style={{
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12,
      padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <PriorityBadge priority={rec.priority} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>
            {rec.title}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)', lineHeight: 1.5 }}>
            {rec.description}
          </div>
        </div>
        {rec.ctaUrl && (
          <button
            onClick={handleAction}
            style={{
              background: 'rgba(139,92,246,0.12)',
              border: '1px solid rgba(139,92,246,0.22)',
              color: '#a78bfa',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
              padding: '6px 12px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {rec.cta} →
          </button>
        )}
      </div>
    </div>
  );
}

// ── Quick Action Card ──────────────────────────────────────────────────────────
function QuickActionCard({ label, description, gradient, href }) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(href)}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        padding: '18px 20px',
        cursor: 'pointer',
        transition: 'border-color 0.2s, transform 0.15s',
        display: 'flex', alignItems: 'center', gap: 14,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)';
        e.currentTarget.querySelector('.qa-arrow').style.transform = 'translateX(4px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
        e.currentTarget.querySelector('.qa-arrow').style.transform = 'translateX(0)';
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 11,
        background: gradient, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>{description}</div>
      </div>
      <ChevronRight size={14} color="rgba(255,255,255,0.3)" className="qa-arrow" style={{ transition: 'transform 0.2s', flexShrink: 0 }} />
    </div>
  );
}

// ── Report Modal ───────────────────────────────────────────────────────────────
function ReportModal({ onClose }) {
  const toast = useToast();
  const [range, setRange] = useState('30d');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/reports/generate?range=${range}`);
      setReport(res.data.data ?? res.data);
    } catch (err) {
      toast.error('Failed to generate report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyText = () => {
    if (!report) return;
    const txt = report.reportMarkdown || '';

    navigator.clipboard.writeText(txt).then(() => {
      setCopied(true);
      toast.success('Report copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const printReport = () => window.print();

  const ov = report?.overview ?? {};
  const healthScore = (ov.health || {}).score ?? 0;
  const healthColor = healthScore >= 75 ? '#10b981' : healthScore >= 50 ? '#f59e0b' : '#ef4444';
  const seoHealth = report?.seoHealthScore ?? {};
  const keywordRows = report?.keywordPerformance ?? [];
  const competitorRows = report?.competitorMatrix ?? [];
  const contentRows = report?.contentRecommendations ?? [];
  const technicalRows = report?.technicalIssues ?? [];
  const actionRows = report?.actionPlan ?? [];

  const colorForStatus = (status) =>
    status === 'green' ? '#10b981' : status === 'yellow' ? '#f59e0b' : '#ef4444';

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 999, padding: 24,
    }}>
      <div style={{
        background: '#0d0f1a',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20,
        width: '100%', maxWidth: 680,
        maxHeight: '90vh', overflowY: 'auto',
        padding: 32,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.9)', margin: 0 }}>
              Generate Report
            </h2>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
              AI-powered performance summary for any time range
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} color="rgba(255,255,255,0.5)" />
          </button>
        </div>

        {/* Range selector */}
        {!report && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>Time Range</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['7d', '30d', '90d'].map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 8,
                    border: `1px solid ${range === r ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.1)'}`,
                    background: range === r ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.03)',
                    color: range === r ? '#a78bfa' : 'rgba(255,255,255,0.6)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {r === '7d' ? 'Last 7 days' : r === '30d' ? 'Last 30 days' : 'Last 90 days'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Generate button */}
        {!report && (
          <button
            onClick={generate}
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? 'rgba(139,92,246,0.3)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border: 'none', borderRadius: 10,
              color: '#fff', fontSize: 14, fontWeight: 700,
              padding: '13px 0', cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Compiling your report…
              </>
            ) : (
              <>
                <FileText size={16} />
                Generate Report
              </>
            )}
          </button>
        )}

        {/* Report content */}
        {report && (
          <div>
            {/* Report header */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14, padding: '20px 24px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 20,
            }}>
              <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <HealthRing score={healthScore} size={80} />
                <div style={{ position: 'absolute', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: healthColor }}>{healthScore}</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Health Score — {report.range}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginTop: 4 }}>
                  {(ov.health || {}).label || 'Calculating...'}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                  Generated {new Date(report.generatedAt).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Metrics grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Total Spend', value: fmtCurrency(ov.totalSpend) },
                { label: 'Total Revenue', value: fmtCurrency(ov.totalRevenue) },
                { label: 'Avg ROAS', value: `${ov.avgROAS || 0}x` },
                { label: 'Overall CTR', value: `${ov.overallCTR || 0}%` },
                { label: 'Conversions', value: ov.totalConversions || 0 },
                { label: 'Active / Total Camps.', value: `${ov.activeCampaigns || 0}/${ov.totalCampaigns || 0}` },
              ].map(m => (
                <div key={m.label} style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 10, padding: '12px 14px',
                }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.88)' }}>{m.value}</div>
                </div>
              ))}
            </div>

            {report.executiveSummary && (
              <div style={{
                background: 'rgba(139,92,246,0.08)',
                border: '1px solid rgba(139,92,246,0.2)',
                borderRadius: 12, padding: '16px 18px', marginBottom: 20,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <Sparkles size={13} color="#a78bfa" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Executive Summary</span>
                </div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, margin: 0 }}>
                  {report.executiveSummary.overview}
                </p>
                {report.executiveSummary.findings && (
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, margin: '10px 0 0' }}>
                    {report.executiveSummary.findings}
                  </p>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>SEO Health Breakdown</div>
                {[
                  ['Technical SEO', seoHealth.technicalSeo],
                  ['Content Quality', seoHealth.contentQuality],
                  ['Keyword Coverage', seoHealth.keywordCoverage],
                  ['Backlink Profile', seoHealth.backlinkProfile],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>
                    <span>{label}</span>
                    <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>{value ?? 0}/100</span>
                  </div>
                ))}
              </div>

              <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Priority Actions</div>
                {(report.executiveSummary?.recommendedActions || []).slice(0, 4).map((item, idx) => (
                  <div key={idx} style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: idx === 0 ? 0 : 8, lineHeight: 1.45 }}>
                    {idx + 1}. {item}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6ee7b7', marginBottom: 8 }}>Top Opportunities</div>
                {(report.executiveSummary?.topOpportunities || []).map((item, idx) => (
                  <div key={idx} style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: idx === 0 ? 0 : 8, lineHeight: 1.45 }}>
                    {item}
                  </div>
                ))}
              </div>
              <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#fca5a5', marginBottom: 8 }}>Top Threats</div>
                {(report.executiveSummary?.topThreats || []).map((item, idx) => (
                  <div key={idx} style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: idx === 0 ? 0 : 8, lineHeight: 1.45 }}>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Keyword Performance</div>
              <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
                {(keywordRows.length ? keywordRows.slice(0, 8) : []).map((row, idx) => (
                  <div key={row.keyword} style={{
                    display: 'grid',
                    gridTemplateColumns: '1.5fr 0.6fr 0.6fr 0.7fr 0.8fr',
                    gap: 10,
                    padding: '11px 14px',
                    borderTop: idx === 0 ? 'none' : '1px solid rgba(255,255,255,0.05)',
                    background: idx % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.015)',
                    alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.88)' }}>{row.keyword}</div>
                      <div style={{ fontSize: 11, color: colorForStatus(row.status), marginTop: 2 }}>{row.trend} • {row.intent}</div>
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)' }}>{row.volume ?? '—'}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)' }}>{row.position ?? '—'}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)' }}>{row.difficulty ?? '—'}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: colorForStatus(row.status) }}>{row.opportunity ?? '—'}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Competitor Comparison</div>
                {competitorRows.length ? competitorRows.map((row, idx) => (
                  <div key={idx} style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: idx === 0 ? 0 : 10, lineHeight: 1.45 }}>
                    <div style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 700 }}>{row.competitor}</div>
                    <div>Keywords: {row.keywordCount ?? 'Unavailable'}</div>
                    <div>Top content/topic: {row.topContent || 'Unavailable'}</div>
                    <div>Ad spend: {row.adSpend || 'Unavailable'}</div>
                  </div>
                )) : <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>No competitor data available yet.</div>}
              </div>

              <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Content Recommendations</div>
                {contentRows.length ? contentRows.map((row, idx) => (
                  <div key={idx} style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: idx === 0 ? 0 : 10, lineHeight: 1.45 }}>
                    <div style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 700 }}>{row.topic}</div>
                    <div>Keyword: {row.targetKeyword}</div>
                    <div>Traffic potential: {row.estimatedTrafficPotential ?? 'Unavailable'}</div>
                    <div>Difficulty: {row.difficulty ?? 'Unavailable'}</div>
                  </div>
                )) : <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>No content opportunities available yet.</div>}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Technical Issues</div>
                {technicalRows.length ? technicalRows.slice(0, 5).map((row, idx) => (
                  <div key={idx} style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: idx === 0 ? 0 : 10, lineHeight: 1.45 }}>
                    <div style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 700 }}>{row.issue}</div>
                    <div>{row.url}</div>
                    <div>Severity: {row.severity}</div>
                    <div>{row.recommendation}</div>
                  </div>
                )) : <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>No technical issues available yet.</div>}
              </div>

              <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Action Plan</div>
                {actionRows.map((row, idx) => (
                  <div key={idx} style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: idx === 0 ? 0 : 10, lineHeight: 1.45 }}>
                    <div style={{ color: row.priority === 'critical' ? '#fca5a5' : row.priority === 'important' ? '#fcd34d' : '#93c5fd', fontWeight: 700, textTransform: 'uppercase' }}>
                      {row.priority}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 700, marginTop: 2 }}>{row.title}</div>
                    <div>{row.detail}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Export actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={copyText}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10, color: 'rgba(255,255,255,0.7)',
                  fontSize: 13, fontWeight: 600, padding: '11px 0',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {copied ? <CheckCircle size={14} color="#10b981" /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy as Text'}
              </button>
              <button
                onClick={printReport}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10, color: 'rgba(255,255,255,0.7)',
                  fontSize: 13, fontWeight: 600, padding: '11px 0',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Download size={14} />
                Download PDF
              </button>
              <button
                onClick={() => setReport(null)}
                style={{
                  background: 'none', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10, color: 'rgba(255,255,255,0.4)',
                  fontSize: 13, padding: '11px 16px', cursor: 'pointer',
                }}
              >
                New
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Activity Item ──────────────────────────────────────────────────────────────
function ActivityItem({ item }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      {item.unread && (
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#8b5cf6', marginTop: 5, flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0, paddingLeft: item.unread ? 0 : 15 }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', lineHeight: 1.4 }}>
          {item.message.slice(0, 90)}{item.message.length > 90 ? '…' : ''}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', marginTop: 2 }}>{item.timeAgo}</div>
      </div>
    </div>
  );
}

// ── Situation Report Panel ─────────────────────────────────────────────────────
function SituationReportPanel({ report, loading }) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 16, padding: '18px 22px',
      }}>
        <div className="skeleton h-4 w-40 mb-4 rounded" />
        <div style={{ display: 'flex', gap: 10 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton h-16 rounded" style={{ flex: 1 }} />
          ))}
        </div>
      </div>
    );
  }

  const { urgent = [], watch = [], winners = [], sentinelActions = [], hasRealData } = report ?? {};
  const totalItems = urgent.length + watch.length + winners.length + sentinelActions.length;

  if (!report) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 16, padding: '22px 24px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>No situation report yet</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>Refreshes at 5am daily once campaigns have metric data</div>
      </div>
    );
  }

  const severityColor = (s) => s === 'critical' ? '#ef4444' : '#f59e0b';

  return (
    <div style={{
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 16, padding: '18px 22px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Bell size={14} color="#f59e0b" />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>
          Morning Briefing
        </span>
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: '0.07em',
          background: 'rgba(139,92,246,0.15)', color: '#a78bfa',
          padding: '2px 8px', borderRadius: 20,
        }}>
          {totalItems} ITEMS
        </span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>
          {new Date(report.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>

        {/* URGENT */}
        {urgent.length > 0 && (
          <div style={{
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 12, padding: '14px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <ShieldAlert size={12} color="#ef4444" />
              <span style={{ fontSize: 10, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Urgent — {urgent.length}
              </span>
            </div>
            {urgent.slice(0, 3).map((item, i) => (
              <div
                key={i}
                onClick={() => navigate(item.actionLink)}
                style={{
                  marginTop: i > 0 ? 8 : 0, cursor: 'pointer',
                  borderTop: i > 0 ? '1px solid rgba(239,68,68,0.1)' : 'none',
                  paddingTop: i > 0 ? 8 : 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.82)' }}>
                    {item.campaign}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: severityColor(item.severity) }}>
                    {item.changePct}%
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', marginTop: 2 }}>
                  {item.metric} drop · {item.action}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* WINNERS */}
        {winners.length > 0 && (
          <div style={{
            background: 'rgba(16,185,129,0.06)',
            border: '1px solid rgba(16,185,129,0.2)',
            borderRadius: 12, padding: '14px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Award size={12} color="#10b981" />
              <span style={{ fontSize: 10, fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Scale Ready — {winners.length}
              </span>
            </div>
            {winners.slice(0, 3).map((w, i) => (
              <div
                key={i}
                onClick={() => navigate('/scaling')}
                style={{
                  marginTop: i > 0 ? 8 : 0, cursor: 'pointer',
                  borderTop: i > 0 ? '1px solid rgba(16,185,129,0.1)' : 'none',
                  paddingTop: i > 0 ? 8 : 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.82)' }}>
                    {w.campaign}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981' }}>
                    {w.score}/100
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', marginTop: 2 }}>
                  {w.verdict}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* WATCH (alerts) */}
        {watch.length > 0 && (
          <div style={{
            background: 'rgba(245,158,11,0.06)',
            border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: 12, padding: '14px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Eye size={12} color="#f59e0b" />
              <span style={{ fontSize: 10, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Watch — {watch.length}
              </span>
            </div>
            {watch.slice(0, 3).map((a, i) => (
              <div
                key={i}
                onClick={() => navigate('/budget-ai')}
                style={{
                  marginTop: i > 0 ? 8 : 0, cursor: 'pointer',
                  borderTop: i > 0 ? '1px solid rgba(245,158,11,0.1)' : 'none',
                  paddingTop: i > 0 ? 8 : 0,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.82)' }}>
                  {a.campaign}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', marginTop: 2 }}>
                  {a.action}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SENTINEL ACTIONS */}
        {sentinelActions.length > 0 && (
          <div style={{
            background: 'rgba(139,92,246,0.06)',
            border: '1px solid rgba(139,92,246,0.2)',
            borderRadius: 12, padding: '14px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Zap size={12} color="#a78bfa" />
              <span style={{ fontSize: 10, fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Auto-Actions — {sentinelActions.length}
              </span>
            </div>
            {sentinelActions.slice(0, 3).map((a, i) => (
              <div key={i} style={{
                marginTop: i > 0 ? 8 : 0,
                borderTop: i > 0 ? '1px solid rgba(139,92,246,0.1)' : 'none',
                paddingTop: i > 0 ? 8 : 0,
              }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', lineHeight: 1.4 }}>
                  {a.message?.slice(0, 80)}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', marginTop: 2 }}>
                  {new Date(a.takenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [showReport, setShowReport] = useState(false);

  // ── 1. Existing metrics (ads, keywords, competitors, alerts, activity feed)
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn: () => api.get('/dashboard/metrics').then(r => r.data.data),
    refetchInterval: 60_000,
  });

  // ── 2. Health score (real ROAS-weighted computation + AI verdict)
  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['dashboard', 'health-score'],
    queryFn: () => api.get('/dashboard/health-score').then(r => r.data.data ?? r.data),
    refetchInterval: 300_000,
    retry: 1,
  });

  // ── 3. AI Recommendations
  const { data: recsData, isLoading: recsLoading } = useQuery({
    queryKey: ['dashboard', 'recommendations'],
    queryFn: () => api.get('/dashboard/recommendations').then(r => r.data.data ?? r.data),
    refetchInterval: 900_000,
    retry: 1,
  });

  // ── 4. Situation Report (morning briefing)
  const { data: situationData, isLoading: situationLoading } = useQuery({
    queryKey: ['analytics', 'situation-report'],
    queryFn: () => api.get('/analytics/situation-report').then(r => r.data.data ?? r.data),
    refetchInterval: 300_000,
    retry: 1,
  });

  const stats        = metrics?.stats ?? {};
  const feed         = metrics?.activityFeed ?? [];
  const trends       = metrics?.keywordTrends ?? [];

  const score        = healthData?.score ?? metrics?.health?.score ?? 0;
  const healthLabel  = healthData?.label ?? metrics?.health?.label ?? '';
  const aiVerdict    = healthData?.aiVerdict;
  const kpiMetrics   = healthData?.metrics ?? {};

  const recommendations = recsData?.recommendations ?? [];

  const healthColor  = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  const anyLoading   = metricsLoading || healthLoading;

  // Generate dummy sparklines from existing delta data (7 pts trending toward current)
  const mkSparkline = (base, delta) => {
    const prev = Math.max(0, base - Math.abs(delta || 0));
    return [prev * 0.8, prev * 0.9, prev, prev * 1.0, base * 0.95, base * 0.98, base];
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.9)', margin: 0 }}>
            Situation Report
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · What changed overnight, what to act on
          </p>
        </div>
        <button
          onClick={() => setShowReport(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'rgba(139,92,246,0.12)',
            border: '1px solid rgba(139,92,246,0.25)',
            borderRadius: 10, color: '#a78bfa',
            fontSize: 13, fontWeight: 600, padding: '9px 16px',
            cursor: 'pointer',
          }}
        >
          <FileText size={14} />
          Generate Report
        </button>
      </div>

      {/* ── Zone 1: Situation Report (Morning Briefing) ───────────────────────── */}
      <SituationReportPanel report={situationData} loading={situationLoading} />

      {/* ── Zone 2: Health Score Banner ───────────────────────────────────────── */}
      <div style={{
        background: 'rgba(255,255,255,0.025)',
        border: `1px solid ${healthColor}30`,
        borderRadius: 16, padding: '22px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
      }}>
        {/* Left: ring + score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HealthRing score={score} size={80} />
            <div style={{ position: 'absolute', textAlign: 'center' }}>
              {anyLoading ? (
                <Loader2 size={16} color="rgba(255,255,255,0.3)" className="animate-spin" />
              ) : (
                <>
                  <div style={{ fontSize: 20, fontWeight: 800, color: healthColor, lineHeight: 1 }}>
                    <CountUp target={score} />
                  </div>
                </>
              )}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              Account Health
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'rgba(255,255,255,0.88)' }}>
              {anyLoading ? 'Calculating…' : healthLabel}
            </div>
            {aiVerdict?.verdict && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.48)', marginTop: 5, maxWidth: 400, lineHeight: 1.5 }}>
                {aiVerdict.verdict}
              </div>
            )}
          </div>
        </div>

        {/* Right: quick metrics */}
        <div style={{ display: 'flex', gap: 28, flexShrink: 0 }}>
          {[
            { label: 'ROAS', value: kpiMetrics.avgROAS ? `${kpiMetrics.avgROAS}x` : '—' },
            { label: 'CTR', value: kpiMetrics.overallCTR ? `${kpiMetrics.overallCTR}%` : '—' },
            { label: 'Active', value: kpiMetrics.activeCampaigns ?? '—' },
          ].map(m => (
            <div key={m.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{m.value}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 2 }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Zone 2: KPI Cards ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <KPICard
          label="Ads Created"
          value={stats.adsCreated?.value ?? 0}
          delta={stats.adsCreated?.delta}
          deltaLabel="this week"
          positive
          sparkPoints={mkSparkline(stats.adsCreated?.value || 0, stats.adsCreated?.delta || 0)}
          icon={Zap}
          iconColor="#8b5cf6"
          href="/ads"
          loading={metricsLoading}
        />
        <KPICard
          label="Keywords"
          value={stats.keywords?.value ?? 0}
          delta={stats.keywords?.delta}
          deltaLabel="rising"
          positive
          sparkPoints={mkSparkline(stats.keywords?.value || 0, stats.keywords?.delta || 0)}
          icon={TrendingUp}
          iconColor="#10b981"
          href="/research"
          loading={metricsLoading}
        />
        <KPICard
          label="Competitors"
          value={stats.competitors?.value ?? 0}
          delta={stats.competitors?.delta}
          deltaLabel="new"
          positive
          sparkPoints={mkSparkline(stats.competitors?.value || 0, stats.competitors?.delta || 0)}
          icon={Target}
          iconColor="#f59e0b"
          href="/research"
          loading={metricsLoading}
        />
        <KPICard
          label="Unresolved Alerts"
          value={stats.alerts?.urgent ?? 0}
          delta={stats.alerts?.urgent > 0 ? stats.alerts.urgent : undefined}
          deltaLabel="need attention"
          positive={false}
          sparkPoints={mkSparkline(stats.alerts?.urgent || 0, 0)}
          icon={Bell}
          iconColor="#ef4444"
          href="/budget-ai"
          loading={metricsLoading}
        />
      </div>

      {/* ── Zone 3: AI Recommendations + Activity ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Recommendations */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Sparkles size={14} color="#a78bfa" />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>
              AI Recommendations
            </span>
          </div>

          {recsLoading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} style={{ height: 84, borderRadius: 12, background: 'rgba(255,255,255,0.04)', marginBottom: 10 }} className="animate-pulse" />
            ))
          ) : recommendations.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '36px 20px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12,
            }}>
              <CheckCircle size={24} color="#10b981" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>All clear</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
                No urgent actions needed. Keep it up.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recommendations.slice(0, 4).map((rec, i) => (
                <RecommendationCard key={i} rec={rec} />
              ))}
            </div>
          )}
        </div>

        {/* Activity Timeline */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={14} color="rgba(255,255,255,0.4)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>Recent Activity</span>
            </div>
            <Link to="/notifications" style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>
              View all →
            </Link>
          </div>

          {metricsLoading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} style={{ height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.04)', marginBottom: 8 }} className="animate-pulse" />
            ))
          ) : feed.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '36px 20px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12,
            }}>
              <Activity size={24} color="rgba(255,255,255,0.2)" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>No activity yet</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
                Start generating ads or running audits to see activity here.
              </div>
            </div>
          ) : (
            feed.slice(0, 6).map((item, i) => <ActivityItem key={i} item={item} />)
          )}

          {/* Keyword trends (if any) */}
          {trends.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Trending Keywords
              </div>
              {trends.map((kw, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <TrendingUp size={11} color="#10b981" />
                  <span style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.72)' }}>{kw.keyword}</span>
                  <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>+{kw.change}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Zone 4: Quick Actions ─────────────────────────────────────────────── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
          Quick Actions
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <QuickActionCard
            label="Run SEO Audit"
            description="Scan a site for technical issues and score it"
            gradient="linear-gradient(135deg, #0ea5e9, #06b6d4)"
            href="/seo"
          />
          <QuickActionCard
            label="Generate Ads"
            description="Create 4-angle ad variations with AI"
            gradient="linear-gradient(135deg, #8b5cf6, #ec4899)"
            href="/ads"
          />
          <QuickActionCard
            label="Scan Budget Health"
            description="Detect campaigns losing money in real time"
            gradient="linear-gradient(135deg, #f97316, #ef4444)"
            href="/budget-ai"
          />
        </div>
      </div>

      {/* Demo mode notice */}
      {metrics?.demoMode && (
        <div style={{
          background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)',
          borderRadius: 8, padding: '10px 16px', fontSize: 12, color: 'rgba(245,158,11,0.8)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertCircle size={13} />
          Showing estimated data. Connect your ad account to see real metrics.
          <Link to="/settings" style={{ color: '#f59e0b', marginLeft: 4 }}>Connect now</Link>
        </div>
      )}

      {/* Report modal */}
      {showReport && <ReportModal onClose={() => setShowReport(false)} />}
    </div>
  );
}
