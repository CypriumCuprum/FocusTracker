import { useState, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import TaskModal from '../components/TaskModal';
import './FocusView.css';

const PRIORITY = {
  high:   { color: '#ff8585', order: 0 },
  medium: { color: '#fbbf24', order: 1 },
  low:    { color: '#60a5fa', order: 2 },
};

function formatDueDate(dateStr) {
  const date  = new Date(dateStr.slice(0, 10) + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff  = Math.round((date - today) / 86400000);
  if (diff === 0)  return { label: 'Today',     overdue: false };
  if (diff === 1)  return { label: 'Tomorrow',  overdue: false };
  if (diff === -1) return { label: 'Yesterday', overdue: true  };
  if (diff < 0)    return { label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), overdue: true };
  const opts = date.getFullYear() === new Date().getFullYear()
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' };
  return { label: date.toLocaleDateString('en-US', opts), overdue: false };
}

function getMainTask(tasks) {
  const pending = tasks.filter(t => t.status === 'pending');
  if (!pending.length) return null;
  return [...pending].sort((a, b) => {
    const pd = PRIORITY[a.priority || 'medium'].order - PRIORITY[b.priority || 'medium'].order;
    if (pd !== 0) return pd;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    return a.due_date ? -1 : b.due_date ? 1 : 0;
  })[0];
}

// Pending tasks sorted by priority then due date; completed tasks at the bottom
function sortTasks(tasks) {
  const cmp = (a, b) => {
    const pd = PRIORITY[a.priority || 'medium'].order - PRIORITY[b.priority || 'medium'].order;
    if (pd !== 0) return pd;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    return a.due_date ? -1 : b.due_date ? 1 : 0;
  };
  const pending   = tasks.filter(t => t.status === 'pending').sort(cmp);
  const completed = tasks.filter(t => t.status !== 'pending');
  return [...pending, ...completed];
}

export default function FocusView({ tasks, onRefresh }) {
  const [addOpen,     setAddOpen]     = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const mainTask    = getMainTask(tasks);
  const sortedTasks = useMemo(() => sortTasks(tasks), [tasks]);

  async function handleAdd(task) {
    await invoke('add_task', { task });
    setAddOpen(false);
    onRefresh();
  }

  async function handleEdit(task) {
    await invoke('update_task', { task });
    setEditingTask(null);
    onRefresh();
  }

  async function handleToggle(id) {
    await invoke('toggle_task', { id });
    onRefresh();
  }

  async function handleDelete(id) {
    await invoke('delete_task', { id });
    onRefresh();
  }

  return (
    <div className="focus-view page-enter">
      <div className="focus-body">
        <p className="focus-directive">What is your main focus right now?</p>

        <div className="focus-hero">
          {mainTask
            ? <span className="focus-title">{mainTask.title}</span>
            : <span className="focus-title empty">Nothing pending — great work.</span>
          }
        </div>

        <div className="task-list">
          {sortedTasks.length === 0 ? (
            <p className="tasks-empty">No tasks yet. Hit + Add Task to get started.</p>
          ) : (
            sortedTasks.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onEdit={setEditingTask}
              />
            ))
          )}
        </div>
      </div>

      <footer className="focus-footer">
        <button className="add-task-btn btn-grad" onClick={() => setAddOpen(true)}>
          + Add Task
        </button>
      </footer>

      {addOpen    && <TaskModal task={null}        onSave={handleAdd}  onClose={() => setAddOpen(false)}     />}
      {editingTask && <TaskModal task={editingTask} onSave={handleEdit} onClose={() => setEditingTask(null)} />}
    </div>
  );
}

// ── Task row ──────────────────────────────────────────────────────────────────

function TaskRow({ task, onToggle, onDelete, onEdit }) {
  const done  = task.status === 'completed';
  const color = PRIORITY[task.priority || 'medium'].color;

  return (
    <div className={`task-row ${done ? 'done' : ''}`}>
      <button
        className={`round-check ${done ? 'checked' : ''}`}
        onClick={() => onToggle(task.id)}
      />
      <span
        className="p-dot-ind"
        style={{ background: color, boxShadow: `0 0 5px ${color}55` }}
      />
      <div className="task-body">
        <span className="task-label">{task.title}</span>
        {task.due_date && !done && (() => {
          const { label, overdue } = formatDueDate(task.due_date);
          return (
            <span className={`task-due ${overdue ? 'overdue' : ''}`}>{label}</span>
          );
        })()}
      </div>
      <div className="task-actions">
        <button className="task-act edit-btn"   onClick={() => onEdit(task)}>✎</button>
        <button className="task-act delete-btn" onClick={() => onDelete(task.id)}>×</button>
      </div>
    </div>
  );
}
