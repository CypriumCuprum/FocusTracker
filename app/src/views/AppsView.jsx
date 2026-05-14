import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import Modal from '../components/Modal';
import { useTauriEvent } from '../hooks/useTauriEvent';
import { fmt } from '../lib/format';
import { displayName } from '../lib/platforms';
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

export default function AppsView() {
  const [platforms,    setPlatforms]    = useState([]);
  const [categories,   setCategories]   = useState([]);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [showAddCat,   setShowAddCat]   = useState(false);
  const [newCatName,   setNewCatName]   = useState('');
  const [newCatColor,  setNewCatColor]  = useState('#c084fc');
  const [editingCat,   setEditingCat]   = useState(null);
  const [editName,     setEditName]     = useState('');
  const [editColor,    setEditColor]    = useState('');

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

  useEffect(() => { load(); }, [load]);
  useTauriEvent('categories-updated', load);

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
        <Modal onClose={() => setShowAddCat(false)}>
          <CategoryForm
            heading="New Category"
            name={newCatName}
            color={newCatColor}
            onNameChange={setNewCatName}
            onColorChange={setNewCatColor}
            onCancel={() => setShowAddCat(false)}
            onSubmit={handleAddCategory}
            submitLabel="Add"
            namePlaceholder="e.g. Work, Entertainment"
          />
        </Modal>
      )}

      {editingCat && (
        <Modal onClose={() => setEditingCat(null)}>
          <CategoryForm
            heading="Edit Category"
            name={editName}
            color={editColor}
            onNameChange={setEditName}
            onColorChange={setEditColor}
            onCancel={() => setEditingCat(null)}
            onSubmit={handleEditCategory}
            submitLabel="Save"
          />
        </Modal>
      )}
    </div>
  );
}

function CategoryForm({
  heading, name, color, onNameChange, onColorChange,
  onCancel, onSubmit, submitLabel, namePlaceholder,
}) {
  return (
    <>
      <h3 className="modal-heading">{heading}</h3>
      <div className="modal-field">
        <label className="modal-label">Name</label>
        <input
          className="modal-input"
          value={name}
          onChange={e => onNameChange(e.target.value)}
          placeholder={namePlaceholder}
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') onSubmit(); }}
        />
      </div>
      <div className="modal-field">
        <label className="modal-label">Color</label>
        <div className="color-field">
          <input
            type="color"
            value={color}
            onChange={e => onColorChange(e.target.value)}
            className="color-input"
          />
          <span className="color-preview" style={{ background: color }} />
          <span className="color-hex">{color}</span>
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button
          className="btn-grad"
          onClick={onSubmit}
          disabled={!name.trim()}
        >{submitLabel}</button>
      </div>
    </>
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
