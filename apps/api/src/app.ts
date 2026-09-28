import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { ISatelliteRepository } from './db/repositories/satelliteRepository.js';
import type { ISettingsRepository } from './db/repositories/settingsRepository.js';
import type { IGroundStationRepository } from './db/repositories/stationRepository.js';
import { createHamlibRouter } from './routes/hamlibRoutes.js';
import { createPassRouter } from './routes/passRoutes.js';
import { createRadioRouter } from './routes/radioRoutes.js';
import { createSatelliteRouter } from './routes/satelliteRoutes.js';
import { createSettingsRouter } from './routes/settingsRoutes.js';
import { createStationRouter } from './routes/stationRoutes.js';
import { createTLERouter } from './routes/tleRoutes.js';
import { createTrackingRouter } from './routes/trackingRoutes.js';
import type { HamlibService } from './services/hamlibService.js';
import type { PassPredictionService } from './services/passPredictionService.js';
import type { PropagationService } from './services/propagationService.js';
import type { RadioService } from './services/radioService.js';
import type { TimeController } from './services/timeController.js';
import type { TLEService } from './services/tleService.js';

export interface AppDependencies {
  satRepo: ISatelliteRepository;
  stationRepo: IGroundStationRepository;
  settingsRepo: ISettingsRepository;
  tleService: TLEService;
  propService: PropagationService;
  passService: PassPredictionService;
  radioService: RadioService;
  hamlibService: HamlibService;
  timeController: TimeController;
}

export function createApp(deps: AppDependencies): Express {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'orbitdeck-api',
      time: new Date().toISOString(),
      timestamp: Date.now(),
    });
  });

  // Time controller API
  app.get('/api/time', (_req, res) => {
    res.json(deps.timeController.getState());
  });

  app.post('/api/time/action', (req, res) => {
    const action = req.body;
    if (!action || !action.type) {
      return res.status(400).json({ error: 'Valid TimeControlAction is required' });
    }
    const newState = deps.timeController.handleAction(action);
    return res.json(newState);
  });

  // Domain routers
  app.use('/api/satellites', createSatelliteRouter(deps.satRepo, deps.tleService));
  app.use('/api/tle', createTLERouter(deps.satRepo, deps.tleService));
  app.use('/api/stations', createStationRouter(deps.stationRepo));
  app.use(
    '/api/tracking',
    createTrackingRouter(deps.satRepo, deps.stationRepo, deps.propService, deps.timeController),
  );
  app.use('/api/passes', createPassRouter(deps.satRepo, deps.stationRepo, deps.passService));
  app.use(
    '/api/radio',
    createRadioRouter(
      deps.satRepo,
      deps.stationRepo,
      deps.propService,
      deps.radioService,
      deps.timeController,
    ),
  );
  app.use('/api/hamlib', createHamlibRouter(deps.hamlibService));
  app.use('/api/settings', createSettingsRouter(deps.settingsRepo));

  return app;
}
