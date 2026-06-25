import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import {
  Database,
  AlertTriangle,
  Server,
  Zap,
  RefreshCw,
  Radio,
} from "lucide-react";
import { Layout, PageHeader } from "@/components/Layout";
import { StatCard } from "@/components/StatCard";
import { LogRow } from "@/components/LogRow";
import { LogDetailDrawer } from "@/components/LogDetailDrawer";
import { api } from "@/lib/api";
import { useLogStream } from "@/hooks/useLogStream";
import type { OverviewStats, LogEntry } from "../../shared/types";
import { LEVEL_COLORS } from "../../shared/types";

const PIE_COLORS = ["#60a5fa", "#fbbf24", "#f87171", "#e879f9", "#818cf8", "#64748b"];

// P2 性能：提取内联对象为模块级常量，避免每次渲染新建引用导致 Recharts 不必要重渲染
const AREA_CHART_MARGIN = { top: 5, right: 5, bottom: 0, left: -20 };
const BAR_CHART_MARGIN = { left: 20, right: 20 };
const TOOLTIP_STYLE = {
  backgroundColor: "#141416",
  border: "1px solid #232328",
  borderRadius: "8px",
  fontSize: "12px",
};
const TOOLTIP_LABEL_STYLE = { color: "#a1a1aa" };
const BAR_CURSOR = { fill: "#1a1a1e" };

