import React, { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { Prec, type Text } from '@codemirror/state';
import {
  lineNumbers,
  keymap,
  EditorView,
  placeholder as cmPlaceholder,
} from '@codemirror/view';
import { foldGutter, foldService } from '@codemirror/language';
import { search, searchKeymap } from '@codemirror/search';

// CodeMirror's built-in JSON folding is driven by the Lezer parse tree, but for
// large documents the parser only parses a prefix (lazy/viewport parsing). The
// outer containers span past that parse frontier, so the tree-based fold service
// reports them as unfoldable — that's why big top-level objects/arrays show no
// fold arrow while small nested ones do.
//
// This bracket-matching fold service is parse-independent: it folds any container
// regardless of document size. Like the other hand-written scanners in src/lib, it
// copies string contents verbatim (tracking quotes + escapes) so that braces and
// brackets inside string values are never mistaken for structure.

// Stream forward from the opening bracket at `openPos` to its matching close,
// skipping over string literals. Returns the index of the matching bracket, or -1.
function findMatchingBracket(doc: Text, openPos: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let pos = openPos;
  for (const chunk of doc.iterRange(openPos, doc.length)) {
    for (let i = 0; i < chunk.length; i++, pos++) {
      const c = chunk[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (c === '\\') escaped = true;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') inString = true;
      else if (c === '{' || c === '[') depth++;
      else if (c === '}' || c === ']') {
        if (--depth === 0) return pos;
      }
    }
  }
  return -1;
}

const bracketFoldService = foldService.of((state, lineStart, lineEnd) => {
  const { doc } = state;
  const lineText = doc.sliceString(lineStart, lineEnd);
  let inString = false;
  let escaped = false;
  // Find the first opening bracket on this line whose match lands on a later line.
  for (let i = 0; i < lineText.length; i++) {
    const c = lineText[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
    } else if (c === '{' || c === '[') {
      const closePos = findMatchingBracket(doc, lineStart + i);
      if (closePos > lineEnd) return { from: lineStart + i + 1, to: closePos };
    }
  }
  return null;
});

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
// folding still works (folding uses bracketFoldService above, not the highlight style).
const theme = EditorView.theme({
  '&': { color: 'var(--text)', height: '100%', fontSize: '13.5px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '1.65', overflow: 'auto' },
  '.cm-content': { padding: '12px 0' },
  // Opaque so the sticky gutter hides content scrolling underneath it (not transparent,
  // which let line numbers and code overlap during horizontal scroll). The read-only
  // Output panel overrides this background in App.css to match its muted panel color.
  '.cm-gutters': { backgroundColor: 'var(--bg-panel)', color: 'var(--text-muted)', border: 'none' },
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
      // High precedence so it's consulted before json()'s parse-tree fold, which
      // fails on the outer containers of large documents (see bracketFoldService).
      Prec.high(bracketFoldService),
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
