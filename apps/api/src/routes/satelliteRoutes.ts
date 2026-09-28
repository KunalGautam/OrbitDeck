import { Router } from 'express';
import { SatelliteFilterSchema } from '@orbitdeck/shared';
import type { ISatelliteRepository } from '../db/repositories/satelliteRepository.js';
import type { TLEService } from '../services/tleService.js';

export function createSatelliteRouter(
  satRepo: ISatelliteRepository,
  tleService: TLEService,
): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const parsed = SatelliteFilterSchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.format() });
      }

      const { query, group, favoriteOnly, limit, offset } = parsed.data;
      const result = await satRepo.findAll({
        query,
        groups: group ? [group] : undefined,
        favoriteOnly,
        limit,
        offset,
      });

      const itemsWithStaleFlag = result.satellites.map((sat) => ({
        ...sat,
        isStale: tleService.isStale(sat),
      }));

      return res.json({
        satellites: itemsWithStaleFlag,
        total: result.total,
        limit,
        offset,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const noradId = parseInt(req.params.id, 10);
      if (isNaN(noradId)) {
        return res.status(400).json({ error: 'Invalid NORAD ID' });
      }

      const sat = await satRepo.findById(noradId);
      if (!sat) {
        return res.status(404).json({ error: 'Satellite not found' });
      }

      return res.json({
        ...sat,
        isStale: tleService.isStale(sat),
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/favorite', async (req, res) => {
    try {
      const noradId = parseInt(req.params.id, 10);
      const isFavorite = Boolean(req.body.isFavorite);

      const success = await satRepo.toggleFavorite(noradId, isFavorite);
      if (!success) {
        return res.status(404).json({ error: 'Satellite not found' });
      }

      return res.json({ noradId, isFavorite });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const noradId = parseInt(req.params.id, 10);
      const deleted = await satRepo.delete(noradId);
      if (!deleted) {
        return res.status(404).json({ error: 'Satellite not found' });
      }
      return res.json({ success: true, noradId });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
