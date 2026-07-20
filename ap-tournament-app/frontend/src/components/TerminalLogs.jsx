import { useEffect, useRef } from 'react';

export default function TerminalLogs({ logs = [] }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [logs]);

  return (
    <div
      ref={ref}
      className="terminal-log h-48 overflow-y-auto rounded-xl border border-emerald/20 bg-black/60 p-4"
    >
      {logs.length === 0 ? (
        <p className="text-slate-600">Waiting for scan...</p>
      ) : (
        logs.map((entry, i) => (
          <div key={i} className={entry.message?.startsWith('ERROR') ? 'text-crimson' : 'text-emerald/90'}>
            <span className="text-slate-600">[{entry.time}]</span> {entry.message}
          </div>
        ))
      )}
    </div>
  );
}

export function createLogEntry(message) {
  const time = new Date().toLocaleTimeString('id-ID', { hour12: false });
  return { time, message };
}
