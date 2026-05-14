import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTauriEvent } from './hooks/useTauriEvent';
import { formatHeaderDate } from './lib/format';
import FocusView    from './views/FocusView';
import DailyInsight from './views/DailyInsight';
import AppsView     from './views/AppsView';
import Settings     from './views/Settings';
import './App.css';

export default function App() {
  const [view,  setView]  = useState('focus');
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState([]);

  const loadTasks = useCallback(async () => {
    try { setTasks(await invoke('get_tasks')); } catch {}
  }, []);

  const loadStats = useCallback(async () => {
    try { setStats(await invoke('get_today_stats')); } catch {}
  }, []);

  useEffect(() => {
    loadTasks();
    loadStats();
  }, [loadTasks, loadStats]);

  useTauriEvent('stats-updated', loadStats);

  const toggleView = name => setView(v => v === name ? 'focus' : name);
  const pending = tasks.filter(t => t.status === 'pending');

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-date">{formatHeaderDate()}</span>
        <span className="app-count">
          {pending.length} task{pending.length !== 1 ? 's' : ''} pending
        </span>
        <div className="nav-icons">
          <button
            className={`nav-btn ${view === 'apps' ? 'active' : ''}`}
            onClick={() => toggleView('apps')}
            title="Apps & Websites"
          >⊞</button>
          <button
            className={`nav-btn ${view === 'settings' ? 'active' : ''}`}
            onClick={() => toggleView('settings')}
            title="Settings"
          >⚙</button>
          <button
            className={`nav-btn ${view === 'insight' ? 'active' : ''}`}
            onClick={() => toggleView('insight')}
            title={view === 'insight' ? 'Back to Focus' : 'Daily Insight'}
          >{view === 'insight' ? '◎' : '◉'}</button>
        </div>
      </header>

      {view === 'focus'    && <FocusView    key="focus"    tasks={tasks} onRefresh={loadTasks} />}
      {view === 'insight'  && <DailyInsight key="insight"  stats={stats} />}
      {view === 'apps'     && <AppsView     key="apps"     />}
      {view === 'settings' && <Settings     key="settings" />}
    </div>
  );
}
