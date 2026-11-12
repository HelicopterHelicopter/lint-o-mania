import { useState, useEffect, useCallback, useRef } from 'react';
import { EditorView } from '@codemirror/view';
import { openSearchPanel } from '@codemirror/search';
import { Analytics } from '@vercel/analytics/react';
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
  // One EditorView per tab per panel, kept alive for the life of the tab. Because
  // every tab's editors stay mounted (only the active pair is visible), CodeMirror
  // preserves each tab's own scroll + fold state natively across tab switches.
  const inputViews = useRef<Map<string, EditorView>>(new Map());
  const outputViews = useRef<Map<string, EditorView>>(new Map());

  const activeTab = tabs.find(t => t.id === activeId) ?? tabs[0];

  const patchTab = useCallback((id: string, patch: Partial<TabState>) => {
    setTabs(ts => ts.map(t => (t.id === id ? { ...t, ...patch } : t)));
  }, []);
  const patchActive = useCallback(
    (patch: Partial<TabState>) => patchTab(activeId, patch),
    [patchTab, activeId],
  );

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
      const view = inputViews.current.get(activeId);
      if (!view) return;
      e.preventDefault();
      view.focus();
      openSearchPanel(view);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeId]);

  // Editors that mounted (or sat) while hidden never measured their layout, so on
  // reveal they can paint with a stale viewport/scrollbar and the wrong scroll
  // offset. Nudge the newly-active tab's editors to re-measure on switch.
  useEffect(() => {
    inputViews.current.get(activeId)?.requestMeasure();
    outputViews.current.get(activeId)?.requestMeasure();
  }, [activeId]);

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
    // The tab's editors unmount; drop their views so the maps don't keep stale refs.
    inputViews.current.delete(id);
    outputViews.current.delete(id);
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
      <Analytics />
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

      <main className="panels-stack">
        {tabs.map(tab => (
          <div className="panels" key={tab.id} hidden={tab.id !== activeId}>
            <CodeEditor
              label="Input"
              editable
              value={tab.input}
              onChange={val => patchTab(tab.id, { input: val, ...CLEARED })}
              onCreateEditor={view => { inputViews.current.set(tab.id, view); }}
              placeholder={`Paste your JS object or JSON here…\n\n// Example JS object:\n{\n    ok: 200,\n    bad_request: 400,  // HTTP status\n    unauthorised: 401,\n    internal_server_error: 500\n}`}
            />

            <div className="panel-divider" />

            <CodeEditor
              label="Output"
              value={tab.output}
              onCreateEditor={view => { outputViews.current.set(tab.id, view); }}
              placeholder="Output will appear here…"
              action={
                tab.id === activeId ? (
                  <button
                    className={`copy-btn${copied ? ' copied' : ''}`}
                    onClick={handleCopy}
                    disabled={!tab.output}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                ) : undefined
              }
            />
          </div>
        ))}
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
