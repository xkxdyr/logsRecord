/**
 * Statistics routes.
 */
import { Router, type Request, type Response } from 'express';
import { statsService } from '../services/statsService.js';
import { requireAdmin } from '../middleware/adminAuth.js';

const router = Router();

/**
 * GET /api/stats/overview - overview statistics (需要管理员令牌)
 */
router.get('/overview', requireAdmin, (_req: Request, res: Response): void => {
  try {
    const data = statsService.getOverview();
    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('[stats] overview 失败:', err);
    res.status(500).json({ success: false, error: 'Server internal error' });
  }
});

export default router;
