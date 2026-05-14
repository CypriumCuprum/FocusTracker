// Time and date formatting helpers shared across views.

export function fmt(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m`;
  return `${secs}s`;
}

// Compact label that fits inside a narrow bar column.
export function fmtShort(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${secs}s`;
}

export function localIso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatHeaderDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

export function formatTodayLabel() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  });
}

// Accepts 'YYYY-MM-DD' or an ISO timestamp; returns { label, overdue }.
export function formatDueDate(dateStr) {
  const date  = new Date(dateStr.slice(0, 10) + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff  = Math.round((date - today) / 86400000);
  if (diff === 0)  return { label: 'Today',     overdue: false };
  if (diff === 1)  return { label: 'Tomorrow',  overdue: false };
  if (diff === -1) return { label: 'Yesterday', overdue: true  };
  const opts = date.getFullYear() === today.getFullYear()
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' };
  return {
    label:   date.toLocaleDateString('en-US', opts),
    overdue: diff < 0,
  };
}
