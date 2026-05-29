export const STATUS_STAGES = [
  'draft',
  'applied',
  'sent',
  'viewed',
  'interview',
  'rejected',
  'offer',
];

export const STATUS_COLORS = {
  draft:     { bg: 'rgba(107,115,148,0.15)', text: '#8892b0', glow: 'rgba(107,115,148,0.3)' },
  applied:   { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa', glow: 'rgba(59,130,246,0.3)' },
  sent:      { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa', glow: 'rgba(59,130,246,0.3)' },
  viewed:    { bg: 'rgba(251,191,36,0.15)',  text: '#fbbf24', glow: 'rgba(251,191,36,0.3)' },
  interview: { bg: 'rgba(139,92,246,0.15)',  text: '#a78bfa', glow: 'rgba(139,92,246,0.3)' },
  rejected:  { bg: 'rgba(239,68,68,0.12)',   text: '#f87171', glow: 'rgba(239,68,68,0.3)' },
  offer:     { bg: 'rgba(52,211,153,0.15)',  text: '#34d399', glow: 'rgba(52,211,153,0.3)' },
};

export const STATUS_LABELS = {
  draft:     'Draft',
  applied:   'Applied',
  sent:      'Sent',
  viewed:    'Viewed',
  interview: 'Interview',
  rejected:  'Rejected',
  offer:     'Offer',
};

export const STATUS_ICONS = {
  draft:     '📝',
  applied:   '📨',
  sent:      '✉️',
  viewed:    '👀',
  interview: '🎯',
  rejected:  '❌',
  offer:     '🎉',
};
