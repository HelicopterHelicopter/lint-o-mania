import React, { useRef, useEffect } from 'react';

interface EditorProps {
  value: string;
  onChange?: (val: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  label: string;
  action?: React.ReactNode;
}

export default function Editor({ value, onChange, readOnly = false, placeholder, label, action }: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize height
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [value]);

  return (
    <div className="editor-panel">
      <div className="editor-header">
        <span className="editor-label">{label}</span>
        {action && <div className="editor-action">{action}</div>}
      </div>
      <textarea
        ref={textareaRef}
        className="editor-textarea"
        value={value}
        onChange={e => onChange?.(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
      />
    </div>
  );
}
