import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Satellite } from '@orbitdeck/shared';
import {
  createDatabaseConnection,
  runMigrations,
  seedDatabase,
  SatelliteRepository,
  GroundStationRepository,
  SettingsRepository,
} from './index.js';
import type { Database as DatabaseSchema } from './types.js';
import type { Kysely } from 'kysely';

describe('Database Layer & Repositories', () => {
  let db: Kysely<DatabaseSchema>;
  let satRepo: SatelliteRepository;
  let stationRepo: GroundStationRepository;
  let settingsRepo: SettingsRepository;

  beforeEach(async () => {
    // In-memory SQLite for testing
    db = createDatabaseConnection({ isTest: true });
    await runMigrations(db);
    satRepo = new SatelliteRepository(db);
    stationRepo = new GroundStationRepository(db);
    settingsRepo = new SettingsRepository(db);
  });

  afterEach(async () => {
    await db.destroy();
  });

  describe('Migrations & Seed', () => {
    it('should run migrations without error and seed initial stations', async () => {
      await seedDatabase(db);
      const stations = await stationRepo.findAll();
      expect(stations.length).toBe(3);
      expect(stations[0]!.isDefault).toBe(true);

      const defaultProvider = await settingsRepo.get('map.default_provider');
      expect(defaultProvider).toBe('leaflet');
    });
  });

  describe('SatelliteRepository', () => {
    const mockSats: Satellite[] = [
      {
        noradId: 25544,
        name: 'ISS (ZARYA)',
        line1: '1 25544U 98067A   24001.00000000  .00016717  00000-0  10270-3 0  9001',
        line2: '2 25544  51.6400 208.1000 0004000  60.0000 300.0000 15.49800000432101',
        groups: ['stations', 'amateur'],
        updatedAt: '2026-09-28T00:00:00Z',
        isFavorite: false,
      },
      {
        noradId: 20580,
        name: 'HUBBLE SPACE TELESCOPE',
        line1: '1 20580U 90037B   24001.00000000  .00001000  00000-0  10000-4 0  9002',
        line2: '2 20580  28.4700 150.0000 0003000  50.0000 310.0000 15.09000000123456',
        groups: ['science'],
        updatedAt: '2026-09-28T00:00:00Z',
        isFavorite: false,
      },
    ];

    it('should upsert satellites and find by id', async () => {
      await satRepo.upsertMany(mockSats);

      const iss = await satRepo.findById(25544);
      expect(iss).not.toBeNull();
      expect(iss?.name).toBe('ISS (ZARYA)');
      expect(iss?.groups).toContain('stations');
      expect(iss?.groups).toContain('amateur');
      expect(iss?.isFavorite).toBe(false);
    });

    it('should filter satellites by name query and group', async () => {
      await satRepo.upsertMany(mockSats);

      // Query by text
      const searchRes = await satRepo.findAll({ query: 'hubble' });
      expect(searchRes.total).toBe(1);
      expect(searchRes.satellites[0]?.noradId).toBe(20580);

      // Query by NORAD ID
      const idRes = await satRepo.findAll({ query: '25544' });
      expect(idRes.total).toBe(1);
      expect(idRes.satellites[0]?.name).toBe('ISS (ZARYA)');

      // Query by group
      const grpRes = await satRepo.findAll({ groups: ['stations'] });
      expect(grpRes.total).toBe(1);
      expect(grpRes.satellites[0]?.noradId).toBe(25544);
    });

    it('should toggle favorite status', async () => {
      await satRepo.upsertMany(mockSats);

      const toggled = await satRepo.toggleFavorite(25544, true);
      expect(toggled).toBe(true);

      const iss = await satRepo.findById(25544);
      expect(iss?.isFavorite).toBe(true);

      const favs = await satRepo.findAll({ favoriteOnly: true });
      expect(favs.total).toBe(1);
      expect(favs.satellites[0]?.noradId).toBe(25544);
    });
  });

  describe('GroundStationRepository', () => {
    it('should create station and auto-calculate Maidenhead if omitted', async () => {
      const station = await stationRepo.create({
        name: 'Test QTH',
        latitude: 41.729,
        longitude: -72.687,
        altitude: 10,
        maidenhead: '',
      });

      expect(station.id).toBeDefined();
      expect(station.maidenhead.toUpperCase()).toBe('FN31PR');
      expect(station.isDefault).toBe(true); // First station created is automatically default
    });

    it('should handle setting default station properly', async () => {
      const s1 = await stationRepo.create({
        name: 'Station 1',
        latitude: 10,
        longitude: 10,
        altitude: 0,
        maidenhead: 'JJ00aa',
      });
      const s2 = await stationRepo.create({
        name: 'Station 2',
        latitude: 20,
        longitude: 20,
        altitude: 0,
        maidenhead: 'KK00aa',
      });

      expect(s1.isDefault).toBe(true);
      expect(s2.isDefault).toBe(false);

      await stationRepo.setDefault(s2.id);

      const updatedS1 = await stationRepo.findById(s1.id);
      const updatedS2 = await stationRepo.findById(s2.id);
      expect(updatedS1?.isDefault).toBe(false);
      expect(updatedS2?.isDefault).toBe(true);

      const defaultStation = await stationRepo.findDefault();
      expect(defaultStation?.id).toBe(s2.id);
    });

    it('should update and delete stations', async () => {
      const s = await stationRepo.create({
        name: 'Temporary QTH',
        latitude: 50,
        longitude: 10,
        altitude: 100,
        maidenhead: 'JN50aa',
      });

      const updated = await stationRepo.update(s.id, { name: 'Renamed QTH' });
      expect(updated?.name).toBe('Renamed QTH');

      const deleted = await stationRepo.delete(s.id);
      expect(deleted).toBe(true);

      const found = await stationRepo.findById(s.id);
      expect(found).toBeNull();
    });
  });

  describe('SettingsRepository', () => {
    it('should set, get, and overwrite configuration settings', async () => {
      await settingsRepo.set('ui.theme', 'dark');
      const theme = await settingsRepo.get<string>('ui.theme');
      expect(theme).toBe('dark');

      await settingsRepo.set('ui.theme', 'light');
      const updatedTheme = await settingsRepo.get<string>('ui.theme');
      expect(updatedTheme).toBe('light');

      await settingsRepo.set('tracking.complex_obj', { refreshSec: 5, enabled: true });
      const obj = await settingsRepo.get<{ refreshSec: number; enabled: boolean }>(
        'tracking.complex_obj',
      );
      expect(obj?.refreshSec).toBe(5);
      expect(obj?.enabled).toBe(true);
    });
  });
});
