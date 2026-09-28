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

  // Seed default settings if not present
  const defaultProvider = await settingsRepo.get('map.default_provider');
  if (!defaultProvider) {
    await settingsRepo.set('map.default_provider', 'leaflet');
    await settingsRepo.set('tracking.update_interval_ms', 1000);
    await settingsRepo.set('tle.auto_refresh_enabled', true);
    await settingsRepo.set('tle.refresh_cron', '0 3 * * *'); // 3 AM daily
  }
}
