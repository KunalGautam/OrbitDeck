import { Router } from 'express';
import type { ISatelliteRepository } from '../db/repositories/satelliteRepository.js';
import type { IGroundStationRepository } from '../db/repositories/stationRepository.js';
import type { PropagationService } from '../services/propagationService.js';
import type { RadioService } from '../services/radioService.js';
import type { TimeController } from '../services/timeController.js';

export function createRadioRouter(
  satRepo: ISatelliteRepository,
  stationRepo: IGroundStationRepository,
  propService: PropagationService,
  radioService: RadioService,
  timeController: TimeController,
): Router {
  const router = Router();

  router.get('/:id/transponders', async (req, res) => {
    try {
      const noradId = parseInt(req.params.id, 10);
      if (isNaN(noradId)) {
        return res.status(400).json({ error: 'Invalid NORAD ID' });
      }

      const sat = await satRepo.findById(noradId);
      if (!sat) {
        return res.status(404).json({ error: 'Satellite not found' });
      }

      const transponders = await radioService.getTransponders(noradId);

      // Check if station provided to calculate live Doppler
      const stationId = req.query.stationId as string | undefined;
      const station = stationId
        ? await stationRepo.findById(stationId)
        : await stationRepo.findDefault();

      let rangeRateKmS = 0;
      let elevationDeg: number | undefined;
      let azimuthDeg: number | undefined;

      if (station) {
        const frame = propService.propagate(sat, timeController.getCurrentTime(), station);
        if (frame) {
          rangeRateKmS = frame.rangeRateKmS ?? 0;
          elevationDeg = frame.elevationDeg;
          azimuthDeg = frame.azimuthDeg;
        }
      }

      // If client supplied custom rangeRate
      if (req.query.rangeRateKmS !== undefined) {
        rangeRateKmS = parseFloat(req.query.rangeRateKmS as string);
      }

      const liveTransponders = transponders.map((tp) =>
        radioService.calculateDopplerState(tp, rangeRateKmS),
      );

      return res.json({
        noradId,
        satelliteName: sat.name,
        rangeRateKmS,
        elevationDeg,
        azimuthDeg,
        transponders: liveTransponders,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
