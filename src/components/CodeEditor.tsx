import React, { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import {
  lineNumbers,
  keymap,
  EditorView,
  placeholder as cmPlaceholder,
} from '@codemirror/view';
import { foldGutter } from '@codemirror/language';
import { search, searchKeymap } from '@codemirror/search';

interface CodeEditorProps {
  value: string;
  label: string;
  placeholder?: string;
  /** When true the editor is editable and onChange fires; otherwise read-only. */
  editable?: boolean;
  onChange?: (val: string) => void;
  /** Receives the underlying EditorView once mounted (used for focus-less Ctrl+F). */
  onCreateEditor?: (view: EditorView) => void;
  action?: React.ReactNode;
}

// Single-color theme that follows the app's light/dark CSS variables.
// No syntaxHighlighting is added, so JSON tokens render in one color while
// folding still works (folding uses json()'s parse tree, not the highlight style).
const theme = EditorView.theme({
  '&': { color: 'var(--text)', height: '100%', fontSize: '13.5px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '1.65', overflow: 'auto' },
  '.cm-content': { padding: '12px 0' },
  '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--text-muted)', border: 'none' },
  '.cm-foldGutter .cm-gutterElement': { cursor: 'pointer', color: 'var(--text-muted)' },
  '.cm-foldPlaceholder': {
    backgroundColor: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    color: 'var(--text-muted)',
    padding: '0 6px',
    margin: '0 2px',
  },
  // Search panel — themed to match the app's CSS variables.
  '.cm-panels': {
    backgroundColor: 'var(--bg-panel)',
    color: 'var(--text)',
    borderBottom: '1px solid var(--border)',
  },
  '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--border)' },
  '.cm-search': { padding: '6px 10px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' },
  '.cm-search label': { fontSize: '12px', color: 'var(--text-muted)' },
  '.cm-textfield': {
    backgroundColor: 'var(--bg)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '2px 6px',
    fontFamily: 'var(--mono)',
  },
  '.cm-button': {
    backgroundColor: 'transparent',
    backgroundImage: 'none',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '2px 8px',
    cursor: 'pointer',
  },
  '.cm-button:hover': { borderColor: 'var(--accent)' },
});

export default function CodeEditor({
  value,
  label,
  placeholder,
  editable = false,
  onChange,
  onCreateEditor,
  action,
}: CodeEditorProps) {
  const extensions = useMemo(
    () => [
      lineNumbers(),
      foldGutter(),
      json(),
      search({ top: true }),
      keymap.of(searchKeymap),
      cmPlaceholder(placeholder ?? ''),
      theme,
    ],
    [placeholder],
  );

  return (
    <div className={`editor-panel${editable ? '' : ' editor-panel-readonly'}`}>
      <div className="editor-header">
        <span className="editor-label">{label}</span>
        {action && <div className="editor-action">{action}</div>}
      </div>
      <div className="editor-cm">
        <CodeMirror
          value={value}
          editable
          readOnly={!editable}
          basicSetup={false}
          extensions={extensions}
          onChange={onChange}
          onCreateEditor={onCreateEditor}
        />
      </div>
    </div>
  );
}
