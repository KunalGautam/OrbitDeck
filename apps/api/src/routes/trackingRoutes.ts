import { Router } from 'express';
import type { ISatelliteRepository } from '../db/repositories/satelliteRepository.js';
import type { IGroundStationRepository } from '../db/repositories/stationRepository.js';
import type { PropagationService } from '../services/propagationService.js';
import type { TimeController } from '../services/timeController.js';

export function createTrackingRouter(
  satRepo: ISatelliteRepository,
  stationRepo: IGroundStationRepository,
  propService: PropagationService,
  timeController: TimeController,
): Router {
  const router = Router();

  router.get('/live', async (req, res) => {
    try {
      const stationId = req.query.stationId as string | undefined;
      const station = stationId
        ? await stationRepo.findById(stationId)
        : await stationRepo.findDefault();
      const currentTime = timeController.getCurrentTime();

      const noradIdsParam = req.query.noradIds as string | undefined;
      let satellites = [];

      if (noradIdsParam) {
        const ids = noradIdsParam
          .split(',')
          .map((id) => parseInt(id.trim(), 10))
          .filter((n) => !isNaN(n));
        const satPromises = ids.map((id) => satRepo.findById(id));
        const resolved = await Promise.all(satPromises);
        satellites = resolved.filter((s): s is NonNullable<typeof s> => s !== null);
      } else {
        const allRes = await satRepo.findAll({ limit: 100 });
        satellites = allRes.satellites;
      }

      const frames = satellites
        .map((sat) => propService.propagate(sat, currentTime, station))
        .filter((f): f is NonNullable<typeof f> => f !== null);

      const celestial = propService.getCelestialPositions(currentTime, station);

      return res.json({
        timestamp: currentTime,
        stationId: station?.id,
        frames,
        celestial,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id/track', async (req, res) => {
    try {
      const noradId = parseInt(req.params.id, 10);
      if (isNaN(noradId)) {
        return res.status(400).json({ error: 'Invalid NORAD ID' });
      }

      const sat = await satRepo.findById(noradId);
      if (!sat) {
        return res.status(404).json({ error: 'Satellite not found' });
      }

      const pastOrbits = parseFloat((req.query.pastOrbits as string) || '0.5');
      const futureOrbits = parseFloat((req.query.futureOrbits as string) || '1.0');
      const stepSeconds = parseInt((req.query.stepSeconds as string) || '60', 10);

      const currentTime = timeController.getCurrentTime();
      const trackPoints = propService.generateGroundTrack(
        sat,
        currentTime,
        pastOrbits,
        futureOrbits,
        stepSeconds,
      );

      return res.json({
        noradId,
        currentTime,
        points: trackPoints,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.get('/celestial', async (req, res) => {
    try {
      const stationId = req.query.stationId as string | undefined;
      const station = stationId
        ? await stationRepo.findById(stationId)
        : await stationRepo.findDefault();
      const currentTime = timeController.getCurrentTime();
      const positions = propService.getCelestialPositions(currentTime, station);
      return res.json({
        timestamp: currentTime,
        positions,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
