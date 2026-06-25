/**
 * SQLite database initialization (better-sqlite3)
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, 'logs.db');

export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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
  `);

  // 迁移：为已存在的 services 表添加 tier 字段（秘钥等级）
  const cols = db.prepare("PRAGMA table_info(services)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "tier")) {
    db.exec(`ALTER TABLE services ADD COLUMN tier TEXT NOT NULL DEFAULT 'free';`);
  }
}

export default db;
