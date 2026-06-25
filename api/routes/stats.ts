/**
 * Statistics routes.
 */
import { Router, type Request, type Response } from 'express';
import { statsService } from '../services/statsService.js';

const router = Router();

/**
 * GET /api/stats/overview - overview statistics
 */
router.get('/overview', (req: Request, res: Response): void => {
  try {
    const data = statsService.getOverview();
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server internal error' });
  }
});

export default router;
