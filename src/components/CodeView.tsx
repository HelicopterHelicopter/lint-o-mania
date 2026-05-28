import React, { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { lineNumbers, EditorView, placeholder as cmPlaceholder } from '@codemirror/view';
import { foldGutter } from '@codemirror/language';
import { EditorState } from '@codemirror/state';

interface CodeViewProps {
  value: string;
  label: string;
  placeholder?: string;
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
});

export default function CodeView({ value, label, placeholder, action }: CodeViewProps) {
  const extensions = useMemo(
    () => [
      lineNumbers(),
      foldGutter(),
      json(),
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      cmPlaceholder(placeholder ?? ''),
      theme,
    ],
    [placeholder],
  );

  return (
    <div className="editor-panel">
      <div className="editor-header">
        <span className="editor-label">{label}</span>
        {action && <div className="editor-action">{action}</div>}
      </div>
      <div className="codeview-body">
        <CodeMirror
          value={value}
          editable={false}
          readOnly
          basicSetup={false}
          extensions={extensions}
        />
      </div>
    </div>
  );
}
