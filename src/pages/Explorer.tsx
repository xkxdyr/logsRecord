import { useEffect, useState, useCallback, useRef } from "react";
import { Search, Pause, Play, Trash2, Radio, ChevronDown } from "lucide-react";
import { Layout, PageHeader } from "@/components/Layout";
import { LogRow } from "@/components/LogRow";
import { LogDetailDrawer } from "@/components/LogDetailDrawer";
import { api } from "@/lib/api";
import { useLogStream } from "@/hooks/useLogStream";
import type { LogEntry, LogLevel } from "../../shared/types";
import { LEVELS } from "../../shared/types";
import { cn } from "@/lib/utils";

const TIME_RANGES = [
  { label: "15分钟", value: 15 },
  { label: "1小时", value: 60 },
  { label: "6小时", value: 360 },
  { label: "24小时", value: 1440 },
];

export default function Explorer() {
  const [historicalLogs, setHistoricalLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  // P1-3: 分离输入态与查询态，避免每个按键都触发查询（请求风暴）
  // 输入态：用户在 input 中实时输入的值，仅用于受控 input 显示
  // 查询态：点击"搜索"或回车后才更新，作为 fetchLogs 的依赖
  const [keywordInput, setKeywordInput] = useState("");
  const [serviceInput, setServiceInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [service, setService] = useState("");
  const [level, setLevel] = useState<LogLevel | "">("");
  const [timeRange, setTimeRange] = useState(60);
  const [page, setPage] = useState(1);
  const pageSize = 100;

  // 实时模式
  const [liveMode, setLiveMode] = useState(true);
  // P2-6 + P1-2: AbortController 真正传入 fetch 取消未完成请求
  const abortRef = useRef<AbortController | null>(null);

  const { isConnected, liveLogs, clearLogs } = useLogStream({
    service: service || undefined,
    level: level || undefined,
    enabled: liveMode,
  });

  const fetchLogs = useCallback(async () => {
    // 取消上一个未完成的请求
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - timeRange * 60 * 1000);
      // P1-2: 把 signal 真正传入 fetch，让旧请求在浏览器层被取消
      const res = await api.queryLogs(
        {
          service: service || undefined,
          level: level || undefined,
          keyword: keyword || undefined,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          page,
          pageSize,
        },
        ac.signal,
      );
      // 仅在请求未被取消时更新状态
      if (!ac.signal.aborted) {
        setHistoricalLogs(res.data);
        setTotal(res.total);
      }
    } catch (err) {
      // P1-2: 区分 AbortError 与真实错误
      if (ac.signal.aborted || (err as Error).name === "AbortError") return;
      console.error("Failed to fetch logs:", err);
    } finally {
      if (!ac.signal.aborted) {
        setLoading(false);
      }
    }
  }, [keyword, service, level, timeRange, page]);

  useEffect(() => {
    if (!liveMode) {
      fetchLogs();
    }
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchLogs, liveMode]);

  // P1-5: level/timeRange 变化时重置 page 为 1，避免页码越界返回空状态
  useEffect(() => {
    setPage(1);
  }, [level, timeRange]);

  const handleSearch = () => {
    // P1-3: 把输入态同步到查询态，触发 fetchLogs
    setKeyword(keywordInput.trim());
    setService(serviceInput.trim());
    // 仅重置页码，由 useEffect 监听 page 变化自动触发 fetchLogs，
    // 避免手动调用 fetchLogs() 时闭包捕获旧 page 导致重复请求和错误页码
    if (liveMode) {
      // 切到历史模式：清空实时缓冲，避免切换瞬间显示旧实时数据
      clearLogs();
      setLiveMode(false);
      setPage(1);
    } else {
      setPage(1);
    }
  };

  const toggleLiveMode = () => {
    if (!liveMode) {
      // 从历史切回实时：清空历史结果，避免显示陈旧数据
      setHistoricalLogs([]);
      setTotal(0);
    } else {
      clearLogs();
    }
    setLiveMode(!liveMode);
  };

  const displayLogs = liveMode ? liveLogs : historicalLogs;

  return (
    <Layout>
      <PageHeader
        title="日志探索"
        subtitle="实时流式检索 · 全文搜索 · 多维过滤"
        actions={
          <button
            onClick={toggleLiveMode}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors",
              liveMode
                ? "border-teal/30 bg-teal/10 text-teal"
                : "border-base-500 bg-base-700 text-zinc-300 hover:text-white",
            )}
          >
            {liveMode ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {liveMode ? "暂停实时" : "开启实时"}
          </button>
        }
      />

      {/* 过滤栏 */}
      <div className="border-b border-base-500 bg-base-800/50 px-8 py-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* 关键词搜索 */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="搜索日志内容..."
              aria-label="搜索日志内容"
              className="w-full rounded-lg border border-base-500 bg-base-700 py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition-colors focus:border-amber/50"
            />
          </div>

          {/* 服务过滤 */}
          <input
            type="text"
            value={serviceInput}
            onChange={(e) => setServiceInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="服务名"
            aria-label="服务名"
            className="w-40 rounded-lg border border-base-500 bg-base-700 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-amber/50"
          />

          {/* 级别过滤 */}
          <div className="relative">
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as LogLevel | "")}
              aria-label="日志级别"
              className="appearance-none rounded-lg border border-base-500 bg-base-700 py-2 pl-3 pr-8 text-sm text-zinc-200 outline-none focus:border-amber/50"
            >
              <option value="">全部级别</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          </div>

          {/* 时间范围 */}
          <div className="relative">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(Number(e.target.value))}
              aria-label="时间范围"
              className="appearance-none rounded-lg border border-base-500 bg-base-700 py-2 pl-3 pr-8 text-sm text-zinc-200 outline-none focus:border-amber/50"
            >
              {TIME_RANGES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          </div>

          <button
            onClick={handleSearch}
            className="rounded-lg bg-amber px-4 py-2 text-sm font-medium text-base-900 transition-colors hover:bg-amber/90"
          >
            搜索
          </button>

          {liveMode && (
            <button
              onClick={clearLogs}
              className="flex items-center gap-1.5 rounded-lg border border-base-500 px-3 py-2 text-sm text-zinc-400 transition-colors hover:text-white"
            >
              <Trash2 className="h-3.5 w-3.5" />
              清空
            </button>
          )}
        </div>

        {/* 状态条 */}
        <div className="mt-3 flex items-center gap-4 text-xs text-zinc-400">
          {liveMode ? (
            <>
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isConnected ? "bg-teal animate-pulse" : "bg-zinc-600",
                  )}
                />
                {isConnected ? "WebSocket 已连接" : "正在连接..."}
              </span>
              <span className="flex items-center gap-1 text-teal">
                <Radio className="h-3 w-3" /> 实时模式
              </span>
              <span>显示最近 {liveLogs.length} 条</span>
            </>
          ) : (
            <>
              <span>共 {total} 条结果</span>
              <span>第 {page} 页</span>
              {loading && <span className="text-amber">加载中...</span>}
            </>
          )}
        </div>
      </div>

      {/* 日志列表 */}
      <div className="panel mx-8 my-4 overflow-hidden">
        <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
          {displayLogs.length > 0 ? (
            displayLogs.map((log) => (
              <LogRow
                key={log.id}
                log={log}
                onClick={setSelectedLog}
                isSelected={selectedLog?.id === log.id}
              />
            ))
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-zinc-400">
              {liveMode ? "等待日志流入..." : "暂无匹配日志"}
            </div>
          )}
        </div>
      </div>

      {/* 分页（仅非实时模式） */}
      {!liveMode && total > pageSize && (
        <div className="flex items-center justify-center gap-2 pb-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-base-500 px-3 py-1.5 text-sm text-zinc-400 disabled:opacity-40 hover:text-white"
          >
            上一页
          </button>
          <span className="text-sm text-zinc-500">
            {page} / {Math.ceil(total / pageSize)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / pageSize)}
            className="rounded-lg border border-base-500 px-3 py-1.5 text-sm text-zinc-400 disabled:opacity-40 hover:text-white"
          >
            下一页
          </button>
        </div>
      )}

      <LogDetailDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />
    </Layout>
  );
}
