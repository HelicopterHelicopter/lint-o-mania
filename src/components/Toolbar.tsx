

export type Action = 'beautify-js' | 'js-to-json' | 'lint-json' | 'minify';

interface ToolbarProps {
  onAction: (action: Action) => void;
  indent: number;
  onIndentChange: (indent: number) => void;
  darkMode: boolean;
  onToggleDark: () => void;
}

const BUTTONS: { id: Action; label: string; title: string }[] = [
  { id: 'beautify-js',  label: 'Beautify JS',   title: 'Pretty-print a JS object (preserves unquoted keys & comments)' },
  { id: 'js-to-json',  label: 'JS → JSON',      title: 'Convert a JS object to strict JSON' },
  { id: 'lint-json',   label: 'Lint JSON',       title: 'Validate and pretty-print strict JSON' },
  { id: 'minify',      label: 'Minify',          title: 'Collapse to a single line' },
];

export default function Toolbar({ onAction, indent, onIndentChange, darkMode, onToggleDark }: ToolbarProps) {
  return (
    <header className="toolbar">
      <div className="toolbar-brand">lint-o-mania</div>

      <div className="toolbar-actions">
        {BUTTONS.map(btn => (
          <button
            key={btn.id}
            className="toolbar-btn"
            title={btn.title}
            onClick={() => onAction(btn.id)}
          >
            {btn.label}
          </button>
        ))}
      </div>

      <div className="toolbar-right">
        <label className="indent-label">
          Indent
          <select
            className="indent-select"
            value={indent}
            onChange={e => onIndentChange(Number(e.target.value))}
          >
            <option value={2}>2</option>
            <option value={4}>4</option>
          </select>
        </label>

        <button
          className="theme-toggle"
          onClick={onToggleDark}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle dark mode"
        >
          {darkMode ? '☀' : '☾'}
        </button>
      </div>
    </header>
  );
}
