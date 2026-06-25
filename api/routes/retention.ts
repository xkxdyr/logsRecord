/**
 * 保留策略管理路由
 */
import { Router, type Request, type Response } from "express";
import { requireAdmin } from "../middleware/adminAuth.js";
import {
  getRetentionDays,
  setRetentionDays,
  runCleanup,
} from "../services/retentionService.js";

/**
 * 判断新保留天数是否比当前更短，更短时需要立即触发清理
 */
function isShrinking(newDays: number): boolean {
  return newDays < getRetentionDays();
}

const router = Router();

/**
 * GET /api/retention - 获取当前保留策略
 */
router.get("/", requireAdmin, (_req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    data: { retentionDays: getRetentionDays() },
  });
});

/**
 * PUT /api/retention - 更新保留天数
 * body: { retentionDays: number }
 */
router.put("/", requireAdmin, (req: Request, res: Response): void => {
  try {
    const days = Number(req.body?.retentionDays);
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      res.status(400).json({
        success: false,
        error: "retentionDays 必须为 1-365 之间的数字",
      });
      return;
    }
    // P1-4: 缩短保留天数时立即触发清理（异步，不阻塞响应），避免 1 小时窗口期违规
    const shrinking = isShrinking(days);
    setRetentionDays(days);
    if (shrinking) {
      runCleanup().catch((e) => console.error('[retention] 调整后清理失败:', e));
    }
    res.status(200).json({
      success: true,
      data: { retentionDays: getRetentionDays() },
    });
  } catch (err) {
    console.error("[retention] 更新失败:", err);
    res.status(500).json({ success: false, error: "Server internal error" });
  }
});

/**
 * POST /api/retention/cleanup - 手动触发清理（异步）
 */
router.post("/cleanup", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await runCleanup();
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("[retention] 手动清理失败:", err);
    res.status(500).json({ success: false, error: "Server internal error" });
  }
});

export default router;
