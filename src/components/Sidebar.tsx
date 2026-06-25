import { NavLink } from "react-router-dom";
import { LayoutDashboard, Search, Send, Settings, Activity, LifeBuoy } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "总览", icon: LayoutDashboard, desc: "Dashboard" },
  { to: "/explorer", label: "日志探索", icon: Search, desc: "Explorer" },
  { to: "/ingest", label: "数据接入", icon: Send, desc: "Ingest" },
  { to: "/settings", label: "系统设置", icon: Settings, desc: "Settings" },
  { to: "/help", label: "帮助手册", icon: LifeBuoy, desc: "Help" },
];

export function Sidebar() {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-base-500 bg-base-800">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-base-500 px-5 py-5">
        <div className="relative">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber to-amber/60 shadow-lg shadow-amber/20">
            <Activity className="h-5 w-5 text-base-900" strokeWidth={2.5} />
          </div>
          <div className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-teal ring-2 ring-base-800 animate-pulse" />
        </div>
        <div>
          <h1 className="font-display text-lg font-bold leading-none text-white">LogVerse</h1>
          <p className="mt-0.5 text-[10px] uppercase tracking-widest text-zinc-400">
            智能日志宇宙
          </p>
        </div>
      </div>

      {/* 导航 */}
      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200",
                isActive
                  ? "bg-base-600 text-amber shadow-sm"
                  : "text-zinc-500 hover:bg-base-700 hover:text-zinc-200",
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn("h-4.5 w-4.5 transition-colors", isActive && "text-amber")}
                  strokeWidth={1.75}
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium leading-none">{item.label}</span>
                  <span className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-400">
                    {item.desc}
                  </span>
                </div>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* 底部状态 */}
      <div className="border-t border-base-500 p-4">
        <div className="flex items-center gap-2 rounded-lg bg-base-700 px-3 py-2">
          <div className="h-2 w-2 rounded-full bg-teal animate-pulse" />
          <span className="text-xs text-zinc-400">系统运行中</span>
          <span className="ml-auto font-mono text-[10px] text-zinc-400">v1.0.0</span>
        </div>
      </div>
    </aside>
  );
}
