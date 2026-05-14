export const PRIORITY = {
  high:   { label: 'High',   color: '#ff8585', order: 0 },
  medium: { label: 'Medium', color: '#fbbf24', order: 1 },
  low:    { label: 'Low',    color: '#60a5fa', order: 2 },
};

function compareTasks(a, b) {
  const pd = PRIORITY[a.priority || 'medium'].order - PRIORITY[b.priority || 'medium'].order;
  if (pd !== 0) return pd;
  if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
  return a.due_date ? -1 : b.due_date ? 1 : 0;
}

export function getMainTask(tasks) {
  const pending = tasks.filter(t => t.status === 'pending');
  if (!pending.length) return null;
  return [...pending].sort(compareTasks)[0];
}

// Pending tasks (sorted by priority then due date) first, completed tasks last.
export function sortTasks(tasks) {
  const pending   = tasks.filter(t => t.status === 'pending').sort(compareTasks);
  const completed = tasks.filter(t => t.status !== 'pending');
  return [...pending, ...completed];
}
