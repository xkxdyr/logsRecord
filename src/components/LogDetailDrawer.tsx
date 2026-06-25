import { useEffect } from "react";
import type { LogEntry } from "../../shared/types";
import { LevelBadge } from "./LevelBadge";
import { X, Copy, Hash, Server, Clock, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogDetailDrawerProps {
  log: LogEntry | null;
  onClose: () => void;
}

// P2: 统一日期格式化，防御无效时间戳
function formatDateTime(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "时间无效";
  return d.toLocaleString("zh-CN");
}

export function LogDetailDrawer({ log, onClose }: LogDetailDrawerProps) {
  // P2 a11y: ESC 键关闭抽屉
  useEffect(() => {
    if (!log) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [log, onClose]);

  if (!log) return null;

  const handleCopy = async () => {
    // P2: clipboard 在非 HTTPS 或权限拒绝时会 reject，需 try/catch
    try {
      await navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    } catch {
      console.error("复制失败：剪贴板不可用");
    }
  };

  return (
    <>
      {/* 遮罩 */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* 抽屉 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="日志详情"
        className="fixed right-0 top-0 z-50 h-full w-full max-w-lg border-l border-base-500 bg-base-800 shadow-2xl animate-slide-in overflow-y-auto"
      >
        {/* 头部 */}
        <div className="sticky top-0 flex items-center justify-between border-b border-base-500 bg-base-800/95 px-5 py-4 backdrop-blur">
          <h3 className="font-display text-lg font-semibold text-white">日志详情</h3>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-base-600 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* 基本信息卡片 */}
          <div className="panel p-4 space-y-3">
            <div className="flex items-center gap-2">
              <LevelBadge level={log.level} />
              <span className="font-mono text-xs text-zinc-500">#{log.id.slice(0, 8)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoItem icon={<Server className="h-3.5 w-3.5" />} label="服务" value={log.service} />
              <InfoItem icon={<Hash className="h-3.5 w-3.5" />} label="级别" value={log.level} />
              <InfoItem
                icon={<Clock className="h-3.5 w-3.5" />}
                label="时间"
                value={formatDateTime(log.timestamp)}
              />
              <InfoItem icon={<FileText className="h-3.5 w-3.5" />} label="ID" value={log.id} mono />
            </div>
          </div>

          {/* 消息内容 */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-500">消息</h4>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 rounded text-xs text-zinc-500 transition-colors hover:text-amber"
              >
                <Copy className="h-3 w-3" /> 复制
              </button>
            </div>
            <pre className="panel p-4 font-mono text-sm text-zinc-200 whitespace-pre-wrap break-all">
              {log.message}
            </pre>
          </div>

          {/* 属性 */}
          {Object.keys(log.attributes).length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                属性 ({Object.keys(log.attributes).length})
              </h4>
              <div className="panel divide-y divide-base-600">
                {Object.entries(log.attributes).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-3 px-4 py-2">
                    <span className="shrink-0 font-mono text-xs text-amber/80">{key}</span>
                    <span className="flex-1 truncate font-mono text-xs text-zinc-300">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* JSON 原始数据 */}
          <div>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">JSON</h4>
            <pre className="panel p-4 font-mono text-xs text-teal/80 overflow-x-auto">
              {JSON.stringify(log, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </>
  );
}

function InfoItem({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1 text-xs text-zinc-400">
        {icon} {label}
      </span>
      <span className={cn("text-zinc-200 truncate", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}
