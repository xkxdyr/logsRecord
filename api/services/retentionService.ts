/**
 * 日志保留策略服务 - 定时清理过期日志
 * 保留天数持久化到 settings 表，重启不丢失
 */
import { db } from '../db.js';
import { deleteOldLogs } from '../repository/logRepository.js';

const SETTING_KEY = 'retention_days';
const DEFAULT_RETENTION_DAYS = 30;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 每小时执行一次

let currentRetentionDays = DEFAULT_RETENTION_DAYS;
let cleanupTimer: NodeJS.Timeout | null = null;
// P1-2: 并发锁，防止定时器与手动触发同时执行
let isCleaning = false;

function loadRetentionFromDb(): number {
  const row = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(SETTING_KEY) as { value: string } | undefined;
  if (row) {
    const n = Number(row.value);
    if (Number.isFinite(n) && n >= 1 && n <= 365) {
      return Math.floor(n);
    }
  }
  return DEFAULT_RETENTION_DAYS;
}

function saveRetentionToDb(days: number): void {
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
  ).run(SETTING_KEY, String(days));
}

export function getRetentionDays(): number {
  return currentRetentionDays;
}

export function setRetentionDays(days: number): void {
  if (!Number.isFinite(days) || days < 1 || days > 365) {
    throw new Error('保留天数必须在 1-365 之间');
  }
  const rounded = Math.floor(days);
  currentRetentionDays = rounded;
  // 持久化到数据库，重启后生效
  saveRetentionToDb(rounded);
}

/**
 * 执行清理（异步，每批之间让出事件循环）
 * P1-2: 并发锁，重入时返回 skipped
 * P1-3: deleteOldLogs 内部每批间 await setImmediate 让出事件循环
 */
export async function runCleanup(): Promise<{ deleted: number; retentionDays: number; skipped?: boolean }> {
  if (isCleaning) {
    return { deleted: 0, retentionDays: currentRetentionDays, skipped: true };
  }
  isCleaning = true;
  try {
    const deleted = await deleteOldLogs(currentRetentionDays);
    console.log(`[retention] 清理完成：删除 ${deleted} 条超过 ${currentRetentionDays} 天的日志`);
    return { deleted, retentionDays: currentRetentionDays };
  } finally {
    isCleaning = false;
  }
}

/**
 * 启动保留策略定时任务
 * P1-1: 启动时用 setImmediate 延迟执行首次清理，不阻塞 server.listen
 */
export function startRetentionJob(): void {
  if (cleanupTimer) return;
  // 加载持久化配置，避免重启后用默认值误清或漏清
  currentRetentionDays = loadRetentionFromDb();
  console.log(`[retention] 已加载保留策略：${currentRetentionDays} 天`);
  // P1-1: 延迟执行首次清理，让 server.listen 先完成
  setImmediate(() => {
    runCleanup().catch((err) => console.error('[retention] 启动清理失败:', err));
  });
  cleanupTimer = setInterval(() => {
    runCleanup().catch((err) => console.error('[retention] 定时清理失败:', err));
  }, CLEANUP_INTERVAL_MS);
  if (cleanupTimer.unref) cleanupTimer.unref();
  console.log(`[retention] 定时任务已启动，每 ${CLEANUP_INTERVAL_MS / 1000 / 60} 分钟执行一次`);
}

export function stopRetentionJob(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
