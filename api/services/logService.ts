/**
 * Log ingestion & query business logic.
 * Maintains a sliding window of ingestion timestamps for EPS calculation.
 */
import { v4 as uuidv4 } from 'uuid';
import {
  insertLog,
  insertLogsBatch,
  queryLogs as repoQueryLogs,
} from '../repository/logRepository.js';
import { broadcaster } from '../ws/broadcaster.js';
import type {
  LogEntry,
  IngestLogRequest,
  IngestLogResponse,
  QueryLogsParams,
  QueryLogsResponse,
} from '../../shared/types.js';

const EPS_WINDOW_MS = 60_000; // 60 seconds sliding window
const EPS_RECENT_MS = 1_000; // last 1 second for currentEPS

class LogService {
  private ingestTimestamps: number[] = [];

  ingestLog(req: IngestLogRequest): IngestLogResponse {
    const id = uuidv4();
    const timestamp = new Date().toISOString();

    const log: LogEntry = {
      id,
      timestamp,
      service: req.service,
      level: req.level,
      message: req.message,
      attributes: req.attributes ?? {},
    };

    insertLog(log);

    broadcaster.broadcast(log);

    const now = Date.now();
    this.ingestTimestamps.push(now);
    this.pruneWindow(now);

    return {
      id,
      timestamp,
      received: true,
    };
  }

  queryLogs(params: QueryLogsParams): QueryLogsResponse {
    return repoQueryLogs(params);
  }

  /**
   * 批量写入：使用数据库事务保证原子性，全部成功或全部回滚
   */
  ingestBatch(reqs: IngestLogRequest[]): IngestLogResponse[] {
    const now = new Date();
    const timestamp = now.toISOString();
    const entries: LogEntry[] = reqs.map((req) => ({
      id: uuidv4(),
      timestamp,
      service: req.service,
      level: req.level,
      message: req.message,
      attributes: req.attributes ?? {},
    }));

    // 事务写入，任一失败则抛错回滚
    insertLogsBatch(entries);

    // 写入成功后再广播，避免回滚后已推送实时流
    // P2-3: 异步广播，不阻塞 HTTP 响应
    setImmediate(() => {
      for (const log of entries) {
        broadcaster.broadcast(log);
      }
    });

    const nowMs = Date.now();
    this.ingestTimestamps.push(...new Array(entries.length).fill(nowMs));
    this.pruneWindow(nowMs);

    return entries.map((e) => ({ id: e.id, timestamp: e.timestamp, received: true }));
  }

  getCurrentEPS(): number {
    const now = Date.now();
    this.pruneWindow(now);
    const threshold = now - EPS_RECENT_MS;
    return this.ingestTimestamps.filter((t) => t >= threshold).length;
  }

  getTotalInWindow(): number {
    this.pruneWindow(Date.now());
    return this.ingestTimestamps.length;
  }

  private pruneWindow(now: number): void {
    const threshold = now - EPS_WINDOW_MS;
    // 时间戳单调递增，用 findIndex 找到第一个 >= threshold 的位置，一次性截断
    // 避免 shift() 的 O(n²) 退化（高 EPS 下每次 shift 触发数组重排）
    const arr = this.ingestTimestamps;
    if (arr.length === 0) return;
    // 快速路径：最新时间戳都过期（极端情况），全清
    if (arr[arr.length - 1] < threshold) {
      this.ingestTimestamps = [];
      return;
    }
    // 二分查找第一个 >= threshold 的位置
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (arr[mid] < threshold) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) {
      this.ingestTimestamps = arr.slice(lo);
    }
  }
}

export const logService = new LogService();
export default logService;
