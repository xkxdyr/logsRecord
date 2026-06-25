import type { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  trend?: number;
  accent?: "amber" | "teal" | "blue" | "red";
  subtitle?: string;
}

const ACCENT_STYLES = {
  amber: { glow: "shadow-[0_0_24px_-8px_rgba(245,166,35,0.4)]", icon: "text-amber", border: "hover:border-amber/30" },
  teal: { glow: "shadow-[0_0_24px_-8px_rgba(45,212,191,0.4)]", icon: "text-teal", border: "hover:border-teal/30" },
  blue: { glow: "shadow-[0_0_24px_-8px_rgba(96,165,250,0.3)]", icon: "text-blue-400", border: "hover:border-blue-500/30" },
  red: { glow: "shadow-[0_0_24px_-8px_rgba(248,113,113,0.3)]", icon: "text-red-400", border: "hover:border-red-500/30" },
};

export function StatCard({ label, value, icon, trend, accent = "amber", subtitle }: StatCardProps) {
  const styles = ACCENT_STYLES[accent];
  return (
    <div
      className={cn(
        "panel panel-hover p-5 transition-all duration-300",
        styles.glow,
        styles.border,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
          <p className="mt-2 font-display text-3xl font-bold text-white tabular-nums">
            {value}
          </p>
          {subtitle && <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>}
        </div>
        <div className={cn("rounded-lg bg-base-600 p-2.5", styles.icon)}>{icon}</div>
      </div>
      {trend !== undefined && (
        <div className="mt-3 flex items-center gap-1.5">
          {trend >= 0 ? (
            <TrendingUp className="h-3.5 w-3.5 text-teal" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-red-400" />
          )}
          <span className={cn("text-xs font-medium", trend >= 0 ? "text-teal" : "text-red-400")}>
            {trend >= 0 ? "+" : ""}
            {trend}%
          </span>
          <span className="text-xs text-zinc-600">vs 上1h</span>
        </div>
      )}
    </div>
  );
}
