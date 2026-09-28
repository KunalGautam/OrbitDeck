import { Router } from 'express';
import { PassQuerySchema } from '@orbitdeck/shared';
import type { ISatelliteRepository } from '../db/repositories/satelliteRepository.js';
import type { IGroundStationRepository } from '../db/repositories/stationRepository.js';
import type { PassPredictionService } from '../services/passPredictionService.js';

export function createPassRouter(
  satRepo: ISatelliteRepository,
  stationRepo: IGroundStationRepository,
  passService: PassPredictionService,
): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const parsed = PassQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.format() });
      }

      const { noradId, stationId, daysAhead, minElevationDeg, stepSeconds } = parsed.data;

      const sat = await satRepo.findById(noradId);
      if (!sat) {
        return res.status(404).json({ error: 'Satellite not found' });
      }

      const station = await stationRepo.findById(stationId);
      if (!station) {
        return res.status(404).json({ error: 'Ground station not found' });
      }

      const passes = passService.predictPasses(sat, station, {
        daysAhead,
        minElevationDeg,
        stepSeconds,
      });

      return res.json({
        noradId,
        satelliteName: sat.name,
        stationId,
        stationName: station.name,
        daysAhead,
        minElevationDeg,
        totalPasses: passes.length,
        passes,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.get('/export', async (req, res) => {
    try {
      const parsed = PassQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.format() });
      }

      const format = ((req.query.format as string) || 'ics').toLowerCase();
      const { noradId, stationId, daysAhead, minElevationDeg, stepSeconds } = parsed.data;

      const sat = await satRepo.findById(noradId);
      if (!sat) {
        return res.status(404).json({ error: 'Satellite not found' });
      }

      const station = await stationRepo.findById(stationId);
      if (!station) {
        return res.status(404).json({ error: 'Ground station not found' });
      }

      const passes = passService.predictPasses(sat, station, {
        daysAhead,
        minElevationDeg,
        stepSeconds,
      });

      if (format === 'csv') {
        const csv = passService.exportToCsv(passes);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="passes_${sat.noradId}_${Date.now()}.csv"`,
        );
        return res.send(csv);
      }

      // Default: iCal .ics
      const ics = passService.exportToIcs(passes);
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="passes_${sat.noradId}_${Date.now()}.ics"`,
      );
      return res.send(ics);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
