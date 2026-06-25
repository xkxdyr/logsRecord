/**
 * Data access layer for logs, attributes and services.
 */
import { db } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import type {
  LogEntry,
  QueryLogsParams,
  QueryLogsResponse,
  LevelCount,
  ServiceCount,
  TrendPoint,
  ServiceSource,
} from '../../shared/types.js';

interface LogRow {
  id: string;
  timestamp: string;
  service: string;
  level: string;
  message: string;
  created_at: string;
}

interface AttrRow {
  key: string;
  value: string | null;
}

interface CountRow {
  count: number;
}

interface LevelCountRow {
  level: string;
  count: number;
}

interface ServiceCountRow {
  service: string;
  count: number;
}

interface TrendRow {
  time: string;
  level: string;
  count: number;
}

function mapRowToLogEntry(row: LogRow, attrs: AttrRow[]): LogEntry {
  const attributes: Record<string, string> = {};
  for (const a of attrs) {
    attributes[a.key] = a.value ?? '';
  }
  return {
    id: row.id,
    timestamp: row.timestamp,
    service: row.service,
    level: row.level as LogEntry['level'],
    message: row.message,
    attributes,
  };
}

interface AttrRowWithLogId extends AttrRow {
  log_id: string;
}

/**
 * 批量查询多条日志的属性，避免 N+1 查询。
 * 返回 Map<logId, AttrRow[]>，调用方按 id 分组即可。
 */
function fetchAttributesBatch(logIds: string[]): Map<string, AttrRow[]> {
  const result = new Map<string, AttrRow[]>();
  if (logIds.length === 0) return result;
  // 用 IN 批量查询；SQLite 参数上限足够大，pageSize<=100 安全
  const placeholders = logIds.map(() => '?').join(',');
  const stmt = db.prepare(
    `SELECT log_id, key, value FROM log_attributes WHERE log_id IN (${placeholders})`,
  );
  const rows = stmt.all(...logIds) as AttrRowWithLogId[];
  for (const row of rows) {
    let arr = result.get(row.log_id);
    if (!arr) {
      arr = [];
      result.set(row.log_id, arr);
    }
    arr.push({ key: row.key, value: row.value });
  }
  return result;
}

export function insertLog(log: LogEntry): void {
  const insertLogStmt = db.prepare(
    `INSERT INTO logs (id, timestamp, service, level, message) VALUES (?, ?, ?, ?, ?)`,
  );
  const insertAttrStmt = db.prepare(
    `INSERT INTO log_attributes (log_id, key, value) VALUES (?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    insertLogStmt.run(log.id, log.timestamp, log.service, log.level, log.message);
    for (const [key, value] of Object.entries(log.attributes || {})) {
      insertAttrStmt.run(log.id, key, value);
    }
  });
  tx();
}

/**
 * 批量写入：使用单一事务，任一条目失败则整体回滚
 */
export function insertLogsBatch(logs: LogEntry[]): void {
  const insertLogStmt = db.prepare(
    `INSERT INTO logs (id, timestamp, service, level, message) VALUES (?, ?, ?, ?, ?)`,
  );
  const insertAttrStmt = db.prepare(
    `INSERT INTO log_attributes (log_id, key, value) VALUES (?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    for (const log of logs) {
      insertLogStmt.run(log.id, log.timestamp, log.service, log.level, log.message);
      for (const [key, value] of Object.entries(log.attributes || {})) {
        insertAttrStmt.run(log.id, key, value);
      }
    }
  });
  tx();
}

