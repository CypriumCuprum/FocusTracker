import { useState, useEffect } from 'react';
import './TaskModal.css';

const PRIORITY = {
  high:   { label: 'High',   color: '#ff8585' },
  medium: { label: 'Medium', color: '#fbbf24' },
  low:    { label: 'Low',    color: '#60a5fa' },
};

function fmtDue(d) {
  const date  = new Date(d + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff  = Math.round((date - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const opts = date.getFullYear() === today.getFullYear()
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' };
  return date.toLocaleDateString('en-US', opts);
}

// task=null → Add mode; task=object → Edit mode
export default function TaskModal({ task, onSave, onClose }) {
  const isEdit = task != null;

  const [title,       setTitle]       = useState(task?.title    ?? '');
  const [dueDate,     setDueDate]     = useState(task?.due_date?.slice(0, 10) ?? '');
  const [showPicker,  setShowPicker]  = useState(false);
  const [priority,    setPriority]    = useState(task?.priority ?? 'medium');

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function handleDateChange(e) {
    setDueDate(e.target.value);
    if (e.target.value) setShowPicker(false);
  }

  function clearDate(e) {
    e.stopPropagation();
    setDueDate('');
    setShowPicker(false);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      ...(isEdit ? task : {}),
      title:       title.trim(),
      description: task?.description ?? null,
      status:      task?.status      ?? 'pending',
      due_date:    dueDate || null,
      priority,
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <p className="modal-heading">{isEdit ? 'Edit Task' : 'New Task'}</p>

        <form onSubmit={handleSubmit}>
          {/* Title */}
          <div className="modal-field">
            <label className="modal-label">Task title</label>
            <input
              className="modal-input"
              placeholder="Write something…"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Due date – toggle */}
          <div className="modal-field modal-field-due">
            <label className="modal-label">
              Due date <span className="optional">optional</span>
            </label>
            {!dueDate && !showPicker && (
              <button type="button" className="due-add-btn" onClick={() => setShowPicker(true)}>
                + Add due date
              </button>
            )}
            {showPicker && (
              <div className="due-picker-row">
                <input
                  className="modal-input"
                  type="date"
                  value={dueDate}
                  autoFocus
                  onChange={handleDateChange}
                />
                <button type="button" className="due-picker-cancel" onClick={() => setShowPicker(false)}>
                  ×
                </button>
              </div>
            )}
            {dueDate && !showPicker && (
              <div className="due-chip" onClick={() => setShowPicker(true)} title="Click to change">
                <span className="due-chip-text">{fmtDue(dueDate)}</span>
                <button type="button" className="due-chip-clear" onClick={clearDate}>×</button>
              </div>
            )}
          </div>

          {/* Priority */}
          <div className="modal-field">
            <label className="modal-label">Priority</label>
            <div className="modal-priority">
              <div className="p-dots-row">
                {['high', 'medium', 'low'].map(p => (
                  <button
                    key={p}
                    type="button"
                    className={`p-dot-btn ${priority === p ? 'active' : ''}`}
                    style={{ '--c': PRIORITY[p].color }}
                    onClick={() => setPriority(p)}
                    title={PRIORITY[p].label}
                  />
                ))}
              </div>
              <span className="p-label" style={{ color: PRIORITY[priority].color }}>
                {PRIORITY[priority].label}
              </span>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-grad">
              {isEdit ? 'Save Changes →' : 'Add Task →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
