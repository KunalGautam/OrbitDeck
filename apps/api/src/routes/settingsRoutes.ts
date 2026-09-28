import { Router } from 'express';
import type { ISettingsRepository } from '../db/repositories/settingsRepository.js';

export function createSettingsRouter(settingsRepo: ISettingsRepository): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const all = await settingsRepo.getAll();
      return res.json({ settings: all });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.get('/:key', async (req, res) => {
    try {
      const val = await settingsRepo.get(req.params.key);
      if (val === null) {
        return res.status(404).json({ error: 'Setting not found' });
      }
      return res.json({ key: req.params.key, value: val });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.put('/:key', async (req, res) => {
    try {
      const { value } = req.body;
      if (value === undefined) {
        return res.status(400).json({ error: 'Field "value" is required' });
      }
      await settingsRepo.set(req.params.key, value);
      return res.json({ key: req.params.key, value });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
