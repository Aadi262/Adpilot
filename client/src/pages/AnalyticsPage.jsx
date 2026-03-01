import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, Zap, DollarSign, TrendingUp, Download,
  MousePointerClick, Eye, BarChart3,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from 'recharts';
import api from '../lib/api';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';

const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];

// Deterministic mock time-series (keyed by range)
const MOCK_SERIES = {
  '7d': [
    { label: 'Mon', spend: 620,  roas: 3.4, clicks: 1820 },
    { label: 'Tue', spend: 580,  roas: 2.9, clicks: 1540 },
    { label: 'Wed', spend: 710,  roas: 3.8, clicks: 2100 },
    { label: 'Thu', spend: 640,  roas: 3.1, clicks: 1740 },
    { label: 'Fri', spend: 800,  roas: 4.0, clicks: 2380 },
    { label: 'Sat', spend: 520,  roas: 3.2, clicks: 1320 },
    { label: 'Sun', spend: 480,  roas: 2.8, clicks: 1180 },
  ],
  '30d': [
    { label: 'W1', spend: 1200, roas: 3.1, clicks: 4200 },
    { label: 'W2', spend: 2100, roas: 3.5, clicks: 6800 },
    { label: 'W3', spend: 1800, roas: 2.9, clicks: 5400 },
    { label: 'W4', spend: 3200, roas: 4.1, clicks: 9100 },
  ],
  '90d': [
    { label: 'Sep', spend: 4200, roas: 3.0, clicks: 12000 },
    { label: 'Oct', spend: 5100, roas: 3.5, clicks: 15000 },
    { label: 'Nov', spend: 4800, roas: 2.9, clicks: 13500 },
    { label: 'Dec', spend: 7200, roas: 4.1, clicks: 21000 },
    { label: 'Jan', spend: 6700, roas: 3.8, clicks: 19000 },
    { label: 'Feb', spend: 8800, roas: 3.7, clicks: 24500 },
  ],
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-text-secondary mb-1 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}:{' '}
          {p.dataKey === 'spend' ? '$' : ''}
          {p.value.toLocaleString()}
          {p.dataKey === 'roas' ? 'x' : ''}
        </p>
      ))}
    </div>
  );
};

