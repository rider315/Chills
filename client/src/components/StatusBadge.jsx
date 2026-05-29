import React, { useState, useRef, useEffect } from 'react';
import { STATUS_LABELS, STATUS_ICONS, STATUS_COLORS } from '../utils/constants';
import './StatusBadge.css';

export default function StatusBadge({ status, onChange, clickable = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const colors = STATUS_COLORS[status] || STATUS_COLORS.draft;

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const badgeStyle = {
    background: colors.bg,
    color: colors.text,
    borderColor: colors.text.replace(')', ',0.25)').replace('rgb', 'rgba'),
  };

  return (
    <div className="status-badge-wrapper" ref={ref}>
      <span
        className={`badge badge--${status} ${clickable ? 'badge--clickable' : ''}`}
        style={badgeStyle}
        onClick={() => clickable && setOpen(!open)}
      >
        <span className="badge__icon">{STATUS_ICONS[status]}</span>
        {STATUS_LABELS[status] || status}
      </span>

      {open && clickable && onChange && (
        <div className="status-dropdown">
          {Object.keys(STATUS_LABELS).map((s) => (
            <button
              key={s}
              className={`status-dropdown__item ${s === status ? 'status-dropdown__item--active' : ''}`}
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
