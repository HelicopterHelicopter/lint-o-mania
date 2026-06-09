import { useEffect, useRef, useState } from 'react';

interface TabBarProps {
  tabs: { id: string; title: string }[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
}

export default function TabBar({ tabs, activeId, onSelect, onClose, onNew, onRename }: TabBarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Select-all the rename field once it appears so typing replaces the title.
  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

  const startRename = (id: string, title: string) => {
    setDraft(title);
    setEditingId(id);
  };

  const commit = () => {
    if (editingId) onRename(editingId, draft.trim());
    setEditingId(null);
  };

  return (
    <div className="tab-bar" role="tablist">
      {tabs.map(t => (
        <div
          key={t.id}
          className={`tab${t.id === activeId ? ' active' : ''}`}
          role="tab"
          aria-selected={t.id === activeId}
          title={t.title}
          onClick={() => onSelect(t.id)}
          onDoubleClick={() => startRename(t.id, t.title)}
          onMouseDown={e => {
            if (e.button === 1) { e.preventDefault(); onClose(t.id); }
          }}
        >
          {editingId === t.id ? (
            <input
              ref={inputRef}
              className="tab-rename"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onClick={e => e.stopPropagation()}
              onBlur={commit}
              onKeyDown={e => {
                if (e.key === 'Enter') commit();
                else if (e.key === 'Escape') setEditingId(null);
              }}
            />
          ) : (
            <span className="tab-title">{t.title}</span>
          )}
          <button
            className="tab-close"
            aria-label={`Close ${t.title}`}
            onClick={e => { e.stopPropagation(); onClose(t.id); }}
          >
            ×
          </button>
        </div>
      ))}
      <button className="tab-new" onClick={onNew} aria-label="New tab" title="New tab">
        +
      </button>
    </div>
  );
}
