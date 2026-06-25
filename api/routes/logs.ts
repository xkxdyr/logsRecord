/**
 * Log ingestion & query routes.
 */
import { Router, type Request, type Response } from 'express';
import { logService } from '../services/logService.js';
import { getRecentErrors } from '../repository/logRepository.js';
import { requireApiKey } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { validateIngestLog, validateBatchIngest } from '../middleware/validators.js';
import type { IngestLogRequest, QueryLogsParams, LogLevel } from '../../shared/types.js';

// requireApiKey 中间件挂载的鉴权服务信息
interface AuthedRequest extends Request {
  serviceInfo?: { id: number; name: string; api_key: string; tier: string };
}

const router = Router();

/**
 * POST /api/logs - ingest a single log (需要 API Key)
 * 安全：日志归属 service 强制取自鉴权令牌对应的 serviceInfo.name，
 *      客户端传入的 service 字段被忽略，杜绝跨服务冒名写入
 */
router.post('/', requireApiKey, validateIngestLog, (req: AuthedRequest, res: Response): void => {
  try {
    const { level, message, attributes } = req.body;
    const payload: IngestLogRequest = {
      service: req.serviceInfo!.name,
      level: level as LogLevel,
      message,
      attributes,
    };
    const result = logService.ingestLog(payload);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    console.error('[logs] ingest 失败:', err);
    res.status(500).json({ success: false, error: 'Server internal error' });
  }
});

/**
 * POST /api/logs/batch - ingest multiple logs (需要 API Key)
 * 全部预校验通过后，使用事务原子写入；任一条目失败则整体回滚
 * 安全：批量写入中每条 log 的 service 强制覆盖为 serviceInfo.name
 */
router.post('/batch', requireApiKey, validateBatchIngest, (req: AuthedRequest, res: Response): void => {
  try {
    const items: IngestLogRequest[] = Array.isArray(req.body) ? req.body : req.body?.logs;
    // 强制归属：批量中所有条目必须归属当前 API Key 对应的服务
    const serviceName = req.serviceInfo!.name;
    const safeItems = items.map((item) => ({ ...item, service: serviceName }));
    const results = logService.ingestBatch(safeItems);
    res.status(201).json({ success: true, data: results });
  } catch (err) {
    console.error('[logs] batch ingest 失败:', err);
    res.status(500).json({ success: false, error: 'Server internal error' });
  }
});

/**
 * GET /api/logs - query logs with filters & pagination (需要管理员令牌)
 */
router.get('/', requireAdmin, (req: Request, res: Response): void => {
  try {
    // 分页参数钳制：非有限数回退默认值，pageSize 上限 100 防止 OOM
    const rawPage = Number(req.query.page);
    const rawPageSize = Number(req.query.pageSize);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
    const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0
      ? Math.min(Math.floor(rawPageSize), 100)
      : 50;

    const params: QueryLogsParams = {
      service: req.query.service as string | undefined,
      level: (req.query.level as LogLevel | undefined) ?? '',
      keyword: req.query.keyword as string | undefined,
      startTime: req.query.startTime as string | undefined,
      endTime: req.query.endTime as string | undefined,
      page,
      pageSize,
    };
    const result = logService.queryLogs(params);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error('[logs] query 失败:', err);
    res.status(500).json({ success: false, error: 'Server internal error' });
  }
});

/**
 * GET /api/logs/recent-errors - recent ERROR/FATAL logs (需要管理员令牌)
 */
router.get('/recent-errors', requireAdmin, (req: Request, res: Response): void => {
  try {
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 100) : 10;
    const data = getRecentErrors(limit);
    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('[logs] recent-errors 失败:', err);
    res.status(500).json({ success: false, error: 'Server internal error' });
  }
});

export default router;
