import http from 'http';
import dotenv from 'dotenv';
import { createApp } from './app.js';
import {
  GroundStationRepository,
  SatelliteRepository,
  SettingsRepository,
  getDatabase,
  runMigrations,
  seedDatabase,
} from './db/index.js';
import { HamlibService } from './services/hamlibService.js';
import { PassPredictionService } from './services/passPredictionService.js';
import { PropagationService } from './services/propagationService.js';
import { RadioService } from './services/radioService.js';
import { TimeController } from './services/timeController.js';
import { TLEService } from './services/tleService.js';
import { OrbitDeckWebSocketServer } from './websocket/server.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

export async function bootstrap() {
  console.log('🛰️ Initializing OrbitDeck API server...');

  // Database setup
  const db = getDatabase();

  const runMigrationsFlag = process.env.DB_RUN_MIGRATIONS !== 'false';
  if (runMigrationsFlag) {
    console.log('Running database migrations...');
    await runMigrations(db);
  }

  // Seed default stations and configuration
  await seedDatabase(db);

  // Initialize Repositories
  const satRepo = new SatelliteRepository(db);
  const stationRepo = new GroundStationRepository(db);
  const settingsRepo = new SettingsRepository(db);

  // Initialize Services
  const tleService = new TLEService(satRepo, settingsRepo);
  const propService = new PropagationService();
  const passService = new PassPredictionService(propService);
  const radioService = new RadioService();
  const hamlibService = new HamlibService();
  const timeController = new TimeController();

  // Initialize TLE catalogue (seed defaults if empty, start cron)
  await tleService.initialize();

  // Create Express App
  const app = createApp({
    satRepo,
    stationRepo,
    settingsRepo,
    tleService,
    propService,
    passService,
    radioService,
    hamlibService,
    timeController,
  });

  // Create HTTP Server & WebSocket
  const server = http.createServer(app);
  const wsServer = new OrbitDeckWebSocketServer(satRepo, stationRepo, propService, timeController, {
    updateIntervalMs: 1000,
  });
  wsServer.attach(server);

  server.listen(PORT, HOST, () => {
    console.log(`🚀 OrbitDeck API is listening at http://${HOST}:${PORT}`);
    console.log(`🔌 WebSocket available at ws://${HOST}:${PORT}/ws`);
  });

  const shutdown = async () => {
    console.log('\nShutting down OrbitDeck server...');
    wsServer.close();
    tleService.stopScheduledRefresh();
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return { app, server, wsServer };
}

// Start if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  bootstrap().catch((err) => {
    console.error('Fatal bootstrap error:', err);
    process.exit(1);
  });
}
