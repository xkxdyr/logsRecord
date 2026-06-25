import type { LogEntry } from "../../shared/types";
import { LevelBadge, LevelBar } from "./LevelBadge";
import { cn } from "@/lib/utils";

interface LogRowProps {
  log: LogEntry;
  onClick?: (log: LogEntry) => void;
  isSelected?: boolean;
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

export function LogRow({ log, onClick, isSelected }: LogRowProps) {
  return (
    <div
      onClick={() => onClick?.(log)}
      className={cn(
        "group flex items-stretch gap-0 border-b border-base-800 px-3 py-2 cursor-pointer transition-colors",
        "hover:bg-base-600/50",
        isSelected && "bg-base-600",
      )}
    >
      <LevelBar level={log.level} />
      <div className="flex flex-1 items-center gap-3 overflow-hidden pl-3">
        <span className="shrink-0 font-mono text-xs text-zinc-600 tabular-nums">
          {formatTime(log.timestamp)}
        </span>
        <LevelBadge level={log.level} />
        <span className="shrink-0 font-mono text-xs text-teal/80">{log.service}</span>
        <span className="flex-1 truncate font-mono text-xs text-zinc-300 group-hover:text-zinc-100">
          {log.message}
        </span>
        {Object.keys(log.attributes).length > 0 && (
          <span className="shrink-0 rounded bg-base-600 px-1.5 py-0.5 text-[10px] text-zinc-500">
            {Object.keys(log.attributes).length} attrs
          </span>
        )}
      </div>
    </div>
  );
}
