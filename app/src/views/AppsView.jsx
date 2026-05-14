import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import './AppsView.css';

const COLOR_PALETTE = [
  '#c084fc', '#22d3ee', '#f97316', '#4ade80',
  '#fb7185', '#facc15', '#60a5fa', '#a78bfa',
  '#34d399', '#f472b6', '#fb923c', '#38bdf8',
];

function pickNextColor(usedColors) {
  const used = new Set(usedColors.map(c => c.toLowerCase()));
  return COLOR_PALETTE.find(c => !used.has(c)) ?? COLOR_PALETTE[0];
}

const DISPLAY_NAMES = {
  'youtube.com':      'YouTube',
  'facebook.com':     'Facebook',
  'x.com':            'X',
  'twitter.com':      'Twitter',
  'tiktok.com':       'TikTok',
  'instagram.com':    'Instagram',
  'reddit.com':       'Reddit',
  'twitch.tv':        'Twitch',
  'netflix.com':      'Netflix',
  'github.com':       'GitHub',
  'docs.google.com':  'Google Docs',
  'sheets.google.com':'Google Sheets',
  'slides.google.com':'Google Slides',
  'mail.google.com':  'Gmail',
  'discord.com':      'Discord',
  'notion.so':        'Notion',
  'figma.com':        'Figma',
};

function displayName(p) {
  return DISPLAY_NAMES[p.toLowerCase()] ?? p;
}

function fmt(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m`;
  return `${secs}s`;
}

export default function AppsView() {
  const [platforms,   setPlatforms]   = useState([]);
  const [categories,  setCategories]  = useState([]);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [showAddCat,  setShowAddCat]  = useState(false);
  const [newCatName,  setNewCatName]  = useState('');
  const [newCatColor, setNewCatColor] = useState('#c084fc');
  const [editingCat,  setEditingCat]  = useState(null);   // { id, name, color }
  const [editName,    setEditName]    = useState('');
  const [editColor,   setEditColor]   = useState('');

  const load = useCallback(async () => {
    try {
      const [plats, cats] = await Promise.all([
        invoke('get_all_platforms'),
        invoke('get_app_categories'),
      ]);
      setPlatforms(plats);
      setCategories(cats);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    let unlisten;
    listen('categories-updated', load).then(fn => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, [load]);

  async function handleSetCategory(platform, categoryId) {
    try { await invoke('set_platform_category', { platform, categoryId }); } catch {}
    setOpenDropdown(null);
  }

  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    try { await invoke('add_app_category', { name: newCatName.trim(), color: newCatColor }); } catch {}
    setShowAddCat(false);
    setNewCatName('');
  }

  function openAddModal() {
    setNewCatColor(pickNextColor(categories.map(c => c.color)));
    setNewCatName('');
    setShowAddCat(true);
  }

  function openEditModal(cat) {
    setEditingCat(cat);
    setEditName(cat.name);
    setEditColor(cat.color);
  }

  async function handleEditCategory() {
    if (!editName.trim() || !editingCat) return;
    try { await invoke('update_app_category', { id: editingCat.id, name: editName.trim(), color: editColor }); } catch {}
    setEditingCat(null);
  }

  return (
    <div className="apps-view page-enter">
      <div className="apps-header">
        <h2 className="apps-title">Apps &amp; Websites</h2>
        <button className="add-cat-btn btn-grad" onClick={openAddModal}>
          + Category
        </button>
      </div>

      {categories.length > 0 && (
        <div className="cats-bar">
          {categories.map(cat => (
            <div key={cat.id} className="cat-chip" style={{ '--chip-color': cat.color }}>
              <span className="cat-chip-dot" style={{ background: cat.color }} />
              <span className="cat-chip-name">{cat.name}</span>
              <button className="cat-chip-edit" onClick={() => openEditModal(cat)} title="Edit">✎</button>
            </div>
          ))}
        </div>
      )}

      <div className="apps-list">
        {platforms.length === 0 && (
          <p className="apps-empty">No apps tracked yet.</p>
        )}
        {platforms.map(p => (
          <PlatformRow
            key={p.platform}
            entry={p}
            categories={categories}
            isOpen={openDropdown === p.platform}
            onOpen={() => setOpenDropdown(openDropdown === p.platform ? null : p.platform)}
            onClose={() => setOpenDropdown(null)}
            onSetCategory={handleSetCategory}
          />
        ))}
      </div>

      {showAddCat && (
        <div className="modal-backdrop" onClick={() => setShowAddCat(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 className="modal-heading">New Category</h3>
            <div className="modal-field">
              <label className="modal-label">Name</label>
              <input
                className="modal-input"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                placeholder="e.g. Work, Entertainment"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddCategory();
                  if (e.key === 'Escape') setShowAddCat(false);
                }}
              />
            </div>
            <div className="modal-field">
              <label className="modal-label">Color</label>
              <div className="color-field">
                <input
                  type="color"
                  value={newCatColor}
                  onChange={e => setNewCatColor(e.target.value)}
                  className="color-input"
                />
                <span className="color-preview" style={{ background: newCatColor }} />
                <span className="color-hex">{newCatColor}</span>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowAddCat(false)}>Cancel</button>
              <button
                className="btn-grad"
                onClick={handleAddCategory}
                disabled={!newCatName.trim()}
              >Add</button>
            </div>
          </div>
        </div>
      )}

      {editingCat && (
        <div className="modal-backdrop" onClick={() => setEditingCat(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 className="modal-heading">Edit Category</h3>
            <div className="modal-field">
              <label className="modal-label">Name</label>
              <input
                className="modal-input"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') handleEditCategory();
                  if (e.key === 'Escape') setEditingCat(null);
                }}
              />
            </div>
            <div className="modal-field">
              <label className="modal-label">Color</label>
              <div className="color-field">
                <input
                  type="color"
                  value={editColor}
                  onChange={e => setEditColor(e.target.value)}
                  className="color-input"
                />
                <span className="color-preview" style={{ background: editColor }} />
                <span className="color-hex">{editColor}</span>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setEditingCat(null)}>Cancel</button>
              <button
                className="btn-grad"
                onClick={handleEditCategory}
                disabled={!editName.trim()}
              >Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlatformRow({ entry, categories, isOpen, onOpen, onClose, onSetCategory }) {
  const dropdownRef = useRef(null);
  const color = entry.category_color ?? '#444444';

  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  return (
    <div className="platform-row" style={{ '--row-color': color }}>
      <div className="platform-info">
        <span className="platform-name">{displayName(entry.platform)}</span>
        <span className="platform-time">{fmt(entry.total_seconds)}</span>
      </div>
      <div className="platform-cat-wrap" ref={dropdownRef}>
        <button
          className="cat-pill"
          style={entry.category_id ? {
            background: color + '22',
            border:     `1px solid ${color}`,
            color,
          } : {}}
          onClick={onOpen}
        >
          {entry.category_name ?? '—'}
        </button>
        {isOpen && (
          <div className="cat-dropdown">
            <button className="cat-opt" onClick={() => onSetCategory(entry.platform, null)}>
              <span className="cat-opt-dot" style={{ background: 'rgba(255,255,255,0.2)' }} />
              Uncategorized
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                className={`cat-opt ${entry.category_id === cat.id ? 'cat-opt--active' : ''}`}
                onClick={() => onSetCategory(entry.platform, cat.id)}
              >
                <span className="cat-opt-dot" style={{ background: cat.color }} />
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
