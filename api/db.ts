/**
 * SQLite database initialization (better-sqlite3)
 *
 * DB 路径解析优先级：
 *   1. process.env.DB_PATH —— 部署环境显式指定
 *   2. Vercel serverless 环境 → /tmp/logs.db（唯一可写分区）
 *   3. 代码同目录 logs.db —— 本地开发默认
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isServerless = !!(process.env.VERCEL || process.env.VERCEL_ENV);
const DB_PATH = process.env.DB_PATH
  || (isServerless ? '/tmp/logs.db' : path.resolve(__dirname, 'logs.db'));

// P0-5: Vercel serverless /tmp 临时性护栏
// /tmp 在函数实例间不共享，冷启动后可能被清空，导致 services 表与日志全部丢失
if (isServerless && !process.env.DB_PATH) {
  console.error(
    '[db] 警告：Vercel 环境下未设置 DB_PATH，使用 /tmp/logs.db 会导致冷启动丢数据（services 表清空后所有 API Key 鉴权 403）。' +
    ' 生产环境请配置 DB_PATH 指向持久化存储，或接入 Turso/LibSQL 等托管 SQLite。',
  );
}

export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
// busy_timeout：并发写入时等待锁最多 5 秒，避免立即抛 SQLITE_BUSY
// 场景：保留策略清理长事务期间，ingest 请求会排队等待而非立即失败
db.pragma('busy_timeout = 5000');

export function initDb(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      service TEXT NOT NULL,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_logs_service ON logs(service);
    CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);

    CREATE TABLE IF NOT EXISTS log_attributes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      log_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      FOREIGN KEY (log_id) REFERENCES logs(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_attr_log_id ON log_attributes(log_id);

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      api_key TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_services_api_key ON services(api_key);
  `);

  // 迁移：为已存在的 services 表添加 tier 字段（秘钥等级）
  const cols = db.prepare("PRAGMA table_info(services)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "tier")) {
    db.exec(`ALTER TABLE services ADD COLUMN tier TEXT NOT NULL DEFAULT 'free';`);
  }

  // 系统设置表：持久化保留策略等配置，重启不丢失
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export default db;
