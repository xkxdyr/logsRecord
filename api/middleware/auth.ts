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

function getDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
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
