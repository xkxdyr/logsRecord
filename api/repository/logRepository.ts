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

function fetchAttributes(logId: string): AttrRow[] {
  const stmt = db.prepare('SELECT key, value FROM log_attributes WHERE log_id = ?');
  return stmt.all(logId) as AttrRow[];
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
  const total = (countStmt.get(...args) as CountRow).count;

  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  const offset = (safePage - 1) * safePageSize;

  const dataStmt = db.prepare(
    `SELECT id, timestamp, service, level, message, created_at
     FROM logs
     ${whereClause}
     ORDER BY timestamp DESC
     LIMIT ? OFFSET ?`,
  );

  const rows = dataStmt.all(...args, safePageSize, offset) as LogRow[];

  const data: LogEntry[] = rows.map((row) =>
    mapRowToLogEntry(row, fetchAttributes(row.id)),
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

  const todayStmt = db.prepare(
    `SELECT COUNT(*) as count FROM logs WHERE date(timestamp) = date('now')`,
  );
  const todayLogs = (todayStmt.get() as CountRow).count;

  const errorStmt = db.prepare(
    `SELECT COUNT(*) as count FROM logs WHERE level IN ('ERROR', 'FATAL')`,
  );
  const errorCount = (errorStmt.get() as CountRow).count;

  const serviceStmt = db.prepare(
    `SELECT COUNT(DISTINCT service) as count FROM logs`,
  );
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
  const stmt = db.prepare(
    `SELECT strftime('%Y-%m-%dT%H:00:00', timestamp) as time, level, COUNT(*) as count
     FROM logs
     WHERE timestamp >= datetime('now', ?)
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
  return rows.map((row) => mapRowToLogEntry(row, fetchAttributes(row.id)));
}

export function countByTimeRange(startTime: string, endTime: string): number {
  const stmt = db.prepare(
    `SELECT COUNT(*) as count FROM logs WHERE timestamp >= ? AND timestamp <= ?`,
  );
  return (stmt.get(startTime, endTime) as CountRow).count;
}

export function deleteOldLogs(days: number): number {
  const stmt = db.prepare(
    `DELETE FROM logs WHERE timestamp < datetime('now', ?)`,
  );
  const info = stmt.run(`-${days} days`);
  return info.changes;
}

export function getServices(): ServiceSource[] {
  const stmt = db.prepare(
    `SELECT id, name, api_key as apiKey, tier, created_at as createdAt FROM services ORDER BY id ASC`,
  );
  return stmt.all() as ServiceSource[];
}

export function addService(name: string, tier: string = "free"): ServiceSource {
  const apiKey = uuidv4();
  const stmt = db.prepare(
    `INSERT INTO services (name, api_key, tier) VALUES (?, ?, ?)`,
  );
  const info = stmt.run(name, apiKey, tier);
  return {
    id: Number(info.lastInsertRowid),
    name,
    apiKey,
    tier: tier as ServiceSource["tier"],
    createdAt: new Date().toISOString(),
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
  const stmt = db.prepare(`DELETE FROM services WHERE id = ?`);
  const info = stmt.run(id);
  return info.changes > 0;
}
