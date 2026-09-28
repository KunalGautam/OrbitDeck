import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { Kysely } from 'kysely';
import { createApp } from './app.js';
import {
  createDatabaseConnection,
  runMigrations,
  seedDatabase,
  SatelliteRepository,
  GroundStationRepository,
  SettingsRepository,
} from './db/index.js';
import type { Database as DatabaseSchema } from './db/types.js';
import { HamlibService } from './services/hamlibService.js';
import { PassPredictionService } from './services/passPredictionService.js';
import { PropagationService } from './services/propagationService.js';
import { RadioService } from './services/radioService.js';
import { TimeController } from './services/timeController.js';
import { TLEService } from './services/tleService.js';
import { DEFAULT_SATELLITES } from './services/tleFallbackData.js';

describe('Express REST API Endpoints', () => {
  let db: Kysely<DatabaseSchema>;
  let app: Express;
  let satRepo: SatelliteRepository;
  let stationRepo: GroundStationRepository;

  beforeEach(async () => {
    db = createDatabaseConnection({ isTest: true });
    await runMigrations(db);
    await seedDatabase(db);

    satRepo = new SatelliteRepository(db);
    await satRepo.upsertMany(DEFAULT_SATELLITES);
    stationRepo = new GroundStationRepository(db);
    const settingsRepo = new SettingsRepository(db);

    const tleService = new TLEService(satRepo, settingsRepo);
    const propService = new PropagationService();
    const passService = new PassPredictionService(propService);
    const radioService = new RadioService();
    const hamlibService = new HamlibService();
    const timeController = new TimeController();

    app = createApp({
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
  });

  afterEach(async () => {
    await db.destroy();
  });

  it('GET /api/health should return ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('orbitdeck-api');
  });

  it('GET /api/satellites should list seeded satellites with stale flag', async () => {
    const res = await request(app).get('/api/satellites');
    expect(res.status).toBe(200);
    expect(res.body.satellites.length).toBeGreaterThan(0);
    expect(res.body.total).toBeGreaterThan(0);

    const iss = res.body.satellites.find((s: any) => s.noradId === 25544);
    expect(iss).toBeDefined();
    expect(iss.name).toBe('ISS (ZARYA)');
    expect(iss.isStale).toBeDefined();
  });

  it('GET /api/satellites?query=ISS should filter satellites', async () => {
    const res = await request(app).get('/api/satellites?query=ISS');
    expect(res.status).toBe(200);
    expect(res.body.satellites.length).toBe(1);
    expect(res.body.satellites[0].noradId).toBe(25544);
  });

  it('POST /api/satellites/:id/favorite should toggle favorite', async () => {
    const res = await request(app)
      .post('/api/satellites/25544/favorite')
      .send({ isFavorite: true });
    expect(res.status).toBe(200);
    expect(res.body.isFavorite).toBe(true);

    const check = await satRepo.findById(25544);
    expect(check?.isFavorite).toBe(true);
  });

  it('GET /api/stations should return seeded ground stations', async () => {
    const res = await request(app).get('/api/stations');
    expect(res.status).toBe(200);
    expect(res.body.stations.length).toBe(3);
    expect(res.body.stations[0].isDefault).toBe(true);
  });

  it('GET /api/stations/convert/coords-to-maidenhead should convert coordinates', async () => {
    const res = await request(app).get(
      '/api/stations/convert/coords-to-maidenhead?lat=48.137&lon=11.575',
    );
    expect(res.status).toBe(200);
    expect(res.body.maidenhead.toUpperCase()).toBe('JN58SD');
  });

  it('POST /api/stations should create a new ground station with maidenhead', async () => {
    const res = await request(app).post('/api/stations').send({
      name: 'Sydney QTH',
      latitude: -33.8688,
      longitude: 151.2093,
      altitude: 20,
      maidenhead: 'QF22mb',
    });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Sydney QTH');
    expect(res.body.maidenhead.toUpperCase()).toBe('QF22MB');
  });

  it('GET /api/tracking/live should return live tracking frame for ISS', async () => {
    const res = await request(app).get('/api/tracking/live?noradIds=25544');
    expect(res.status).toBe(200);
    expect(res.body.frames.length).toBe(1);
    const frame = res.body.frames[0];
    expect(frame.noradId).toBe(25544);
    expect(frame.latitude).toBeDefined();
    expect(frame.longitude).toBeDefined();
    expect(frame.altitudeKm).toBeGreaterThan(200);
  });

  it('GET /api/tracking/25544/track should return orbit track points', async () => {
    const res = await request(app).get('/api/tracking/25544/track?pastOrbits=0.1&futureOrbits=0.1');
    expect(res.status).toBe(200);
    expect(res.body.noradId).toBe(25544);
    expect(res.body.points.length).toBeGreaterThan(0);
  });

  it('GET /api/passes should predict passes for ISS over default station', async () => {
    const defaultStation = await stationRepo.findDefault();
    expect(defaultStation).not.toBeNull();

    const res = await request(app).get(
      `/api/passes?noradId=25544&stationId=${defaultStation!.id}&daysAhead=2&minElevationDeg=10`,
    );
    expect(res.status).toBe(200);
    expect(res.body.noradId).toBe(25544);
    expect(res.body.stationId).toBe(defaultStation!.id);
    expect(res.body.passes).toBeDefined();
  });

  it('GET /api/passes/export?format=csv should return CSV download', async () => {
    const defaultStation = await stationRepo.findDefault();
    const res = await request(app).get(
      `/api/passes/export?noradId=25544&stationId=${defaultStation!.id}&format=csv`,
    );
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Satellite,NORAD ID');
  });

  it('GET /api/radio/25544/transponders should return transponder list with Doppler calculations', async () => {
    const res = await request(app).get('/api/radio/25544/transponders');
    expect(res.status).toBe(200);
    expect(res.body.noradId).toBe(25544);
    expect(res.body.transponders.length).toBeGreaterThan(0);
  });

  it('Time API: GET /api/time and POST /api/time/action', async () => {
    const getRes = await request(app).get('/api/time');
    expect(getRes.status).toBe(200);
    expect(getRes.body.mode).toBe('realtime');

    const actRes = await request(app)
      .post('/api/time/action')
      .send({ type: 'SET_SPEED', payload: 5 });
    expect(actRes.status).toBe(200);
    expect(actRes.body.speedMultiplier).toBe(5);
  });
});
