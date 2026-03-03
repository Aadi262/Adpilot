export default function MockDataBanner({ message, connectLabel, onConnect }) {
  return (
    <div className="mb-4 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
        <span className="text-xs text-amber-400 leading-relaxed">{message}</span>
      </div>
      {connectLabel && onConnect && (
        <button
          onClick={onConnect}
          className="text-xs text-amber-400 underline hover:text-amber-300 whitespace-nowrap shrink-0"
        >
          {connectLabel} →
        </button>
      )}
    </div>
  );
}
