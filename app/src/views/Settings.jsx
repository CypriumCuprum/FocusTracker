import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import './Settings.css';

export default function Settings() {
  const [browserClients, setBrowserClients] = useState(0);

  useEffect(() => {
    invoke('get_ws_status').then(setBrowserClients).catch(() => {});
    const unsub = listen('ws-client-changed', () =>
      invoke('get_ws_status').then(setBrowserClients).catch(() => {})
    );
    return () => { unsub.then(f => f()); };
  }, []);

  return (
    <div className="settings-view page-enter">
      <div className="settings-body">
        <h2 className="settings-heading">Settings</h2>

        <div className="card settings-section">
          <div className="settings-title">Extension Status</div>
          <div className="settings-row">
            <span>GNOME Window Tracker</span>
            <span className="badge badge-info">Requires logout/login after install</span>
          </div>
          <div className="settings-row">
            <span>Browser Extension</span>
            <span className={`badge ${browserClients > 0 ? 'badge-ok' : 'badge-warn'}`}>
              {browserClients > 0 ? 'Connected' : 'Waiting…'}
            </span>
          </div>
        </div>

        <div className="card settings-section">
          <div className="settings-title">WebSocket Server</div>
          <div className="settings-row">
            <span>Listen address</span>
            <code className="code-badge">ws://127.0.0.1:8080</code>
          </div>
        </div>

        <div className="card settings-section">
          <div className="settings-title">Database</div>
          <div className="settings-row">
            <span>Location</span>
            <code className="code-badge">~/.local/share/FocusTracker/database.sqlite</code>
          </div>
        </div>
      </div>
    </div>
  );
}
