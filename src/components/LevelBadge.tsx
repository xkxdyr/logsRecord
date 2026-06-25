import type { LogLevel } from "../../shared/types";
import { cn } from "@/lib/utils";

const LEVEL_STYLES: Record<LogLevel, string> = {
  TRACE: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  DEBUG: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
  INFO: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  WARN: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  ERROR: "bg-red-500/10 text-red-400 border-red-500/30",
  FATAL: "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30",
};

const LEVEL_BAR: Record<LogLevel, string> = {
  TRACE: "bg-slate-500",
  DEBUG: "bg-indigo-500",
  INFO: "bg-blue-500",
  WARN: "bg-amber-500",
  ERROR: "bg-red-500",
  FATAL: "bg-fuchsia-500",
};

export function LevelBadge({ level, size = "sm" }: { level: LogLevel; size?: "sm" | "xs" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border font-mono font-medium uppercase tracking-wide",
        LEVEL_STYLES[level],
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-1 py-0.5 text-[9px]",
      )}
    >
      {level}
    </span>
  );
}

export function LevelBar({ level }: { level: LogLevel }) {
  return <div className={cn("level-bar h-full", LEVEL_BAR[level])} />;
}