export function queryLogs(params: QueryLogsParams): QueryLogsResponse {
  const {
    service,
    level,
    keyword,
    startTime,
    endTime,
    page = 1,
    pageSize = 50,
  } = params;

  const conditions: string[] = [];
  const args: unknown[] = [];

  if (service) {
    conditions.push('service = ?');
    args.push(service);
  }
  if (level) {
    conditions.push('level = ?');
    args.push(level);
  }
  if (keyword) {
    conditions.push('message LIKE ?');
    args.push(`%${keyword}%`);
  }
  if (startTime) {
    conditions.push('timestamp >= ?');
    args.push(startTime);
  }
  if (endTime) {
    conditions.push('timestamp <= ?');
    args.push(endTime);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM logs ${whereClause}`);
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  const offset = (safePage - 1) * safePageSize;

  const dataStmt = db.prepare(
    `SELECT id, timestamp, service, level, message, created_at
     FROM logs
     ${whereClause}
     ORDER BY timestamp DESC, id DESC
     LIMIT ? OFFSET ?`,
  );

  // P1-3: COUNT 与 SELECT 包入事务，避免 WAL 模式下 deleteOldLogs 批次提交导致 total 与 data 不一致
  const { total, rows } = db.transaction(() => {
    const t = (countStmt.get(...args) as CountRow).count;
    const r = dataStmt.all(...args, safePageSize, offset) as LogRow[];
    return { total: t, rows: r };
  })();

  // 批量查询属性，避免 N+1（原 pageSize=100 会执行 101 次 SQL，现仅 2 次）
  const attrsMap = fetchAttributesBatch(rows.map((r) => r.id));
  const data: LogEntry[] = rows.map((row) =>
    mapRowToLogEntry(row, attrsMap.get(row.id) ?? []),
  );

  return {
    total,
    page: safePage,
    pageSize: safePageSize,
    data,
  };
}

export function getOverviewStats(): {
  totalLogs: number;
  todayLogs: number;
  errorCount: number;
  serviceCount: number;
} {
  const totalStmt = db.prepare('SELECT COUNT(*) as count FROM logs');
  const totalLogs = (totalStmt.get() as CountRow).count;

  // P0-4: 修复 todayLogs 时区错配
  //   - 必须追加 'utc' 修饰符把本地午夜转回 UTC，否则 UTC+8 下少算 8 小时今日日志
  //   - 用 %f（含毫秒）对齐 timestamp 列格式，避免 00:00:00.000~00:00:00.999 的日志被字符串比较排除
  const todayStartStmt = db.prepare(
    `SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now', 'localtime', 'start of day', 'utc') as cutoff`,
  );
  const todayCutoff = (todayStartStmt.get() as { cutoff: string }).cutoff;
  const todayStmt = db.prepare(
    `SELECT COUNT(*) as count FROM logs WHERE timestamp >= ?`,
  );
  const todayLogs = (todayStmt.get(todayCutoff) as CountRow).count;

  const errorStmt = db.prepare(
    `SELECT COUNT(*) as count FROM logs WHERE level IN ('ERROR', 'FATAL')`,
  );
  const errorCount = (errorStmt.get() as CountRow).count;

  // P1: 从 services 表统计，反映"配置的数据源数"而非"曾发过日志的服务数"
  //   - 避免日志过期清理后 serviceCount 下降
  //   - 避免未发日志的新服务被漏算
  //   - 避免未注册的服务名（如拼写错误）被误算
  const serviceStmt = db.prepare('SELECT COUNT(*) as count FROM services');
  const serviceCount = (serviceStmt.get() as CountRow).count;

  return { totalLogs, todayLogs, errorCount, serviceCount };
}

export function getLevelDistribution(): LevelCount[] {
  const stmt = db.prepare(
    `SELECT level, COUNT(*) as count FROM logs GROUP BY level ORDER BY count DESC`,
  );
  return stmt.all() as LevelCountRow[];
}

export function getTopServices(limit = 10): ServiceCount[] {
  const stmt = db.prepare(
    `SELECT service, COUNT(*) as count FROM logs GROUP BY service ORDER BY count DESC LIMIT ?`,
  );
  return stmt.all(limit) as ServiceCountRow[];
}

export function getTrend(hours = 24): TrendPoint[] {
  // 趋势按本地时区分桶，更贴合用户感知的时间轴
  // 关键修复：边界值必须与 timestamp 列格式（ISO 8601 带 'T'）一致，
  // 否则字符串字典序比较会因 'T'(0x54) > ' '(0x20) 导致窗口扩大失真
  // 用 %f 含毫秒，避免秒级边界 0~999ms 的日志被错误排除
  const stmt = db.prepare(
    `SELECT strftime('%Y-%m-%dT%H:00:00', timestamp, 'localtime') as time, level, COUNT(*) as count
     FROM logs
     WHERE timestamp >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?)
     GROUP BY time, level
     ORDER BY time ASC`,
  );
  const rows = stmt.all(`-${hours} hours`) as TrendRow[];

  const map = new Map<string, TrendPoint>();
  for (const row of rows) {
    let point = map.get(row.time);
    if (!point) {
      point = {
        time: row.time,
        INFO: 0,
        WARN: 0,
        ERROR: 0,
        FATAL: 0,
        DEBUG: 0,
        TRACE: 0,
      };
      map.set(row.time, point);
    }
    const lvl = row.level as keyof Omit<TrendPoint, 'time'>;
    if (lvl in point) {
      point[lvl] = row.count;
    }
  }

  return Array.from(map.values());
}

