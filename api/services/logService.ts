/**
 * Log ingestion & query business logic.
 * Maintains a sliding window of ingestion timestamps for EPS calculation.
 */
import { v4 as uuidv4 } from 'uuid';
import {
  insertLog,
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
    while (this.ingestTimestamps.length > 0 && this.ingestTimestamps[0] < threshold) {
      this.ingestTimestamps.shift();
    }
  }
}

export const logService = new LogService();
export default logService;
