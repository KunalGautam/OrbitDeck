import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Satellites Table
  await db.schema
    .createTable('satellites')
    .ifNotExists()
    .addColumn('norad_id', 'integer', (col) => col.primaryKey())
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('line1', 'varchar(255)', (col) => col.notNull())
    .addColumn('line2', 'varchar(255)', (col) => col.notNull())
    .addColumn('groups', 'text', (col) => col.notNull())
    .addColumn('updated_at', 'varchar(64)', (col) => col.notNull())
    .addColumn('is_favorite', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('intl_des', 'varchar(64)')
    .addColumn('epoch_year', 'integer')
    .addColumn('epoch_day', 'real')
    .addColumn('inclination_deg', 'real')
    .addColumn('period_minutes', 'real')
    .execute();

  await db.schema
    .createIndex('idx_satellites_fav')
    .ifNotExists()
    .on('satellites')
    .column('is_favorite')
    .execute();

  await db.schema
    .createIndex('idx_satellites_updated')
    .ifNotExists()
    .on('satellites')
    .column('updated_at')
    .execute();

  // Ground Stations Table
  await db.schema
    .createTable('ground_stations')
    .ifNotExists()
    .addColumn('id', 'varchar(64)', (col) => col.primaryKey())
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('latitude', 'real', (col) => col.notNull())
    .addColumn('longitude', 'real', (col) => col.notNull())
    .addColumn('altitude', 'real', (col) => col.notNull().defaultTo(0))
    .addColumn('maidenhead', 'varchar(16)', (col) => col.notNull())
    .addColumn('is_default', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('created_at', 'varchar(64)', (col) => col.notNull())
    .addColumn('updated_at', 'varchar(64)', (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex('idx_ground_stations_default')
    .ifNotExists()
    .on('ground_stations')
    .column('is_default')
    .execute();

  // Custom Groups Table
  await db.schema
    .createTable('custom_groups')
    .ifNotExists()
    .addColumn('id', 'varchar(64)', (col) => col.primaryKey())
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('satellite_ids', 'text', (col) => col.notNull())
    .addColumn('created_at', 'varchar(64)', (col) => col.notNull())
    .execute();

  // Settings Table
  await db.schema
    .createTable('settings')
    .ifNotExists()
    .addColumn('key', 'varchar(128)', (col) => col.primaryKey())
    .addColumn('value', 'text', (col) => col.notNull())
    .addColumn('updated_at', 'varchar(64)', (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('settings').ifExists().execute();
  await db.schema.dropTable('custom_groups').ifExists().execute();
  await db.schema.dropTable('ground_stations').ifExists().execute();
  await db.schema.dropTable('satellites').ifExists().execute();
}
