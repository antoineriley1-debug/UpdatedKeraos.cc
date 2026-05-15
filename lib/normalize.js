// Shared utilities — safe to import from client or server.

export const STATUS_THEME = {
  to_develop:         { color: '#7a8a72', label: 'To Develop' },
  in_progress:        { color: '#c39248', label: 'In Progress' },
  nearing_completion: { color: '#c47e3f', label: 'Nearing Completion' },
  completed:          { color: '#5a8d68', label: 'Completed' },
  no_status:          { color: '#5a5550', label: 'No Status' },
  other:              { color: '#8a847e', label: 'Other' },
};

export function normalizeStatus(raw) {
  if (!raw) return 'no_status';
  const s = String(raw).toLowerCase().trim();
  if (s.includes('complet')) return 'completed';
  if (s.includes('nearing')) return 'nearing_completion';
  if (s.includes('develop')) return 'to_develop';
  if (s.includes('progress')) return 'in_progress';
  return 'other';
}

export function dateInfo(endDate, today = new Date()) {
  if (!endDate) {
    return { hasDate: false, isOverdue: false, isDueSoon: false, days: null, pretty: null };
  }
  const due = new Date(endDate);
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffMs = due - t;
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const pretty = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return {
    hasDate: true,
    isOverdue: days < 0,
    isDueSoon: days >= 0 && days <= 7,
    days,
    pretty,
  };
}

export function shortName(name) {
  if (!name) return '?';
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

export function relativeTime(date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
