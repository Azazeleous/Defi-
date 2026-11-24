import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, CornerDownLeft, Trash2 } from 'lucide-react';

interface Props {
  onExecuteCommand: (cmd: string) => string | void;
  logs: string[];
  onClearLogs: () => void;
}

export const GISTerminal: React.FC<Props> = ({
  onExecuteCommand,
  logs,
  onClearLogs,
}) => {
  const [inputVal, setInputVal] = useState<string>('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal output
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
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
    <div className="flex flex-col h-full bg-[#010102] border border-[#101d2a] rounded-lg overflow-hidden font-mono text-xs">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#060a10] border-b border-[#101d2a] text-[#b8daf7]">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-3.5 h-3.5 text-[#39ff14]" />
          <span className="text-[11px] font-bold text-[#39ff14]">
            adam@gis-engine:// (SYNAPTICSONAR 1.1)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#a0aec0]">Try: status, echo, loss, reroute, mooncake, grandpod</span>
          <button
            onClick={onClearLogs}
            className="text-[#a0aec0] hover:text-white p-1 rounded transition-colors"
            title="Clear Terminal Output"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Output Screen */}
      <div
        ref={logContainerRef}
        className="flex-1 p-3 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1 scrollbar-thin scrollbar-thumb-[#101d2a] select-text min-h-[140px] max-h-[180px]"
      >
        {logs.map((log, index) => (
          <div
            key={index}
            className={
              log.includes('MOONCAKE') || log.includes('GRANDPOD') || log.includes('🥮')
                ? 'text-amber-300 font-bold'
                : log.includes('[SIGNAL FAILURE]') || log.includes('[LOCKOUT SHIELD]')
                ? 'text-[#ff0055]'
                : log.includes('[RECOVERED]') || log.includes('[ECHO CONFIRMED]')
                ? 'text-[#39ff14]'
                : log.includes('[BGP RE-ALIGN]')
                ? 'text-[#ffb700]'
                : log.includes('[EXEC MAP]')
                ? 'text-[#00f0ff] font-semibold'
                : 'text-[#39ff14]/90'
            }
          >
            {log}
          </div>
        ))}
      </div>

      {/* Terminal Input Row */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-3 py-2 bg-[#020305] border-t border-[#101d2a]"
      >
        <span className="text-[#00f0ff] font-bold shrink-0">adam@gis-engine://</span>
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter mooncake, grandpod, echo, status, loss, reroute..."
          className="flex-1 bg-transparent text-[#39ff14] placeholder-[#4a5568] focus:outline-none font-mono text-xs"
          autoComplete="off"
          spellCheck="false"
        />
        <button
          type="submit"
          className="text-[#a0aec0] hover:text-[#00f0ff] p-1 rounded transition-colors"
        >
          <CornerDownLeft className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
