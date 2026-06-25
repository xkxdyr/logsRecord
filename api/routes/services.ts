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
import { TIER_LIST } from '../../shared/types.js';
import type { KeyTier } from '../../shared/types.js';

const router = Router();

/**
 * GET /api/services - list all services
 */
router.get('/', (req: Request, res: Response): void => {
  try {
    const data = getServices();
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server internal error' });
  }
});

/**
 * POST /api/services - add a new service
 * body: { name: string, tier?: KeyTier }
 */
router.post('/', (req: Request, res: Response): void => {
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
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server internal error' });
  }
});

/**
 * PATCH /api/services/:id - update service (e.g. tier)
 */
router.patch('/:id', (req: Request, res: Response): void => {
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
    res.status(500).json({ success: false, error: 'Server internal error' });
  }
});

/**
 * DELETE /api/services/:id - delete a service
 */
router.delete('/:id', (req: Request, res: Response): void => {
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
    res.status(500).json({ success: false, error: 'Server internal error' });
  }
});

export default router;
