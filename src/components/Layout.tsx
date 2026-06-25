import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-base-900 bg-grid">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden bg-radial-amber">
        <div className="flex-1 overflow-y-auto">{children}</div>
        <footer className="border-t border-base-600 bg-base-800/50 px-8 py-2">
          <div className="flex items-center justify-between text-xs text-zinc-600">
            <span>LogVerse · 智能日志宇宙</span>
            <a
              href="https://beian.miit.gov.cn/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 transition-colors hover:text-amber"
            >
              <span>湘ICP备2026025107号</span>
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between border-b border-base-500 px-8 py-5">
      <div>
        <h2 className="font-display text-2xl font-bold text-white">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
