import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Megaphone, BarChart2,
  Wand2, ShieldAlert, TrendingUp,
  Shield, Search, Crosshair,
  Zap, Plug, Users, Settings,
  LogOut, X,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import AdpilotLogo from '../ui/AdpilotLogo';

// ─── Nav structure with Phase K feature identity ────────────────────────────
const NAV_GROUPS = [
  {
    label: null,
    items: [
      { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { path: '/campaigns', icon: Megaphone,       label: 'Campaigns' },
      { path: '/analytics', icon: BarChart2,       label: 'Analytics' },
    ],
  },
  {
    label: 'AI FEATURES',
    items: [
      {
        path: '/ads',       icon: Wand2,      label: 'Forge',
        sublabel: 'Ad Studio',
      },
      {
        path: '/budget-ai', icon: ShieldAlert, label: 'Sentinel',
        sublabel: 'Budget Guardian',
        badge: 'LIVE', badgeColor: 'red', liveDot: true,
      },
      {
        path: '/scaling',   icon: TrendingUp,  label: 'Apex',
        sublabel: 'Scale Predictor',
        badge: 'AI', badgeColor: 'amber',
      },
    ],
  },
  {
    label: 'INTELLIGENCE',
    items: [
      {
        path: '/seo',               icon: Shield,    label: 'Beacon',
        sublabel: 'SEO Intelligence',
      },
      {
        path: '/research',          icon: Search,    label: 'Pulse',
        sublabel: 'Research Hub',
      },
      {
        path: '/competitor-hijack', icon: Crosshair, label: 'Radar',
        sublabel: 'Competitor Intel',
        badge: 'BETA', badgeColor: 'purple',
      },
    ],
  },
  {
    label: 'SETTINGS',
    items: [
      { path: '/rules',        icon: Zap,      label: 'Rules'        },
      { path: '/integrations', icon: Plug,     label: 'Integrations' },
      { path: '/team',         icon: Users,    label: 'Team'         },
      { path: '/settings',     icon: Settings, label: 'Settings'     },
    ],
  },
];

// Static Tailwind badge classes — no template literals (JIT requires literals)
const BADGE_STYLES = {
  red:    'bg-red-500/10    text-red-400    border border-red-500/20',
  amber:  'bg-amber-500/10  text-amber-400  border border-amber-500/20',
  purple: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  blue:   'bg-blue-500/10   text-blue-400   border border-blue-500/20',
  green:  'bg-green-500/10  text-green-400  border border-green-500/20',
};

// Animated live dot for Sentinel
function LiveDot() {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
    </span>
  );
}

export default function Sidebar({ open, onClose }) {
  const { user, team, logout, isDemo } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const showUpgradeBanner = team?.plan === 'starter' || team?.plan === 'free';

  return (
    <>
      {/* Mobile overlay — only below md */}
      {open && (
        <div className="fixed inset-0 bg-black/60 z-20 md:hidden" onClick={onClose} />
      )}

      <aside className={`
        fixed top-0 left-0 h-full z-30 shrink-0 flex flex-col
        w-60 md:w-14 lg:w-60
        bg-bg-secondary border-r border-border
        transition-transform duration-300
        ${open ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static md:z-auto
      `}>
        {/* ── Logo ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 md:px-2 lg:px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5 md:justify-center lg:justify-start w-full">
            {/* Real AdPilot logo — icon only on collapsed md, full wordmark on lg */}
            <AdpilotLogo variant="icon" size={32} className="md:block" />
            <div className="hidden lg:block">
              <span className="font-bold text-sm text-text-primary tracking-tight leading-none">
                Ad<span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Pilot</span>
              </span>
              <span className="block text-[10px] text-text-secondary leading-none mt-0.5">AI Command Center</span>
            </div>
          </div>
          <button onClick={onClose} className="md:hidden text-text-secondary hover:text-text-primary transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Team pill ─────────────────────────────────────────────────── */}
        {team && (
          <div className="hidden lg:block mx-3 mt-3 px-3 py-2 bg-bg-card border border-border rounded-xl">
            <p className="text-[10px] text-text-secondary uppercase tracking-wider font-medium">Workspace</p>
            <p className="text-sm font-semibold text-text-primary truncate leading-tight mt-0.5">{team.name}</p>
            {team.plan && (
              <span className="text-[10px] font-bold text-accent-blue capitalize">{team.plan} plan</span>
            )}
          </div>
        )}

        {/* ── Nav groups ────────────────────────────────────────────────── */}
        <nav className="flex-1 px-3 md:px-1 lg:px-3 py-3 overflow-y-auto space-y-1">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'pt-2' : ''}>
              {group.label && (
                <p className="hidden lg:block px-3 mb-1 text-[9px] font-bold uppercase tracking-widest text-text-secondary/40">
                  {group.label}
                </p>
              )}
              {group.items.map(({ path, icon: Icon, label, sublabel, badge, badgeColor, liveDot }) => (
                <NavLink
                  key={path}
                  to={path}
                  title={label}
                  onClick={() => onClose?.()}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 md:px-2 md:justify-center lg:justify-start lg:px-3 py-2 rounded-xl text-sm font-medium
                     transition-all duration-150 group ${
                      isActive
                        ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'
                    }`
                  }
                >
                  <Icon className="shrink-0 w-[17px] h-[17px]" />
                  <div className="hidden lg:block flex-1 min-w-0">
                    <span className="block truncate leading-tight">{label}</span>
                    {sublabel && (
                      <span className="block text-[10px] text-text-secondary/60 leading-tight font-normal truncate">
                        {sublabel}
                      </span>
                    )}
                  </div>
                  {liveDot && <span className="hidden lg:flex"><LiveDot /></span>}
                  {badge && (
                    <span className={`hidden lg:inline text-[9px] font-bold px-1.5 py-0.5 rounded-full ${BADGE_STYLES[badgeColor] ?? BADGE_STYLES.blue}`}>
                      {badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* ── Upgrade banner ────────────────────────────────────────────── */}
        {showUpgradeBanner && !isDemo && (
          <div className="hidden lg:block mx-3 mb-3 p-3 rounded-xl border border-purple-500/20
                          bg-gradient-to-br from-purple-600/20 via-purple-600/10 to-blue-600/20">
            <p className="text-xs font-semibold text-white/80">Upgrade to Growth</p>
            <p className="text-[11px] text-white/40 mt-0.5 mb-2.5 leading-snug">
              Unlock Sentinel AI + unlimited campaigns
            </p>
            <button
              onClick={() => navigate('/pricing')}
              className="w-full text-xs py-1.5 px-3 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500
                         text-white font-semibold transition-all"
            >
              See Plans →
            </button>
          </div>
        )}

        {/* ── User section ──────────────────────────────────────────────── */}
        <div className="px-4 md:px-2 lg:px-4 py-3 border-t border-border">
          <div className="flex items-center gap-3 md:justify-center lg:justify-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600
                            flex items-center justify-center text-xs font-bold text-white shrink-0">
              {initials}
            </div>
            <div className="hidden lg:block flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{user?.name}</p>
              <p className="text-xs text-text-secondary truncate capitalize">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="hidden lg:block text-text-secondary hover:text-red-400 transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
