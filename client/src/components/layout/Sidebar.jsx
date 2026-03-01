import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Zap,
  Wand2,
  Search,
  Shield,
  Bot,
  Plug,
  BarChart3,
  Users,
  Settings,
  LogOut,
  X,
  ShieldAlert,
  Crosshair,
  TrendingUp,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';

const navItems = [
  { label: 'Dashboard',       icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Campaigns',       icon: Zap,             to: '/campaigns' },
  { label: 'Ad Studio',       icon: Wand2,           to: '/ads' },
  { label: 'Research Hub',    icon: Search,          to: '/research' },
  { label: 'SEO Intelligence',icon: Shield,          to: '/seo' },
  { label: 'Rules',           icon: Bot,             to: '/rules' },
  { label: 'Integrations',    icon: Plug,            to: '/integrations' },
  { label: 'Analytics',       icon: BarChart3,       to: '/analytics' },
  { label: 'Team',            icon: Users,           to: '/team' },
  { label: 'Settings',        icon: Settings,        to: '/settings' },
];

const killerItems = [
  { label: 'Budget AI',        icon: ShieldAlert,  to: '/budget-ai',         badge: 'BETA', badgeClass: 'bg-orange-500/20 text-orange-400' },
  { label: 'Competitor Intel', icon: Crosshair,    to: '/competitor-hijack', badge: 'BETA', badgeClass: 'bg-red-500/20 text-red-400' },
  { label: 'Scale AI',         icon: TrendingUp,   to: '/scaling',           badge: 'BETA', badgeClass: 'bg-green-500/20 text-accent-green' },
];

export default function Sidebar({ open, onClose }) {
  const { user, team, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full z-30 flex flex-col
          w-60 bg-bg-secondary border-r border-border
          transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-text-primary tracking-tight">AdPilot</span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-text-secondary hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Team pill */}
        {team && (
          <div className="mx-4 mt-4 px-3 py-2 bg-bg-card border border-border rounded-lg">
            <p className="text-xs text-text-secondary">Team</p>
            <p className="text-sm font-semibold text-text-primary truncate">{team.name}</p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ label, icon: Icon, to }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => onClose?.()}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'
                }`
              }
            >
              <Icon className="shrink-0 w-[18px] h-[18px]" />
              {label}
            </NavLink>
          ))}

          {/* Killer Features */}
          <div className="pt-3 pb-1">
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-text-secondary/50">AI Features</p>
          </div>
          {killerItems.map(({ label, icon: Icon, to, badge, badgeClass }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => onClose?.()}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'
                }`
              }
            >
              <Icon className="shrink-0 w-[18px] h-[18px]" />
              <span className="flex-1">{label}</span>
              {badge && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${badgeClass}`}>{badge}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="px-4 py-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center text-xs font-bold text-white shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{user?.name}</p>
              <p className="text-xs text-text-secondary truncate capitalize">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="text-text-secondary hover:text-red-400 transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
