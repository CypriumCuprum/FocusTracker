import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import FocusView    from './views/FocusView';
import DailyInsight from './views/DailyInsight';
import Settings     from './views/Settings';
import './App.css';

function formatDate() {
  return new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function App() {
  const [view,  setView]  = useState('focus');
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState([]);

  const loadTasks = useCallback(async () => {
    try { setTasks(await invoke('get_tasks')); } catch {}
  }, []);

  const loadStats = useCallback(async () => {
    try { setStats(await invoke('get_yesterday_stats')); } catch {}
  }, []);

  useEffect(() => {
    loadTasks();
    loadStats();
  }, [loadTasks, loadStats]);

  const toggleInsight  = () => setView(v => v === 'insight'  ? 'focus' : 'insight');
  const toggleSettings = () => setView(v => v === 'settings' ? 'focus' : 'settings');

  const pending = tasks.filter(t => t.status === 'pending');

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-date">{formatDate()}</span>
        <span className="app-count">
          {pending.length} task{pending.length !== 1 ? 's' : ''} pending
        </span>
        <div className="nav-icons">
          <button
            className={`nav-btn ${view === 'settings' ? 'active' : ''}`}
            onClick={toggleSettings}
            title="Settings"
          >⚙</button>
          <button
            className={`nav-btn ${view === 'insight' ? 'active' : ''}`}
            onClick={toggleInsight}
            title={view === 'insight' ? 'Back to Focus' : 'Daily Insight'}
          >{view === 'insight' ? '◎' : '◉'}</button>
        </div>
      </header>

      {view === 'focus'    && <FocusView    key="focus"    tasks={tasks} onRefresh={loadTasks} />}
      {view === 'insight'  && <DailyInsight key="insight"  stats={stats} />}
      {view === 'settings' && <Settings     key="settings" />}
    </div>
  );
}
