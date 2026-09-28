import { Router } from 'express';
import type { SatelliteGroup } from '@orbitdeck/shared';
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

  router.get('/progress', (_req, res) => {
    return res.json(tleService.getProgress());
  });

  router.get('/status', async (_req, res) => {
    try {
      const count = await satRepo.count();
      return res.json({
        totalSatellites: count,
        lastRefreshTime: tleService.getLastRefreshTime(),
        progress: tleService.getProgress(),
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.get('/sources', async (_req, res) => {
    try {
      const sources = await tleService.getSources();
      return res.json({ sources });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/sources', async (req, res) => {
    try {
      const { name, url, group } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Source name is required' });
      }
      if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) {
        return res.status(400).json({ error: 'A valid http(s) URL is required' });
      }

      const created = await tleService.addCustomSource({
        name,
        url,
        group: group as SatelliteGroup | undefined,
      });
      return res.status(201).json(created);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.delete('/sources/:id', async (req, res) => {
    try {
      const deleted = await tleService.removeCustomSource(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Custom source not found' });
      }
      return res.json({ success: true, id: req.params.id });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
