import type { Kysely } from 'kysely';
import type { Database } from './types.js';
import { GroundStationRepository } from './repositories/stationRepository.js';
import { SettingsRepository } from './repositories/settingsRepository.js';

export async function seedDatabase(db: Kysely<Database>): Promise<void> {
  const stationRepo = new GroundStationRepository(db);
  const settingsRepo = new SettingsRepository(db);

  // Check if ground stations already exist
  const existingStations = await stationRepo.findAll();
  if (existingStations.length === 0) {
    // Seed default stations (e.g. Royal Observatory Greenwich, San Francisco, Munich)
    await stationRepo.create({
      name: 'Royal Observatory Greenwich',
      latitude: 51.4769,
      longitude: 0.0005,
      altitude: 48,
      maidenhead: 'IO91wm',
      isDefault: true,
    });

    await stationRepo.create({
      name: 'San Francisco QTH',
      latitude: 37.7749,
      longitude: -122.4194,
      altitude: 50,
      maidenhead: 'CM87ws',
      isDefault: false,
    });

    await stationRepo.create({
      name: 'Munich QTH',
      latitude: 48.1371,
      longitude: 11.5754,
      altitude: 519,
      maidenhead: 'JN58sd',
      isDefault: false,
    });
  }

  // Always ensure protected hard-coded locations exist (cannot be deleted)
  const currentStations = await stationRepo.findAll();
  const hasKunal = currentStations.some(
    (s) => s.maidenhead?.toUpperCase() === 'MK68XO' || s.name === "Kunal's Home",
  );
  if (!hasKunal) {
    await stationRepo.create({
      name: "Kunal's Home",
      latitude: 18.604167,
      longitude: 73.958333,
      altitude: 560,
      maidenhead: 'MK68XO',
      isDefault: false,
      isProtected: true,
    });
  }

  const hasMartin = currentStations.some(
    (s) => s.maidenhead?.toUpperCase() === 'IO93PL' || s.name === "Martin's Home",
  );
  if (!hasMartin) {
    await stationRepo.create({
      name: "Martin's Home",
      latitude: 53.479167,
      longitude: -0.708333,
      altitude: 30,
      maidenhead: 'IO93PL',
      isDefault: false,
      isProtected: true,
    });
  }

  // Seed default settings if not present
  const defaultProvider = await settingsRepo.get('map.default_provider');
  if (!defaultProvider) {
    await settingsRepo.set('map.default_provider', 'leaflet');
    await settingsRepo.set('tracking.update_interval_ms', 1000);
    await settingsRepo.set('tle.auto_refresh_enabled', true);
    await settingsRepo.set('tle.refresh_cron', '0 3 * * *'); // 3 AM daily
  }
}
