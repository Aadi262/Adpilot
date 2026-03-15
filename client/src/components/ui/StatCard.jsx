import { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line } from 'recharts';

function useCountUp(target, duration = 1000) {
  const [count, setCount] = useState(0);
  const raf = useRef(null);

  useEffect(() => {
    const numeric = parseFloat(String(target).replace(/[^0-9.]/g, ''));
    if (isNaN(numeric)) { setCount(target); return; }

    let start = null;
    const step = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      setCount(Math.floor(progress * numeric));
      if (progress < 1) raf.current = requestAnimationFrame(step);
      else setCount(numeric);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  return count;
}

export default function StatCard({ icon: Icon, label, value, change, prefix = '', suffix = '', sparkData, iconColor = 'text-accent-blue', iconBg = 'bg-accent-blue/10' }) {
  const numericValue = parseFloat(String(value).replace(/[^0-9.]/g, '')) || 0;
  const animated = useCountUp(numericValue);
  const isPositive = change == null || change >= 0;

  const displayValue = typeof value === 'string' && value.includes('.')
    ? animated.toFixed(1)
    : animated.toLocaleString();

  return (
    <div className="card flex flex-col gap-4 hover:border-accent-blue/30 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${iconBg}`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
          <span className="text-text-secondary text-sm font-medium">{label}</span>
        </div>
        {change != null && (
          <div className={`flex items-center gap-1 text-xs font-semibold ${isPositive ? 'text-accent-green' : 'text-red-400'}`}>
            {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {Math.abs(change)}%
          </div>
        )}
      </div>

      <div className="text-3xl font-bold text-text-primary">
        {prefix}{displayValue}{suffix}
      </div>

      {sparkData && (
        <div className="h-10">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <Line
                type="monotone"
                dataKey="v"
                stroke={isPositive ? '#10B981' : '#EF4444'}
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