function exportCSV(campaigns) {
  const header = ['Campaign', 'Platform', 'Status', 'Spend', 'ROAS', 'Clicks', 'Impressions'];
  const rows = (campaigns ?? []).map((c) => [
    `"${c.name}"`, c.platform, c.status,
    c.spend, c.roas, c.clicks, c.impressions,
  ]);
  const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `analytics-${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

export default function AnalyticsPage() {
  const [range, setRange] = useState('30d');

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['analytics', 'overview', range],
    queryFn: () => api.get(`/analytics/overview?range=${range}`).then((r) => r.data.data),
  });

  const { data: campaigns, isLoading: loadingCampaigns } = useQuery({
    queryKey: ['analytics', 'campaigns'],
    queryFn: () => api.get('/analytics/campaigns').then((r) => r.data.data.campaigns),
  });

  const seriesData = MOCK_SERIES[range] ?? MOCK_SERIES['30d'];

  // Platform pie data
  const platformCounts = (campaigns || []).reduce((acc, c) => {
    acc[c.platform] = (acc[c.platform] || 0) + 1;
    return acc;
  }, {});
  const pieData = Object.entries(platformCounts).map(([name, value]) => ({ name, value }));

  // Top 5 campaigns by spend for bar chart
  const barData = [...(campaigns || [])]
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 5)
    .map((c) => ({ name: c.name.length > 14 ? c.name.slice(0, 14) + '…' : c.name, clicks: c.clicks }));

  const isEmpty = !loadingOverview && (overview?.totalCampaigns ?? 0) === 0;

  return (
    <div className="space-y-6">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Analytics</h1>
          <p className="text-sm text-text-secondary mt-0.5">Deep dive into your campaign performance</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-bg-card border border-border rounded-lg overflow-hidden text-xs">
            {['7d', '30d', '90d'].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 font-medium transition-colors ${range === r ? 'bg-accent-blue/20 text-accent-blue' : 'text-text-secondary hover:text-text-primary'}`}
              >
                {r === '7d' ? '7 days' : r === '30d' ? '30 days' : '90 days'}
              </button>
            ))}
          </div>
          <button
            onClick={() => exportCSV(campaigns)}
            disabled={!campaigns?.length}
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            <Download className="w-4 h-4" />Export CSV
          </button>
        </div>
      </div>

      {/* ── 5 Metric Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        {loadingOverview
          ? [...Array(5)].map((_, i) => <div key={i} className="skeleton h-28 rounded-xl" />)
          : (
            <>
              <StatCard icon={LayoutDashboard} label="Total Campaigns"  value={overview?.totalCampaigns  ?? 0} change={12} iconColor="text-accent-blue"   iconBg="bg-accent-blue/10" />
              <StatCard icon={Zap}             label="Active"           value={overview?.activeCampaigns ?? 0} change={5}  iconColor="text-accent-green"  iconBg="bg-accent-green/10" />
              <StatCard icon={DollarSign}      label="Total Spend"      value={overview?.totalAdSpend    ?? 0} change={-3} prefix="$" iconColor="text-accent-purple" iconBg="bg-accent-purple/10" />
              <StatCard icon={TrendingUp}      label="Avg ROAS"         value={overview?.avgROAS         ?? 0} change={8}  suffix="x" iconColor="text-orange-400"  iconBg="bg-orange-400/10" />
              <StatCard icon={MousePointerClick} label="Total Clicks"   value={overview?.totalClicks     ?? 0} change={15} iconColor="text-cyan-400"     iconBg="bg-cyan-400/10" />
            </>
          )}
      </div>

      {isEmpty ? (
        <div className="card py-20 text-center">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 text-text-secondary opacity-30" />
          <p className="font-semibold text-text-primary">No data yet</p>
          <p className="text-sm text-text-secondary mt-1">Create campaigns to see analytics</p>
        </div>
      ) : (
        <>
          {/* ── Charts Row 1: Line + Bar ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Spend & ROAS over time */}
            <div className="card">
              <h3 className="text-sm font-semibold text-text-primary mb-4">Spend &amp; ROAS over Time</h3>
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={seriesData} margin={{ left: -20, right: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1A1E2E" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#8892A8', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left"  tick={{ fill: '#8892A8', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: '#8892A8', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line yAxisId="left"  type="monotone" dataKey="spend" name="Spend" stroke="#3B82F6" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="roas"  name="ROAS"  stroke="#10B981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Clicks by campaign (bar) */}
            <div className="card">
              <h3 className="text-sm font-semibold text-text-primary mb-4">Clicks by Campaign</h3>
              {loadingCampaigns ? (
                <div className="skeleton h-52 rounded-lg" />
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1A1E2E" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#8892A8', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#8892A8', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1A1E2E' }} />
                    <Bar dataKey="clicks" name="Clicks" radius={[4, 4, 0, 0]}>
                      {barData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ── Charts Row 2: Pie + Table ────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Platform distribution pie */}
            <div className="card">
              <h3 className="text-sm font-semibold text-text-primary mb-4">By Platform</h3>
              {loadingCampaigns ? (
                <div className="skeleton h-52 rounded-lg" />
              ) : pieData.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-text-secondary text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#0F1219', border: '1px solid #1A1E2E', borderRadius: 8, fontSize: 12 }}
                      itemStyle={{ color: '#E8ECF4' }}
                    />
                    <Legend formatter={(val) => <span className="text-xs text-text-secondary capitalize">{val}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Performance table */}
            <div className="lg:col-span-2 card p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="text-sm font-semibold text-text-primary">Campaign Performance</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-bg-secondary/30">
                      {['Campaign', 'Platform', 'Status', 'Spend', 'ROAS', 'Clicks'].map((h) => (
                        <th key={h} className="text-left text-text-secondary font-medium px-4 py-3 whitespace-nowrap text-xs">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loadingCampaigns
                      ? [...Array(4)].map((_, i) => (
                          <tr key={i}>
                            {[...Array(6)].map((__, j) => (
                              <td key={j} className="px-4 py-3">
                                <div className="skeleton h-4 rounded w-16" />
                              </td>
                            ))}
                          </tr>
                        ))
                      : (campaigns || []).map((c) => (
                          <tr key={c.id} className="hover:bg-bg-secondary/30 transition-colors">
                            <td className="px-4 py-3 font-medium text-text-primary max-w-[140px] truncate text-xs">{c.name}</td>
                            <td className="px-4 py-3"><Badge status={c.platform} /></td>
                            <td className="px-4 py-3"><Badge status={c.status} showDot /></td>
                            <td className="px-4 py-3 text-text-secondary text-xs">${c.spend.toLocaleString()}</td>
                            <td className="px-4 py-3 text-text-secondary text-xs">{c.roas > 0 ? `${c.roas}x` : '—'}</td>
                            <td className="px-4 py-3 text-text-secondary text-xs">{c.clicks.toLocaleString()}</td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
