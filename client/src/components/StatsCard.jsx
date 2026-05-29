import React, { useEffect, useState, useRef } from 'react';
import './StatsCard.css';

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
      // Ease-out
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

  return (
    <div className={`stats-card glass-card glass-card--interactive stats-card--${color}`} ref={ref}>
      <div className="stats-card__icon-wrapper" data-color={color}>
        <span className="stats-card__icon">{icon}</span>
      </div>
      <div className="stats-card__info">
        <div className="stats-card__value">{displayValue}</div>
        <div className="stats-card__label">{label}</div>
      </div>
    </div>
  );
}