export default function Dashboard() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [recentErrors, setRecentErrors] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  // P1-8: 用 reqId 防止 interval/handleRefresh 场景下的竞态
  // reqId 确保只有最新请求的结果能 setState，旧请求即使返回也被丢弃
  // 不使用 AbortController.abort()，避免 StrictMode dev 双重调用 effect 时产生 ERR_ABORTED 日志
  const reqIdRef = useRef(0);

  const fetchStats = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    try {
      const [overview, errors] = await Promise.all([
        api.getOverview(),
        api.getRecentErrors(8),
      ]);
      // 仅最新请求的结果才能 setState，避免乱序覆盖
      if (reqId !== reqIdRef.current) return;
      setStats(overview);
      // 按 id 去重合并：DB 查询结果为主，保留实时已收到但 DB 暂未返回的条目，
      // 避免实时流与轮询双源相互覆盖或重复
      setRecentErrors((prev) => {
        const seen = new Set(errors.map((e) => e.id));
        const liveOnly = prev.filter((e) => !seen.has(e.id));
        return [...errors, ...liveOnly]
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
          .slice(0, 8);
      });
    } catch (err) {
      if (reqId !== reqIdRef.current) return;
      console.error("Failed to fetch stats:", err);
    } finally {
      if (reqId === reqIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // 实时流 - 用于实时展示异常日志
  // 错误总数以 stats.errorCount（数据库值）为准，实时错误会写入 DB 后被下次轮询捕获，
  // 不再单独累加，避免双重计数
  useLogStream({
    enabled: true,
    collectLogs: false,
    onLog: (log) => {
      if (log.level === "ERROR" || log.level === "FATAL") {
        setRecentErrors((prev) => {
          // 去重：避免同一 id 重复加入
          if (prev.some((e) => e.id === log.id)) return prev;
          return [log, ...prev].slice(0, 8);
        });
      }
    },
  });

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const handleRefresh = () => {
    setLoading(true);
    fetchStats();
  };

  // P2 性能：用 useMemo 避免每次渲染都重新计算并创建新数组引用
  const trendData = useMemo(() => stats?.trend.map((t) => ({
    time: t.time.slice(11, 16),
    INFO: t.INFO,
    WARN: t.WARN,
    ERROR: t.ERROR,
    FATAL: t.FATAL,
  })) ?? [], [stats?.trend]);

  const pieData = useMemo(() => stats?.levelDistribution.map((l) => ({
    name: l.level,
    value: l.count,
  })) ?? [], [stats?.levelDistribution]);

  const barData = useMemo(() => stats?.topServices.map((s) => ({
    name: s.service,
    count: s.count,
  })) ?? [], [stats?.topServices]);

  return (
    <Layout>
      <PageHeader
        title="总览仪表盘"
        subtitle="实时监控日志吞吐、级别分布与服务健康度"
        actions={
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 rounded-lg border border-base-500 bg-base-700 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-base-400 hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            刷新
          </button>
        }
      />

      <div className="space-y-6 p-8">
        {/* KPI 卡片 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="实时 EPS"
            value={stats?.currentEPS ?? 0}
            icon={<Zap className="h-5 w-5" />}
            accent="amber"
            subtitle="每秒入库事件数"
          />
          <StatCard
            label="总日志数"
            value={formatNumber(stats?.totalLogs ?? 0)}
            icon={<Database className="h-5 w-5" />}
            accent="teal"
            subtitle="全部存储日志"
          />
          <StatCard
            label="今日入库"
            value={formatNumber(stats?.todayLogs ?? 0)}
            icon={<Database className="h-5 w-5" />}
            accent="blue"
            subtitle="今日新增日志"
          />
          <StatCard
            label="错误日志"
            value={formatNumber(stats?.errorCount ?? 0)}
            icon={<AlertTriangle className="h-5 w-5" />}
            accent="red"
            subtitle="ERROR + FATAL"
          />
          <StatCard
            label="服务数"
            value={stats?.serviceCount ?? 0}
            icon={<Server className="h-5 w-5" />}
            accent="teal"
            subtitle="活跃数据源"
          />
        </div>

        {/* 图表区 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* 趋势图 */}
          <div className="panel p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-white">24h 日志趋势</h3>
              <div className="flex items-center gap-3 text-xs">
                {(["INFO", "WARN", "ERROR", "FATAL"] as const).map((lvl) => (
                  <span key={lvl} className="flex items-center gap-1.5 text-zinc-500">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: LEVEL_COLORS[lvl] }}
                    />
                    {lvl}
                  </span>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trendData} margin={AREA_CHART_MARGIN}>
                <defs>
                  {(["INFO", "WARN", "ERROR", "FATAL"] as const).map((lvl) => (
                    <linearGradient key={lvl} id={`grad-${lvl}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={LEVEL_COLORS[lvl]} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={LEVEL_COLORS[lvl]} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#232328" vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke="#52525b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval={3}
                />
                <YAxis stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                />
                {(["INFO", "WARN", "ERROR", "FATAL"] as const).map((lvl) => (
                  <Area
                    key={lvl}
                    type="monotone"
                    dataKey={lvl}
                    stackId="1"
                    stroke={LEVEL_COLORS[lvl]}
                    strokeWidth={1.5}
                    fill={`url(#grad-${lvl})`}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* 级别分布饼图 */}
          <div className="panel p-5">
            <h3 className="mb-4 font-display text-base font-semibold text-white">级别分布</h3>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((d, i) => (
                      <Cell key={d.name} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#141416" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {pieData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className="text-zinc-500">{d.name}</span>
                  <span className="ml-auto font-mono text-zinc-400">{formatNumber(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top 服务 + 异常流 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Top 服务 */}
          <div className="panel p-5">
            <h3 className="mb-4 font-display text-base font-semibold text-white">Top 服务</h3>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} layout="vertical" margin={BAR_CHART_MARGIN}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#232328" horizontal={false} />
                  <XAxis type="number" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#52525b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    cursor={BAR_CURSOR}
                  />
                  <Bar dataKey="count" fill="#f5a623" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </div>

          {/* 异常流 */}
          <div className="panel flex flex-col">
            <div className="flex items-center justify-between border-b border-base-500 px-5 py-4">
              <h3 className="font-display text-base font-semibold text-white">实时异常流</h3>
              <span className="flex items-center gap-1.5 text-xs text-red-400">
                <Radio className="h-3 w-3 animate-pulse" />
                LIVE
              </span>
            </div>
            <div className="flex-1 overflow-y-auto" style={{ maxHeight: 260 }}>
              {recentErrors.length > 0 ? (
                recentErrors.map((log) => (
                  <LogRow key={log.id} log={log} onClick={setSelectedLog} />
                ))
              ) : (
                <div className="flex h-full items-center justify-center p-8 text-sm text-zinc-400">
                  暂无异常日志
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <LogDetailDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />
    </Layout>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function EmptyChart() {
  return (
    <div className="flex h-[220px] items-center justify-center text-sm text-zinc-400">
      暂无数据
    </div>
  );
}
