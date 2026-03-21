import { useState, useEffect, useCallback } from 'react';
import Toolbar, { type Action } from './components/Toolbar';
import Editor from './components/Editor';
import StatusBar from './components/StatusBar';
import { beautifyJS, minifyJS } from './lib/jsBeautifier';
import { convertJSToJSON } from './lib/jsToJson';
import { lintJSON, beautifyJSON } from './lib/linter';
import './App.css';

const STORAGE_DARK = 'jslint-dark';

type Status = 'idle' | 'valid' | 'error';

export default function App() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [indent, setIndent] = useState(4);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_DARK);
      return stored === null ? true : stored === 'true';
    } catch { return true; }
  });
  const [status, setStatus] = useState<Status>('idle');
  const [statusMsg, setStatusMsg] = useState<string | undefined>();
  const [statusLine, setStatusLine] = useState<number | undefined>();
  const [statusCol, setStatusCol] = useState<number | undefined>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    try { localStorage.setItem(STORAGE_DARK, String(darkMode)); } catch { /* noop */ }
  }, [darkMode]);

  const clearStatus = () => {
    setStatus('idle');
    setStatusMsg(undefined);
    setStatusLine(undefined);
    setStatusCol(undefined);
  };

  const setError = (msg: string, line?: number, col?: number) => {
    setStatus('error');
    setStatusMsg(msg);
    setStatusLine(line);
    setStatusCol(col);
  };

  const setValid = () => {
    setStatus('valid');
    setStatusMsg(undefined);
    setStatusLine(undefined);
    setStatusCol(undefined);
  };

  const handleAction = useCallback((action: Action) => {
    clearStatus();

    switch (action) {
      case 'beautify-js': {
        const result = beautifyJS(input, indent);
        if (result.error) {
          setOutput('');
          setError(result.error);
        } else {
          setOutput(result.output);
        }
        break;
      }

      case 'js-to-json': {
        const result = convertJSToJSON(input, indent);
        if (result.error) {
          setOutput('');
          setError(result.error);
        } else {
          setOutput(result.output);
        }
        break;
      }

      case 'lint-json': {
        const lint = lintJSON(input);
        if (lint.valid) {
          const pretty = beautifyJSON(input, indent);
          setOutput(pretty.output);
          setValid();
        } else {
          setOutput(input);
          setError(lint.error!.message, lint.error!.line, lint.error!.col);
        }
        break;
      }

      case 'minify': {
        const lintResult = lintJSON(input);
        if (lintResult.valid) {
          const parsed = JSON.parse(input);
          setOutput(JSON.stringify(parsed));
        } else {
          const result = minifyJS(input);
          if (result.error) {
            setOutput('');
            setError(result.error);
          } else {
            setOutput(result.output);
          }
        }
        break;
      }
    }
  }, [input, indent]);

  const handleCopy = async () => {
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

  return (
    <div className="app">
      <Toolbar
        onAction={handleAction}
        indent={indent}
        onIndentChange={setIndent}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode(d => !d)}
      />

      <main className="panels">
        <Editor
          label="Input"
          value={input}
          onChange={val => { setInput(val); clearStatus(); }}
          placeholder={`Paste your JS object or JSON here…\n\n// Example JS object:\n{\n    ok: 200,\n    bad_request: 400,  // HTTP status\n    unauthorised: 401,\n    internal_server_error: 500\n}`}
        />

        <div className="panel-divider" />

        <Editor
          label="Output"
          value={output}
          readOnly
          placeholder="Output will appear here…"
          action={
            <button
              className={`copy-btn${copied ? ' copied' : ''}`}
              onClick={handleCopy}
              disabled={!output}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          }
        />
      </main>

      <StatusBar
        status={status}
        message={statusMsg}
        line={statusLine}
        col={statusCol}
      />
    </div>
  );
}
