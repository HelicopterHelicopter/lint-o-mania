

interface StatusBarProps {
  status: 'idle' | 'valid' | 'error';
  message?: string;
  line?: number;
  col?: number;
}

export default function StatusBar({ status, message, line, col }: StatusBarProps) {
  if (status === 'idle') return <div className="status-bar status-idle" />;

  const location = line != null ? ` — Line ${line}${col != null ? `, Col ${col}` : ''}` : '';

  return (
    <div className={`status-bar status-${status}`}>
      {status === 'valid' ? (
        <span>&#10003; Valid JSON</span>
      ) : (
        <span>&#10007; {message}{location}</span>
      )}
    </div>
  );
}
