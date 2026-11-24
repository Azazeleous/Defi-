import React, { useState, useRef, useEffect } from 'react';
import { Terminal, CornerDownLeft, Shield, CheckCircle2, Trash2 } from 'lucide-react';
import { OperatorTelemetry } from '../types/gaiaNexus';

interface Props {
  telemetry: OperatorTelemetry;
  onExecuteCommand: (cmd: string) => void;
  logs: string[];
  onClearLogs: () => void;
}

export const GaiaLinksShell: React.FC<Props> = ({
  telemetry,
  onExecuteCommand,
  logs,
  onClearLogs,
}) => {
  const [inputVal, setInputVal] = useState<string>('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = inputVal.trim();
    if (!cmd) return;

    setHistory((prev) => [...prev, cmd]);
    setHistoryIdx(-1);
    setInputVal('');

    onExecuteCommand(cmd);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIdx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(nextIdx);
      setInputVal(history[nextIdx] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx === -1) return;
      const nextIdx = historyIdx + 1;
      if (nextIdx >= history.length) {
        setHistoryIdx(-1);
        setInputVal('');
      } else {
        setHistoryIdx(nextIdx);
        setInputVal(history[nextIdx]);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#020305] border border-[#101d2a] rounded-lg overflow-hidden font-mono text-xs select-none">
      {/* Links Header Bar */}
      <div className="px-3 py-2 bg-[#060a10] border-b border-[#101d2a] flex items-center justify-between text-[#b8daf7] text-[11px]">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-[#00f0ff]" />
          <span className="font-bold text-[#00f0ff]">LINKS / TEXT SHELL &bull; GAIA EYES</span>
          <span className="text-[10px] text-gray-400">Node: 127.0.0.1:BEUC</span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-gray-400 hidden sm:inline">Commands: genesis, lift, forward, reverse, converge, halt</span>
          <button
            onClick={onClearLogs}
            className="text-gray-500 hover:text-white p-1 rounded transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Log Screen */}
      <div
        ref={containerRef}
        className="flex-1 p-3 overflow-y-auto space-y-1 font-mono text-[11px] leading-relaxed select-text scrollbar-thin scrollbar-thumb-[#101d2a] min-h-[160px] max-h-[220px]"
      >
        {logs.map((log, idx) => (
          <div
            key={idx}
            className={
              log.includes('GENESIS') || log.includes('BEUC')
                ? 'text-[#00f0ff] font-bold'
                : log.includes('CONVERGED') || log.includes('COMMITTED')
                ? 'text-[#39ff14] font-semibold'
                : log.includes('INVERSE-FED') || log.includes('LIFT')
                ? 'text-[#a855f7]'
                : log.includes('HALT') || log.includes('SHUTDOWN')
                ? 'text-[#ff0055]'
                : log.startsWith('gaia@links:')
                ? 'text-yellow-400 font-bold'
                : 'text-gray-300'
            }
          >
            {log}
          </div>
        ))}
      </div>

      {/* Interactive Command Input Form */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-3 py-2 bg-[#060a10] border-t border-[#101d2a]"
      >
        <span className="text-[#00f0ff] font-bold shrink-0">gaia@links:~#</span>
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter genesis, lift, forward, reverse, converge, metric, halt..."
          className="flex-1 bg-transparent text-[#39ff14] placeholder-[#4a5568] focus:outline-none font-mono text-xs"
          autoComplete="off"
          spellCheck="false"
        />
        <button
          type="submit"
          className="text-gray-400 hover:text-[#00f0ff] p-1 rounded transition-colors"
        >
          <CornerDownLeft className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
