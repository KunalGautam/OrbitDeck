import { Router } from 'express';
import {
  CreateGroundStationSchema,
  UpdateGroundStationSchema,
  latLonToMaidenhead,
  maidenheadToLatLon,
} from '@orbitdeck/shared';
import type { IGroundStationRepository } from '../db/repositories/stationRepository.js';

export function createStationRouter(stationRepo: IGroundStationRepository): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const stations = await stationRepo.findAll();
      return res.json({ stations });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.get('/default', async (_req, res) => {
    try {
      const def = await stationRepo.findDefault();
      if (!def) {
        return res.status(404).json({ error: 'No default station configured' });
      }
      return res.json(def);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.get('/convert/maidenhead-to-coords', (req, res) => {
    const qth = req.query.locator as string;
    if (!qth) {
      return res.status(400).json({ error: 'Query parameter "locator" is required' });
    }
    try {
      const coords = maidenheadToLatLon(qth);
      return res.json(coords);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.get('/convert/coords-to-maidenhead', (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Valid "lat" and "lon" query parameters are required' });
    }
    try {
      const locator = latLonToMaidenhead(lat, lon, 6);
      return res.json({ maidenhead: locator });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const station = await stationRepo.findById(req.params.id);
      if (!station) {
        return res.status(404).json({ error: 'Ground station not found' });
      }
      return res.json(station);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const parsed = CreateGroundStationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.format() });
      }

      const created = await stationRepo.create(parsed.data);
      return res.status(201).json(created);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const parsed = UpdateGroundStationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.format() });
      }

      const updated = await stationRepo.update(req.params.id, parsed.data);
      if (!updated) {
        return res.status(404).json({ error: 'Ground station not found' });
      }
      return res.json(updated);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const deleted = await stationRepo.delete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Ground station not found' });
      }
      return res.json({ success: true, id: req.params.id });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/default', async (req, res) => {
    try {
      const success = await stationRepo.setDefault(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Ground station not found' });
      }
      return res.json({ success: true, id: req.params.id });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
