import React, { useState, useRef, useEffect } from 'react';
import { STATUS_LABELS, STATUS_ICONS, STATUS_COLORS } from '../utils/constants';

export default function StatusBadge({ status, onChange, clickable = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Map to neo colors based on status (simplified)
  const colorMap = {
    draft: 'bg-bw text-text',
    applied: 'bg-neo-blue text-bw',
    sent: 'bg-neo-teal text-bw',
    viewed: 'bg-neo-yellow text-text',
    interview: 'bg-neo-purple text-bw animate-pulse',
    rejected: 'bg-neo-red text-bw',
    offer: 'bg-neo-green text-text',
  };
  const bgClass = colorMap[status] || colorMap.draft;

  return (
    <div className="relative inline-block" ref={ref}>
      <span
        className={`badge-neo ${bgClass} ${clickable ? 'cursor-pointer hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-neohover transition-all' : ''}`}
        onClick={() => clickable && setOpen(!open)}
      >
        <span>{STATUS_ICONS[status]}</span>
        {STATUS_LABELS[status] || status}
      </span>

      {open && clickable && onChange && (
        <div className="absolute top-full mt-2 left-0 z-50 w-48 bg-bw border-4 border-border rounded-base shadow-neo flex flex-col overflow-hidden">
          {Object.keys(STATUS_LABELS).map((s) => (
            <button
              key={s}
              className={`flex items-center gap-2 w-full text-left px-4 py-2 text-sm font-bold uppercase transition-all border-b-2 border-border last:border-0 ${s === status ? 'bg-neo-blue text-bw' : 'bg-bw text-text hover:bg-gray-100'}`}
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
            >
              <span>{STATUS_ICONS[s]}</span>
              <span>{STATUS_LABELS[s]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