export function getRecentErrors(limit = 10): LogEntry[] {
  const stmt = db.prepare(
    `SELECT id, timestamp, service, level, message, created_at
     FROM logs
     WHERE level IN ('ERROR', 'FATAL')
     ORDER BY timestamp DESC
     LIMIT ?`,
  );
  const rows = stmt.all(limit) as LogRow[];
  // 批量查询属性，避免 N+1
  const attrsMap = fetchAttributesBatch(rows.map((r) => r.id));
  return rows.map((row) => mapRowToLogEntry(row, attrsMap.get(row.id) ?? []));
}

export function countByTimeRange(startTime: string, endTime: string): number {
  const stmt = db.prepare(
    `SELECT COUNT(*) as count FROM logs WHERE timestamp >= ? AND timestamp <= ?`,
  );
  return (stmt.get(startTime, endTime) as CountRow).count;
}

export async function deleteOldLogs(days: number): Promise<number> {
  // 按本地时区计算过期边界：本地时间 X 天前 00:00 对应的 UTC ISO 字符串
  // 直接用 timestamp < ? 走 idx_logs_timestamp 索引，避免 date() 函数导致全表扫描
  const now = new Date();
  const cutoff = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - days,
    0, 0, 0, 0,
  );
  const cutoffISO = cutoff.toISOString();

  let totalDeleted = 0;
  // 分批删除，每批 1000 条，每批独立提交，避免长事务阻塞 ingest 写入
  // 子查询走索引取 id，外层按主键删除
  const deleteStmt = db.prepare(
    `DELETE FROM logs WHERE id IN (
       SELECT id FROM logs WHERE timestamp < ? ORDER BY timestamp ASC LIMIT 1000
     )`,
  );
  while (true) {
    const info = deleteStmt.run(cutoffISO);
    totalDeleted += info.changes;
    if (info.changes < 1000) break;
    // P1-3: 每批之间让出事件循环，避免同步循环阻塞所有 HTTP 请求
    await new Promise((resolve) => setImmediate(resolve));
  }
  return totalDeleted;
}

export function getServices(): ServiceSource[] {
  // P2-2: 用 strftime 统一输出 ISO UTC 格式，与 addService 返回值一致
  const stmt = db.prepare(
    `SELECT id, name, api_key as apiKey, tier,
     strftime('%Y-%m-%dT%H:%M:%SZ', created_at) as createdAt
     FROM services ORDER BY id ASC`,
  );
  return stmt.all() as ServiceSource[];
}

export function addService(name: string, tier: string = "free"): ServiceSource {
  const apiKey = uuidv4();
  const stmt = db.prepare(
    `INSERT INTO services (name, api_key, tier) VALUES (?, ?, ?)`,
  );
  const info = stmt.run(name, apiKey, tier);
  // P2-2: 返回 DB 实际值（与 getServices 格式一致），而非 JS 生成的 ISO
  const created = db.prepare(
    `SELECT strftime('%Y-%m-%dT%H:%M:%SZ', created_at) as createdAt FROM services WHERE id = ?`,
  ).get(info.lastInsertRowid) as { createdAt: string };
  return {
    id: Number(info.lastInsertRowid),
    name,
    apiKey,
    tier: tier as ServiceSource["tier"],
    createdAt: created.createdAt,
  };
}

export function getServiceByApiKey(apiKey: string): { id: number; name: string; tier: string } | undefined {
  const stmt = db.prepare(
    `SELECT id, name, tier FROM services WHERE api_key = ?`,
  );
  return stmt.get(apiKey) as { id: number; name: string; tier: string } | undefined;
}

export function updateServiceTier(id: number, tier: string): boolean {
  const stmt = db.prepare(`UPDATE services SET tier = ? WHERE id = ?`);
  const info = stmt.run(tier, id);
  return info.changes > 0;
}

export function deleteService(id: number): boolean {
  // P2-1: SELECT 移入事务，避免 TOCTOU
  // log_attributes 通过 FOREIGN KEY ON DELETE CASCADE 自动清理
  const getStmt = db.prepare('SELECT name FROM services WHERE id = ?');
  const delLogsStmt = db.prepare('DELETE FROM logs WHERE service = ?');
  const delSvcStmt = db.prepare('DELETE FROM services WHERE id = ?');

  const tx = db.transaction(() => {
    const svc = getStmt.get(id) as { name: string } | undefined;
    if (!svc) return false;
    delLogsStmt.run(svc.name);
    const info = delSvcStmt.run(id);
    return info.changes > 0;
  });
  return tx();
}
