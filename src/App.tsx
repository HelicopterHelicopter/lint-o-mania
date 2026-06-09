import { useState, useEffect, useCallback, useRef } from 'react';
import { EditorView } from '@codemirror/view';
import { openSearchPanel } from '@codemirror/search';
import Toolbar, { type Action } from './components/Toolbar';
import TabBar from './components/TabBar';
import CodeEditor from './components/CodeEditor';
import StatusBar from './components/StatusBar';
import { beautifyJS, minifyJS } from './lib/jsBeautifier';
import { convertJSToJSON } from './lib/jsToJson';
import { lintJSON, beautifyJSON } from './lib/linter';
import './App.css';

const STORAGE_DARK = 'jslint-dark';

type Status = 'idle' | 'valid' | 'error';

interface TabState {
  id: string;
  title: string;
  input: string;
  output: string;
  status: Status;
  statusMsg?: string;
  statusLine?: number;
  statusCol?: number;
}

const makeTab = (n: number): TabState => ({
  id: `tab-${n}`,
  title: `JSON ${n}`,
  input: '',
  output: '',
  status: 'idle',
});

// Resets the status fields back to idle; spread into a patch alongside any
// new output so a single update both clears the old status and sets the new.
const CLEARED = { status: 'idle' as Status, statusMsg: undefined, statusLine: undefined, statusCol: undefined };

export default function App() {
  const [tabs, setTabs] = useState<TabState[]>(() => [makeTab(1)]);
  const [activeId, setActiveId] = useState('tab-1');
  const nextNum = useRef(2); // monotonic counter so titles/ids stay unique
  const [indent, setIndent] = useState(4);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_DARK);
      return stored === null ? true : stored === 'true';
    } catch { return true; }
  });
  const [copied, setCopied] = useState(false);
  const inputViewRef = useRef<EditorView | null>(null);

  const activeTab = tabs.find(t => t.id === activeId) ?? tabs[0];

  const patchActive = useCallback((patch: Partial<TabState>) => {
    setTabs(ts => ts.map(t => (t.id === activeId ? { ...t, ...patch } : t)));
  }, [activeId]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    try { localStorage.setItem(STORAGE_DARK, String(darkMode)); } catch { /* noop */ }
  }, [darkMode]);

  // Route Ctrl/Cmd+F to an editor's scoped search instead of the browser's
  // page find. When an editor is focused, CodeMirror's own searchKeymap handles
  // the shortcut (and prevents the browser default). When neither editor has
  // focus, fall back to opening the Input editor's search panel.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isFind = (e.metaKey || e.ctrlKey) && !e.altKey && (e.key === 'f' || e.key === 'F');
      if (!isFind) return;
      const active = document.activeElement;
      if (active && active.closest('.cm-editor')) return; // an editor is focused — let CodeMirror handle it
      const view = inputViewRef.current;
      if (!view) return;
      e.preventDefault();
      view.focus();
      openSearchPanel(view);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleAction = useCallback((action: Action) => {
    const input = activeTab.input;
    let patch: Partial<TabState>;

    switch (action) {
      case 'beautify-js': {
        const result = beautifyJS(input, indent);
        patch = result.error
          ? { ...CLEARED, output: '', status: 'error', statusMsg: result.error }
          : { ...CLEARED, output: result.output };
        break;
      }

      case 'js-to-json': {
        const result = convertJSToJSON(input, indent);
        patch = result.error
          ? { ...CLEARED, output: '', status: 'error', statusMsg: result.error }
          : { ...CLEARED, output: result.output };
        break;
      }

      case 'lint-json': {
        const lint = lintJSON(input);
        if (lint.valid) {
          const pretty = beautifyJSON(input, indent);
          patch = { ...CLEARED, output: pretty.output, status: 'valid' };
        } else {
          patch = {
            ...CLEARED,
            output: input,
            status: 'error',
            statusMsg: lint.error!.message,
            statusLine: lint.error!.line,
            statusCol: lint.error!.col,
          };
        }
        break;
      }

      case 'minify': {
        const lintResult = lintJSON(input);
        if (lintResult.valid) {
          const parsed = JSON.parse(input);
          patch = { ...CLEARED, output: JSON.stringify(parsed) };
        } else {
          const result = minifyJS(input);
          patch = result.error
            ? { ...CLEARED, output: '', status: 'error', statusMsg: result.error }
            : { ...CLEARED, output: result.output };
        }
        break;
      }
    }

    patchActive(patch);
  }, [activeTab, indent, patchActive]);

  const handleCopy = async () => {
    const output = activeTab.output;
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const el = document.createElement('textarea');
      el.value = output;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const addTab = () => {
    const tab = makeTab(nextNum.current++);
    setTabs(ts => [...ts, tab]);
    setActiveId(tab.id);
  };

  const closeTab = (id: string) => {
    const idx = tabs.findIndex(t => t.id === id);
    if (tabs.length === 1) {
      // Closing the last tab resets it to a fresh empty document.
      const fresh = makeTab(nextNum.current++);
      setTabs([fresh]);
      setActiveId(fresh.id);
      return;
    }
    const next = tabs.filter(t => t.id !== id);
    setTabs(next);
    if (id === activeId) setActiveId(next[Math.min(idx, next.length - 1)].id);
  };

  const renameTab = (id: string, title: string) => {
    setTabs(ts => ts.map(t => (t.id === id ? { ...t, title: title || t.title } : t)));
  };

  return (
    <div className="app">
      <Toolbar
        onAction={handleAction}
        indent={indent}
        onIndentChange={setIndent}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode(d => !d)}
      />

      <TabBar
        tabs={tabs}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={addTab}
        onClose={closeTab}
        onRename={renameTab}
      />

      <main className="panels">
        <CodeEditor
          key={`in-${activeId}`}
          label="Input"
          editable
          value={activeTab.input}
          onChange={val => patchActive({ input: val, ...CLEARED })}
          onCreateEditor={view => { inputViewRef.current = view; }}
          placeholder={`Paste your JS object or JSON here…\n\n// Example JS object:\n{\n    ok: 200,\n    bad_request: 400,  // HTTP status\n    unauthorised: 401,\n    internal_server_error: 500\n}`}
        />

        <div className="panel-divider" />

        <CodeEditor
          key={`out-${activeId}`}
          label="Output"
          value={activeTab.output}
          placeholder="Output will appear here…"
          action={
            <button
              className={`copy-btn${copied ? ' copied' : ''}`}
              onClick={handleCopy}
              disabled={!activeTab.output}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          }
        />
      </main>

      <StatusBar
        status={activeTab.status}
        message={activeTab.statusMsg}
        line={activeTab.statusLine}
        col={activeTab.statusCol}
      />
    </div>
  );
}
