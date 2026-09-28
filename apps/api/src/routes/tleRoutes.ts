import { Router } from 'express';
import type { ISatelliteRepository } from '../db/repositories/satelliteRepository.js';
import type { TLEService } from '../services/tleService.js';

export function createTLERouter(satRepo: ISatelliteRepository, tleService: TLEService): Router {
  const router = Router();

  router.post('/refresh', async (_req, res) => {
    try {
      const result = await tleService.refreshAll();
      return res.json({
        success: true,
        message: `Successfully refreshed ${result.updated} satellites`,
        updated: result.updated,
        failedGroups: result.failedGroups,
        lastRefreshTime: tleService.getLastRefreshTime(),
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.get('/status', async (_req, res) => {
    try {
      const count = await satRepo.count();
      return res.json({
        totalSatellites: count,
        lastRefreshTime: tleService.getLastRefreshTime(),
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
