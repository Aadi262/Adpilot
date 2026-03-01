import { useQuery } from '@tanstack/react-query';
import {
  Zap, Shield, DollarSign, AlertTriangle,
  Search, Wand2, TrendingUp, ArrowRight,
  Activity, CheckCircle2, Clock, PauseCircle,
  Bell, Lock,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import Badge from '../components/ui/Badge';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const secs = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (secs < 60)    return 'just now';
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

const STATUS_ICON = {
  active:  <CheckCircle2 className="w-4 h-4 text-accent-green" />,
  paused:  <PauseCircle  className="w-4 h-4 text-yellow-400" />,
  draft:   <Clock        className="w-4 h-4 text-text-secondary" />,
};

const NOTIF_TYPE_COLORS = {
  rule_triggered: 'bg-yellow-500/15 text-yellow-400',
  audit_complete: 'bg-green-500/15  text-green-400',
  keyword_alert:  'bg-blue-500/15   text-blue-400',
};

// ─── Live Status Card ─────────────────────────────────────────────────────────
function StatusCard({ icon: Icon, iconBg, iconColor, label, value, sub, pulse }) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center shrink-0 relative`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
        {pulse && (
          <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-accent-green">
            <span className="absolute inset-0 rounded-full bg-accent-green animate-ping opacity-75" />
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-text-secondary font-medium">{label}</p>
        <p className="text-2xl font-bold text-text-primary mt-0.5 leading-none">{value}</p>
        {sub && <p className="text-xs text-text-secondary mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Quick Action Card ────────────────────────────────────────────────────────
function ActionCard({ icon: Icon, iconBg, iconColor, title, desc, to, comingSoon, onClick }) {
  const navigate = useNavigate();
  const handleClick = () => {
    if (onClick) { onClick(); return; }
    if (!comingSoon) navigate(to);
  };

  return (
    <button
      onClick={handleClick}
      disabled={comingSoon}
      className="card text-left w-full group hover:border-accent-blue/40 hover:shadow-lg hover:shadow-accent-blue/5 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        {comingSoon ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
            SOON
          </span>
        ) : (
          <ArrowRight className="w-4 h-4 text-text-secondary group-hover:text-accent-blue group-hover:translate-x-0.5 transition-all" />
        )}
      </div>
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      <p className="text-xs text-text-secondary mt-1 leading-relaxed">{desc}</p>
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => api.get('/analytics/overview').then((r) => r.data.data),
  });

  const { data: campaigns, isLoading: loadingCampaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/campaigns').then((r) => r.data.data.campaigns),
  });

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then((r) => r.data.data),
    refetchInterval: 30_000,
  });

  const { data: anomalyData } = useQuery({
    queryKey: ['analytics', 'anomalies'],
    queryFn: () => api.get('/analytics/anomalies').then((r) => r.data.data),
  });

  const { data: seoAudits } = useQuery({
    queryKey: ['seo', 'audits', 'latest'],
    queryFn: () => api.get('/seo/audits?limit=1').then((r) => r.data.data),
  });

  const notifications = notifData?.notifications ?? [];
  const alertCount    = (anomalyData?.anomalies ?? []).length;
  const latestAudit   = seoAudits?.audits?.[0] ?? seoAudits?.[0];
  const seoScore      = latestAudit?.overallScore ?? null;
  const activeCampaigns = overview?.activeCampaigns ?? 0;
  const todaySpend    = overview?.totalAdSpend ? (overview.totalAdSpend * 0.08).toFixed(0) : 0;

  const isEmpty = !loadingOverview && (overview?.totalCampaigns ?? 0) === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-accent-blue/10 flex items-center justify-center mb-5">
          <Zap className="w-8 h-8 text-accent-blue" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">Welcome to AdPilot</h1>
        <p className="text-text-secondary text-sm mb-8 max-w-sm">
          Your AI-powered ad and SEO automation platform is ready. Create your first campaign to get started.
        </p>
        <div className="flex gap-3">
          <button onClick={() => navigate('/campaigns')} className="btn-primary flex items-center gap-2">
            <Zap className="w-4 h-4" />Create Campaign
          </button>
          <button onClick={() => navigate('/seo')} className="btn-secondary flex items-center gap-2">
            <Shield className="w-4 h-4" />Run SEO Audit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-text-primary">Command Center</h1>
        <p className="text-sm text-text-secondary mt-0.5">Live status across your campaigns and SEO</p>
      </div>

      {/* ── TOP ROW: Live Status Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {loadingOverview ? (
          [...Array(4)].map((_, i) => <div key={i} className="skeleton h-28 rounded-xl" />)
        ) : (
          <>
            <StatusCard
              icon={Activity}
              iconBg="bg-accent-green/10"
              iconColor="text-accent-green"
              label="Active Campaigns"
              value={activeCampaigns}
              sub={`of ${overview?.totalCampaigns ?? 0} total`}
              pulse={activeCampaigns > 0}
            />
            <StatusCard
              icon={DollarSign}
              iconBg="bg-accent-blue/10"
              iconColor="text-accent-blue"
              label="Spend Today (est.)"
              value={`$${Number(todaySpend).toLocaleString()}`}
              sub={`$${(overview?.totalAdSpend ?? 0).toLocaleString()} lifetime`}
            />
            <StatusCard
              icon={AlertTriangle}
              iconBg={alertCount > 0 ? 'bg-red-500/10' : 'bg-bg-card'}
              iconColor={alertCount > 0 ? 'text-red-400' : 'text-text-secondary'}
              label="Active Alerts"
              value={alertCount}
              sub={alertCount > 0 ? 'Anomalies detected' : 'All systems normal'}
              pulse={alertCount > 0}
            />
            <StatusCard
              icon={Shield}
              iconBg="bg-accent-purple/10"
              iconColor="text-accent-purple"
              label="SEO Score"
              value={seoScore !== null ? seoScore : '—'}
              sub={seoScore !== null ? `Grade ${latestAudit?.grade ?? '?'}` : 'No audit yet'}
            />
          </>
        )}
      </div>

      {/* ── MIDDLE ROW: Quick Actions ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ActionCard
          icon={Shield}
          iconBg="bg-accent-purple/10"
          iconColor="text-accent-purple"
          title="Run SEO Audit"
          desc="Crawl your site, detect issues, and get an AI-powered executive summary."
          to="/seo"
        />
        <ActionCard
          icon={Wand2}
          iconBg="bg-accent-blue/10"
          iconColor="text-accent-blue"
          title="Generate Ads"
          desc="Use AI to generate high-quality ad variations for Meta, Google, and more."
          to="/ads"
        />
        <ActionCard
          icon={Lock}
          iconBg="bg-yellow-500/10"
          iconColor="text-yellow-400"
          title="Budget Protection AI"
          desc="Automatically pause campaigns that exceed CPA or ROAS thresholds."
          to="/budget-ai"
          comingSoon
        />
      </div>

      {/* ── BOTTOM ROW: Activity + Campaign Health ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Recent Activity (60%) */}
        <div className="lg:col-span-3 card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-text-secondary" />
              <h2 className="text-sm font-semibold text-text-primary">Recent Activity</h2>
            </div>
            <Link to="/notifications" className="text-xs text-accent-blue hover:underline">View all →</Link>
          </div>

          <div className="divide-y divide-border">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-text-secondary text-sm">
                <Bell className="w-7 h-7 mx-auto mb-2 opacity-30" />
                No activity yet
              </div>
            ) : (
              notifications.slice(0, 8).map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-5 py-3.5 hover:bg-white/2 transition-colors ${n.status === 'pending' ? 'bg-white/2' : ''}`}
                >
                  {n.status === 'pending' && (
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent-blue shrink-0" />
                  )}
                  <div className={n.status !== 'pending' ? 'ml-4' : ''}>
                    <p className="text-xs text-text-primary leading-snug">{n.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {n.type && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${NOTIF_TYPE_COLORS[n.type] ?? 'bg-border text-text-secondary'}`}>
                          {n.type.replace(/_/g, ' ')}
                        </span>
                      )}
                      <span className="text-[10px] text-text-secondary">{timeAgo(n.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Campaign Health (40%) */}
        <div className="lg:col-span-2 card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-text-secondary" />
              <h2 className="text-sm font-semibold text-text-primary">Campaign Health</h2>
            </div>
            <Link to="/campaigns" className="text-xs text-accent-blue hover:underline">Manage →</Link>
          </div>

          <div className="divide-y divide-border">
            {loadingCampaigns ? (
              <div className="p-5 space-y-3">
                {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-10 rounded-lg" />)}
              </div>
            ) : (campaigns ?? []).length === 0 ? (
              <div className="py-10 text-center text-text-secondary text-sm">
                <Zap className="w-7 h-7 mx-auto mb-2 opacity-30" />
                No campaigns yet
              </div>
            ) : (
              (campaigns ?? []).slice(0, 5).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/2 transition-colors cursor-pointer"
                  onClick={() => navigate('/campaigns')}
                >
                  <div className="shrink-0">
                    {STATUS_ICON[c.status] ?? STATUS_ICON.draft}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text-primary truncate">{c.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge status={c.platform} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-text-secondary">
                      ${Number(c.budget ?? 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {(campaigns ?? []).length > 5 && (
            <div className="px-5 py-3 border-t border-border">
              <button onClick={() => navigate('/campaigns')} className="text-xs text-accent-blue hover:underline">
                +{campaigns.length - 5} more campaigns
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
