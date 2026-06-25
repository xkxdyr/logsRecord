// 共享类型定义 - 前后端通用

export type LogLevel = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";

export interface LogEntry {
  id: string;
  timestamp: string;
  service: string;
  level: LogLevel;
  message: string;
  attributes: Record<string, string>;
}

// 写入日志请求
export interface IngestLogRequest {
  service: string;
  level: LogLevel;
  message: string;
  attributes?: Record<string, string>;
}

export interface IngestLogResponse {
  id: string;
  timestamp: string;
  received: boolean;
}

// 查询日志
export interface QueryLogsParams {
  service?: string;
  level?: LogLevel | "";
  keyword?: string;
  startTime?: string;
  endTime?: string;
  page?: number;
  pageSize?: number;
}

export interface QueryLogsResponse {
  total: number;
  page: number;
  pageSize: number;
  data: LogEntry[];
}

// 统计
export interface LevelCount {
  level: string;
  count: number;
}

export interface ServiceCount {
  service: string;
  count: number;
}

export interface TrendPoint {
  time: string;
  INFO: number;
  WARN: number;
  ERROR: number;
  FATAL: number;
  DEBUG: number;
  TRACE: number;
}

export interface OverviewStats {
  totalLogs: number;
  todayLogs: number;
  errorCount: number;
  serviceCount: number;
  currentEPS: number;
  levelDistribution: LevelCount[];
  topServices: ServiceCount[];
  trend: TrendPoint[];
}

// WebSocket 消息
export interface WSMessage {
  type: "subscribe" | "log" | "stats" | "unsubscribe";
  filters?: { service?: string; level?: string };
  data?: LogEntry | { eps: number; total: number };
}

// 秘钥等级
export type KeyTier = "free" | "pro" | "enterprise";

export interface TierConfig {
  tier: KeyTier;
  label: string;
  rateLimitPerMin: number; // 每分钟速率上限（0 表示不限）
  dailyQuota: number; // 每日配额（0 表示不限）
  features: string[];
}

export const TIER_CONFIGS: Record<KeyTier, TierConfig> = {
  free: {
    tier: "free",
    label: "免费版",
    rateLimitPerMin: 100,
    dailyQuota: 10000,
    features: ["实时日志流", "全局保留策略", "基础检索"],
  },
  pro: {
    tier: "pro",
    label: "专业版",
    rateLimitPerMin: 1000,
    dailyQuota: 200000,
    features: ["实时日志流", "全局保留策略", "全文检索", "告警规则", "API 调用"],
  },
  enterprise: {
    tier: "enterprise",
    label: "企业版",
    rateLimitPerMin: 0,
    dailyQuota: 0,
    features: ["无限接入", "全局保留策略", "高级检索", "告警规则", "API 调用", "专属支持"],
  },
};

export const TIER_LIST: KeyTier[] = ["free", "pro", "enterprise"];

// 服务（数据源）
export interface ServiceSource {
  id: number;
  name: string;
  apiKey: string;
  tier: KeyTier;
  createdAt: string;
}

// 级别颜色映射
export const LEVEL_COLORS: Record<LogLevel, string> = {
  TRACE: "#64748b",
  DEBUG: "#818cf8",
  INFO: "#60a5fa",
  WARN: "#fbbf24",
  ERROR: "#f87171",
  FATAL: "#e879f9",
};

export const LEVELS: LogLevel[] = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"];
