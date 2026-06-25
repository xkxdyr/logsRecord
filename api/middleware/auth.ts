/**
 * API Key 认证 + 按等级限流中间件
 */
import type { Request, Response, NextFunction } from "express";
import { db } from "../db.js";
import { TIER_CONFIGS } from "../../shared/types.js";
import type { KeyTier } from "../../shared/types.js";

interface ServiceRow {
  id: number;
  name: string;
  api_key: string;
  tier: string;
}

// 限流：内存滑动窗口 { apiKey: number[] 时间戳 }
const rateBuckets = new Map<string, number[]>();
const WINDOW_MS = 60_000; // 1 分钟

// 日配额：内存计数 { `${apiKey}:${dateKey}`: count }
const quotaCounters = new Map<string, number>();

// 清理周期
const CLEANUP_INTERVAL_MS = 5 * 60_000; // 每 5 分钟清理一次
let lastCleanupAt = 0;

function getDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * 清理过期计数器，避免内存泄漏
 * - 删除非当天的 quota 计数
 * - 检查 rate bucket 中的 key 是否仍对应有效服务，否则删除
 * P1-4: 仅在实际清理时（5 分钟一次）查询 DB，而非每请求查询
 */
function cleanupCountersIfNeeded(): void {
  const now = Date.now();
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;

  // 仅在清理时查询有效 API Keys
  const allKeys = db.prepare("SELECT api_key FROM services").all() as { api_key: string }[];
  const validApiKeys = new Set(allKeys.map((r) => r.api_key));

  const todayKey = getDateKey();

  // 清理过期 quota
  for (const key of quotaCounters.keys()) {
    const parts = key.split(":");
    const dateKey = parts.slice(1).join("-");
    if (dateKey !== todayKey) {
      quotaCounters.delete(key);
    }
  }

  // 清理已删除服务的计数器
  for (const apiKey of rateBuckets.keys()) {
    if (!validApiKeys.has(apiKey)) {
      rateBuckets.delete(apiKey);
    }
  }
  for (const key of quotaCounters.keys()) {
    const apiKey = key.split(":")[0];
    if (!validApiKeys.has(apiKey)) {
      quotaCounters.delete(key);
    }
  }
}

function checkRateLimit(apiKey: string, tier: KeyTier): { ok: boolean; retryAfter?: number } {
  const config = TIER_CONFIGS[tier];
  if (config.rateLimitPerMin === 0) return { ok: true }; // 不限速

  const now = Date.now();
  const bucket = rateBuckets.get(apiKey) ?? [];
  const valid = bucket.filter((t) => now - t < WINDOW_MS);
  if (valid.length >= config.rateLimitPerMin) {
    const oldest = valid[0];
    const retryAfter = Math.ceil((WINDOW_MS - (now - oldest)) / 1000);
    return { ok: false, retryAfter };
  }
  valid.push(now);
  rateBuckets.set(apiKey, valid);
  return { ok: true };
}

function checkQuota(apiKey: string, tier: KeyTier): { ok: boolean; remaining: number } {
  const config = TIER_CONFIGS[tier];
  if (config.dailyQuota === 0) return { ok: true, remaining: Infinity };

  const key = `${apiKey}:${getDateKey()}`;
  const used = quotaCounters.get(key) ?? 0;
  if (used >= config.dailyQuota) {
    return { ok: false, remaining: 0 };
  }
  quotaCounters.set(key, used + 1);
  return { ok: true, remaining: config.dailyQuota - used - 1 };
}

/**
 * 验证 X-API-Key 并按等级限流
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.header("X-API-Key");
  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: "缺少 API Key，请在请求头携带 X-API-Key",
    });
    return;
  }

  const stmt = db.prepare(
    "SELECT id, name, api_key, tier FROM services WHERE api_key = ?",
  );
  const row = stmt.get(apiKey) as ServiceRow | undefined;
  if (!row) {
    res.status(403).json({
      success: false,
      error: "无效的 API Key",
    });
    return;
  }

  const tier = row.tier as KeyTier;

  // 定期清理过期/无效计数器（内部按 5 分钟频率限流，不再每请求查 DB）
  cleanupCountersIfNeeded();

  // 速率限制
  const rate = checkRateLimit(apiKey, tier);
  if (!rate.ok) {
    res.status(429).json({
      success: false,
      error: `请求过于频繁，${TIER_CONFIGS[tier].label}限速 ${TIER_CONFIGS[tier].rateLimitPerMin} 次/分钟`,
      retryAfter: rate.retryAfter,
    });
    return;
  }

  // 日配额
  const quota = checkQuota(apiKey, tier);
  if (!quota.ok) {
    res.status(429).json({
      success: false,
      error: `已达每日配额上限 ${TIER_CONFIGS[tier].dailyQuota} 次`,
    });
    return;
  }

  // 挂载服务信息供后续使用
  (req as Request & { serviceInfo?: ServiceRow }).serviceInfo = row;
  next();
}
