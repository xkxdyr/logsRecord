import type {
  IngestLogRequest,
  IngestLogResponse,
  LogEntry,
  OverviewStats,
  QueryLogsParams,
  QueryLogsResponse,
  ServiceSource,
  KeyTier,
} from "../../shared/types";

const BASE = "/api";

// 管理员令牌：必须通过 VITE_ADMIN_TOKEN 显式注入（须与后端 ADMIN_TOKEN 一致）
// 安全说明：本令牌会被打包进客户端 bundle，仅适用于内部管理工具场景
// 生产环境强烈建议改造为服务端 BFF 代理管理请求，令牌仅存服务端
const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN as string | undefined;

// P0-3: 启动期不抛错（避免整个 bundle 加载失败白屏），改为首次调用时校验
// 校验失败时调用方 try/catch 可捕获并展示给用户
if (!ADMIN_TOKEN || ADMIN_TOKEN.length < 32) {
  console.error(
    "[security] VITE_ADMIN_TOKEN 未配置或长度不足 32，所有管理 API 调用将失败。请在 .env 中设置与后端 ADMIN_TOKEN 一致的强随机令牌。",
  );
}

/** 携带 HTTP 状态码的错误，便于调用方按状态码区分处理 */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** 获取管理员令牌（供 WebSocket 等场景使用） */
export function getAdminToken(): string {
  if (!ADMIN_TOKEN || ADMIN_TOKEN.length < 32) {
    throw new Error(
      "[security] VITE_ADMIN_TOKEN 未配置或长度不足 32，无法发起管理请求",
    );
  }
  return ADMIN_TOKEN;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  // P0-3: 延迟到首次 request 时校验，避免顶层 throw 导致白屏
  if (!ADMIN_TOKEN || ADMIN_TOKEN.length < 32) {
    throw new ApiError(
      500,
      "VITE_ADMIN_TOKEN 未配置或长度不足 32，请联系管理员配置 .env",
    );
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Admin-Token": ADMIN_TOKEN,
  };
  if (options?.headers) {
    Object.assign(headers, options.headers);
  }
  const res = await fetch(`${BASE}${url}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    // P2-7: 抛出带 status 的 ApiError，调用方可按 401/403/404/500 区分处理
    throw new ApiError(res.status, text || `HTTP ${res.status}`);
  }
  const json = await res.json();
  if (json && typeof json === "object" && "success" in json) {
    if (!json.success) {
      throw new ApiError(res.status, json.error || "Request failed");
    }
    return json.data as T;
  }
  return json as T;
}

export const api = {
  // 写入日志（需要 API Key）
  ingestLog: (data: IngestLogRequest, apiKey: string) =>
    request<IngestLogResponse>("/logs", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "X-API-Key": apiKey },
    }),

  ingestBatch: (data: IngestLogRequest[], apiKey: string) =>
    request<IngestLogResponse[]>("/logs/batch", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "X-API-Key": apiKey },
    }),

  // 查询日志
  queryLogs: (params: QueryLogsParams, signal?: AbortSignal) => {
    const qs = new URLSearchParams();
    if (params.service) qs.set("service", params.service);
    if (params.level) qs.set("level", params.level);
    if (params.keyword) qs.set("keyword", params.keyword);
    if (params.startTime) qs.set("startTime", params.startTime);
    if (params.endTime) qs.set("endTime", params.endTime);
    qs.set("page", String(params.page ?? 1));
    qs.set("pageSize", String(params.pageSize ?? 50));
    return request<QueryLogsResponse>(`/logs?${qs.toString()}`, { signal });
  },

  getRecentErrors: (limit = 10, signal?: AbortSignal) =>
    request<LogEntry[]>(`/logs/recent-errors?limit=${limit}`, { signal }),

  // 统计
  getOverview: (signal?: AbortSignal) =>
    request<OverviewStats>("/stats/overview", { signal }),

  // 服务管理
  getServices: () => request<ServiceSource[]>("/services"),
  addService: (name: string, tier?: KeyTier) =>
    request<ServiceSource>("/services", {
      method: "POST",
      body: JSON.stringify({ name, tier: tier ?? "free" }),
    }),
  updateServiceTier: (id: number, tier: KeyTier) =>
    request<void>(`/services/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ tier }),
    }),
  deleteService: (id: number) =>
    request<void>(`/services/${id}`, { method: "DELETE" }),

  // 保留策略
  getRetention: () => request<{ retentionDays: number }>("/retention"),
  updateRetention: (retentionDays: number) =>
    request<{ retentionDays: number }>("/retention", {
      method: "PUT",
      body: JSON.stringify({ retentionDays }),
    }),
  triggerCleanup: () =>
    request<{ deleted: number; retentionDays: number }>("/retention/cleanup", {
      method: "POST",
    }),

  // 种子数据
  seed: (count?: number) =>
    request<{ generated: number }>("/seed" + (count ? `?count=${count}` : ""), {
      method: "POST",
    }),
};
