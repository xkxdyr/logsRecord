/**
 * Log ingestion & query routes.
 */
import { Router, type Request, type Response } from 'express';
import { logService } from '../services/logService.js';
import { getRecentErrors } from '../repository/logRepository.js';
import { requireApiKey } from '../middleware/auth.js';
import type {
  IngestLogRequest,
  QueryLogsParams,
  LogLevel,
} from '../../shared/types.js';

const router = Router();

/**
 * POST /api/logs - ingest a single log (需要 API Key)
 */
router.post('/', requireApiKey, (req: Request, res: Response): void => {
  try {
    const { service, level, message, attributes } = req.body ?? {};
    if (!service || !level || !message) {
      res.status(400).json({
        success: false,
        error: 'service, level and message are required',
      });
      return;
    }
    const payload: IngestLogRequest = {
      service,
      level: level as LogLevel,
      message,
      attributes,
    };
    const result = logService.ingestLog(payload);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server internal error' });
  }
});

/**
 * POST /api/logs/batch - ingest multiple logs (需要 API Key)
 */
router.post('/batch', requireApiKey, (req: Request, res: Response): void => {
  try {
    const items: IngestLogRequest[] = Array.isArray(req.body) ? req.body : req.body?.logs;
    if (!Array.isArray(items)) {
      res.status(400).json({
        success: false,
        error: 'expected an array of logs or { logs: [...] }',
      });
      return;
    }
    const results = items.map((item) => logService.ingestLog(item));
    res.status(201).json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server internal error' });
  }
});

/**
 * GET /api/logs - query logs with filters & pagination
 */
router.get('/', (req: Request, res: Response): void => {
  try {
    const params: QueryLogsParams = {
      service: req.query.service as string | undefined,
      level: (req.query.level as LogLevel | undefined) ?? '',
      keyword: req.query.keyword as string | undefined,
      startTime: req.query.startTime as string | undefined,
      endTime: req.query.endTime as string | undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 50,
    };
    const result = logService.queryLogs(params);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server internal error' });
  }
});

/**
 * GET /api/logs/recent-errors - recent ERROR/FATAL logs
 */
router.get('/recent-errors', (req: Request, res: Response): void => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const data = getRecentErrors(limit);
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server internal error' });
  }
});

export default router;
