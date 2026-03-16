import logoUrl from '../../assets/adpilot-logo.png';

/**
 * AdpilotLogo — renders the brand mark in three variants:
 *   icon     — just the logo image (default, for collapsed sidebar / favicon contexts)
 *   wordmark — icon + "AdPilot" text side by side (for login, onboarding, etc.)
 *   full     — icon + "AdPilot" + subtitle stacked (for main sidebar header)
 */
export default function AdpilotLogo({ variant = 'icon', size = 32, className = '' }) {
  const img = (
    <img
      src={logoUrl}
      alt="AdPilot"
      width={size}
      height={size}
      className="shrink-0"
      style={{ objectFit: 'contain', display: 'block' }}
    />
  );

  if (variant === 'icon') {
    return <span className={className}>{img}</span>;
  }

  if (variant === 'wordmark') {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        {img}
        <span className="font-bold text-text-primary tracking-tight" style={{ fontSize: size * 0.5 }}>
          Ad<span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Pilot</span>
        </span>
      </div>
    );
  }

  // variant === 'full'
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {img}
      <div>
        <span className="block font-bold text-sm text-text-primary tracking-tight leading-none">
          Ad<span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Pilot</span>
        </span>
        <span className="block text-[10px] text-text-secondary leading-none mt-0.5">AI Command Center</span>
      </div>
    </div>
  );
}
