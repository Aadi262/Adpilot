import { COLOR_MAP } from '../../config/features';

/**
 * FeatureHeader — premium branded page header for all 6 AI feature pages.
 *
 * Props:
 *   codename    — e.g. "Sentinel"
 *   label       — e.g. "Budget Guardian"
 *   description — one-liner description
 *   color       — one of the 6 feature colors
 *   icon        — Lucide icon component
 *   badge       — optional badge text: "LIVE" | "AI" | "BETA"
 *   stats       — array of { label, value } shown in stats row
 *   actions     — array of { label, onClick, variant: 'primary'|'secondary'|'ghost' }
 *   status      — optional status text shown next to badge (e.g. "Scanning…")
 */
export default function FeatureHeader({
  codename,
  label,
  description,
  color = 'blue',
  icon: Icon,
  badge,
  stats = [],
  actions = [],
  status,
}) {
  // Static class lookup — Tailwind JIT requires literal strings
  const GLOW = {
    red:    'from-red-600/20    via-red-600/5    to-transparent',
    amber:  'from-amber-600/20  via-amber-600/5  to-transparent',
    purple: 'from-purple-600/20 via-purple-600/5 to-transparent',
    cyan:   'from-cyan-600/20   via-cyan-600/5   to-transparent',
    orange: 'from-orange-600/20 via-orange-600/5 to-transparent',
    green:  'from-green-600/20  via-green-600/5  to-transparent',
    blue:   'from-blue-600/20   via-blue-600/5   to-transparent',
  };

  const ICON_RING = {
    red:    'ring-red-500/30',
    amber:  'ring-amber-500/30',
    purple: 'ring-purple-500/30',
    cyan:   'ring-cyan-500/30',
    orange: 'ring-orange-500/30',
    green:  'ring-green-500/30',
    blue:   'ring-blue-500/30',
  };

  const BADGE_VARIANT = {
    red:    'bg-red-500/15    text-red-400    border-red-500/25',
    amber:  'bg-amber-500/15  text-amber-400  border-amber-500/25',
    purple: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
    cyan:   'bg-cyan-500/15   text-cyan-400   border-cyan-500/25',
    orange: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
    green:  'bg-green-500/15  text-green-400  border-green-500/25',
    blue:   'bg-blue-500/15   text-blue-400   border-blue-500/25',
  };

  const c = COLOR_MAP[color] ?? COLOR_MAP.blue ?? {};
  const glow    = GLOW[color]    ?? GLOW.blue;
  const iconRing = ICON_RING[color] ?? ICON_RING.blue;
  const badgeVariant = BADGE_VARIANT[color] ?? BADGE_VARIANT.blue;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-bg-card mb-6">
      {/* Gradient glow background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${glow} pointer-events-none`} />

      <div className="relative px-6 pt-6 pb-5">
        {/* Top row: icon + text + badge + actions */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Feature icon with glow ring */}
            {Icon && (
              <div className={`w-14 h-14 rounded-2xl ${c.iconBg ?? 'bg-blue-500/20'} flex items-center justify-center shrink-0 ring-2 ${iconRing}`}>
                <Icon className={`w-7 h-7 ${c.text ?? 'text-blue-400'}`} />
              </div>
            )}

            <div>
              {/* Codename + badge row */}
              <div className="flex items-center gap-2.5 mb-1">
                <h1 className="text-xl font-bold text-text-primary tracking-tight">
                  {codename}
                </h1>
                {badge && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeVariant}`}>
                    {badge === 'LIVE' ? (
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse inline-block" />
                        LIVE
                      </span>
                    ) : badge}
                  </span>
                )}
                {status && (
                  <span className="text-xs text-text-secondary">{status}</span>
                )}
              </div>
              {/* Label + description */}
              <p className={`text-sm font-semibold ${c.text ?? 'text-blue-400'}`}>{label}</p>
              {description && (
                <p className="text-xs text-text-secondary mt-1 max-w-xl leading-relaxed">{description}</p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          {actions.length > 0 && (
            <div className="flex items-center gap-2 sm:shrink-0">
              {actions.map((action, i) => (
                <button
                  key={i}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={
                    action.variant === 'primary'
                      ? 'btn-primary text-sm flex items-center gap-2'
                      : action.variant === 'ghost'
                      ? 'btn-ghost text-sm flex items-center gap-2'
                      : 'btn-secondary text-sm flex items-center gap-2'
                  }
                >
                  {action.icon && <action.icon className="w-4 h-4" />}
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stats row */}
        {stats.length > 0 && (
          <div className="flex items-center gap-6 mt-5 pt-4 border-t border-border/50 flex-wrap">
            {stats.map((stat, i) => (
              <div key={i} className="flex items-baseline gap-1.5">
                <span className={`text-lg font-bold ${c.text ?? 'text-blue-400'}`}>{stat.value}</span>
                <span className="text-xs text-text-secondary">{stat.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
