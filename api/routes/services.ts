/**
 * Service (data source) management routes.
 */
import { Router, type Request, type Response } from 'express';
import {
  getServices,
  addService,
  deleteService,
  updateServiceTier,
} from '../repository/logRepository.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { TIER_LIST } from '../../shared/types.js';
import type { KeyTier } from '../../shared/types.js';

const router = Router();

/**
 * GET /api/services - list all services (需要管理员令牌)
 */
router.get('/', requireAdmin, (_req: Request, res: Response): void => {
  try {
    const data = getServices();
    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('[services] list 失败:', err);
    res.status(500).json({ success: false, error: 'Server internal error' });
  }
});

/**
 * POST /api/services - add a new service (需要管理员令牌)
 * body: { name: string, tier?: KeyTier }
 */
router.post('/', requireAdmin, (req: Request, res: Response): void => {
  try {
    const name = req.body?.name;
    const tier = (req.body?.tier as KeyTier) ?? 'free';
    if (!name || typeof name !== 'string') {
      res.status(400).json({ success: false, error: 'name is required' });
      return;
    }
    if (!TIER_LIST.includes(tier)) {
      res.status(400).json({ success: false, error: `tier must be one of: ${TIER_LIST.join(', ')}` });
      return;
    }
    const data = addService(name, tier);
    res.status(201).json({ success: true, data });
  } catch (err: unknown) {
    // P1-3: 重名违反 UNIQUE 约束时返回 409，而非 500
    const code = (err as { code?: string })?.code;
    if (code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ success: false, error: `服务名 "${name}" 已存在` });
      return;
    }
    console.error('[services] add 失败:', err);
    res.status(500).json({ success: false, error: 'Server internal error' });
  }
});

/**
 * PATCH /api/services/:id - update service (e.g. tier) (需要管理员令牌)
 */
router.patch('/:id', requireAdmin, (req: Request, res: Response): void => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, error: 'invalid id' });
      return;
    }
    const tier = req.body?.tier as KeyTier;
    if (!TIER_LIST.includes(tier)) {
      res.status(400).json({ success: false, error: `tier must be one of: ${TIER_LIST.join(', ')}` });
      return;
    }
    const ok = updateServiceTier(id, tier);
    if (!ok) {
      res.status(404).json({ success: false, error: 'service not found' });
      return;
    }
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('[services] update 失败:', err);
    res.status(500).json({ success: false, error: 'Server internal error' });
  }
});

/**
 * DELETE /api/services/:id - delete a service (需要管理员令牌)
 * 会级联删除该服务的全部日志及其属性
 */
router.delete('/:id', requireAdmin, (req: Request, res: Response): void => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, error: 'invalid id' });
      return;
    }
    const ok = deleteService(id);
    if (!ok) {
      res.status(404).json({ success: false, error: 'service not found' });
      return;
    }
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('[services] delete 失败:', err);
    res.status(500).json({ success: false, error: 'Server internal error' });
  }
});

export default router;
