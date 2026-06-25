/**
 * Statistics service - assembles overview stats from repository methods.
 */
import {
  getOverviewStats,
  getLevelDistribution,
  getTopServices,
  getTrend,
} from '../repository/logRepository.js';
import { logService } from './logService.js';
import type { OverviewStats } from '../../shared/types.js';

class StatsService {
  getOverview(): OverviewStats {
    const base = getOverviewStats();
    const levelDistribution = getLevelDistribution();
    const topServices = getTopServices(10);
    const trend = getTrend(24);
    const currentEPS = logService.getCurrentEPS();

    return {
      totalLogs: base.totalLogs,
      todayLogs: base.todayLogs,
      errorCount: base.errorCount,
      serviceCount: base.serviceCount,
      currentEPS,
      levelDistribution,
      topServices,
      trend,
    };
  }
}

export const statsService = new StatsService();
export default statsService;
