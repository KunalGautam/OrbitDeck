import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  try {
    await db.schema
      .alterTable('ground_stations')
      .addColumn('is_protected', 'integer', (col) => col.notNull().defaultTo(0))
      .execute();
  } catch {
    // Column might already exist in some environments
  }
}

export async function down(_db: Kysely<any>): Promise<void> {
  // SQLite does not support dropping columns in older versions
}
