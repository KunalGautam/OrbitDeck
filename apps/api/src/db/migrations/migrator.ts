import { type Kysely, type Migration, type MigrationProvider, Migrator } from 'kysely';
import * as initialSchema from './001_initial_schema.js';
import * as protectedStationsSchema from './002_add_protected_stations.js';

class InMemoryMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return {
      '001_initial_schema': initialSchema,
      '002_add_protected_stations': protectedStationsSchema,
    };
  }
}

export async function runMigrations(
  db: Kysely<any>,
): Promise<{ error?: unknown; results?: any[] }> {
  const migrator = new Migrator({
    db,
    provider: new InMemoryMigrationProvider(),
  });

  const { error, results } = await migrator.migrateToLatest();

  if (error) {
    console.error('Migration failed:', error);
    return { error, results };
  }

  return { results };
}

export async function rollbackMigrations(
  db: Kysely<any>,
): Promise<{ error?: unknown; results?: any[] }> {
  const migrator = new Migrator({
    db,
    provider: new InMemoryMigrationProvider(),
  });

  const { error, results } = await migrator.migrateDown();
  return { error, results };
}
