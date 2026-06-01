import React, { useEffect, useState, useRef } from 'react';

export default function StatsCard({ value, label, icon, color = 'violet' }) {
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current || !value) return;
    hasAnimated.current = true;

    const target = parseInt(value, 10) || 0;
    if (target === 0) { setDisplayValue(0); return; }

    const duration = 1200;
    const steps = 40;
    const increment = target / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      current = Math.round(target * eased);
      setDisplayValue(current);

      if (step >= steps) {
        clearInterval(timer);
        setDisplayValue(target);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  const colorMap = {
    violet: 'bg-neo-purple text-bw',
    blue: 'bg-neo-blue text-bw',
    magenta: 'bg-neo-red text-bw',
    green: 'bg-neo-green text-text',
    yellow: 'bg-neo-yellow text-text',
    default: 'bg-bw text-text',
  };
  const bgClass = colorMap[color] || colorMap.default;

  return (
    <div className={`card-neo flex items-center gap-4 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-neohover cursor-pointer transition-all ${bgClass}`} ref={ref}>
      <div className="flex flex-shrink-0 items-center justify-center w-14 h-14 rounded-full border-4 border-border bg-bw text-text text-2xl shadow-neosm">
        {icon}
      </div>
      <div className="flex flex-col">
        <div className="text-4xl font-black leading-none mb-1">{displayValue}</div>
        <div className="text-xs font-bold uppercase tracking-wider opacity-90">{label}</div>
      </div>
    </div>
  );
}
