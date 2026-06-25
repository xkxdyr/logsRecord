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

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  const json = await res.json();
  if (json && typeof json === "object" && "success" in json) {
    if (!json.success) {
      throw new Error(json.error || "Request failed");
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
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    }),

  ingestBatch: (data: IngestLogRequest[], apiKey: string) =>
    request<IngestLogResponse[]>("/logs/batch", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    }),

  // 查询日志
  queryLogs: (params: QueryLogsParams) => {
    const qs = new URLSearchParams();
    if (params.service) qs.set("service", params.service);
    if (params.level) qs.set("level", params.level);
    if (params.keyword) qs.set("keyword", params.keyword);
    if (params.startTime) qs.set("startTime", params.startTime);
    if (params.endTime) qs.set("endTime", params.endTime);
    qs.set("page", String(params.page ?? 1));
    qs.set("pageSize", String(params.pageSize ?? 50));
    return request<QueryLogsResponse>(`/logs?${qs.toString()}`);
  },

  getRecentErrors: (limit = 10) =>
    request<LogEntry[]>(`/logs/recent-errors?limit=${limit}`),

  // 统计
  getOverview: () => request<OverviewStats>("/stats/overview"),

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

  // 种子数据
  seed: (count?: number) =>
    request<{ generated: number }>("/seed" + (count ? `?count=${count}` : ""), {
      method: "POST",
    }),
};
