import { Router } from 'express';
import type { HamlibService } from '../services/hamlibService.js';

export function createHamlibRouter(hamlibService: HamlibService): Router {
  const router = Router();

  router.get('/status', (_req, res) => {
    return res.json({
      config: hamlibService.getConfig(),
      status: hamlibService.getStatus(),
    });
  });

  router.post('/config', (req, res) => {
    hamlibService.updateConfig(req.body);
    return res.json({
      config: hamlibService.getConfig(),
      status: hamlibService.getStatus(),
    });
  });

  router.post('/rotator', async (req, res) => {
    const { azimuthDeg, elevationDeg } = req.body;
    if (typeof azimuthDeg !== 'number' || typeof elevationDeg !== 'number') {
      return res.status(400).json({ error: 'azimuthDeg and elevationDeg numbers are required' });
    }

    const success = await hamlibService.setRotatorPosition(azimuthDeg, elevationDeg);
    return res.json({ success, azimuthDeg, elevationDeg });
  });

  router.post('/frequency', async (req, res) => {
    const { frequencyHz } = req.body;
    if (typeof frequencyHz !== 'number') {
      return res.status(400).json({ error: 'frequencyHz number is required' });
    }

    const success = await hamlibService.setRadioFrequency(frequencyHz);
    return res.json({ success, frequencyHz });
  });

  return router;
}
