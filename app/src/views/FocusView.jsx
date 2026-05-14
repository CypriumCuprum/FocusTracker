import { useState, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import TaskModal from '../components/TaskModal';
import { formatDueDate } from '../lib/format';
import { PRIORITY, sortTasks, getMainTask } from '../lib/tasks';
import './FocusView.css';

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
