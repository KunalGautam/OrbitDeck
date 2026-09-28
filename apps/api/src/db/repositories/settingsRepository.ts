import type { Kysely } from 'kysely';
import type { Database } from '../types.js';

export interface ISettingsRepository {
  get<T>(key: string, defaultValue?: T): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  getAll(): Promise<Record<string, unknown>>;
  delete(key: string): Promise<boolean>;
}

export class SettingsRepository implements ISettingsRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async get<T>(key: string, defaultValue?: T): Promise<T | null> {
    const row = await this.db
      .selectFrom('settings')
      .selectAll()
      .where('key', '=', key)
      .executeTakeFirst();

    if (!row) {
      return defaultValue !== undefined ? defaultValue : null;
    }

    try {
      return JSON.parse(row.value) as T;
    } catch {
      return row.value as unknown as T;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    const now = new Date().toISOString();
    const serialized = JSON.stringify(value);

    await this.db
      .insertInto('settings')
      .values({
        key,
        value: serialized,
        updated_at: now,
      })
      .onConflict((oc) =>
        oc.column('key').doUpdateSet({
          value: serialized,
          updated_at: now,
        }),
      )
      .execute();
  }

  async getAll(): Promise<Record<string, unknown>> {
    const rows = await this.db.selectFrom('settings').selectAll().execute();
    const result: Record<string, unknown> = {};

    for (const row of rows) {
      try {
        result[row.key] = JSON.parse(row.value);
      } catch {
        result[row.key] = row.value;
      }
    }

    return result;
  }

  async delete(key: string): Promise<boolean> {
    const res = await this.db.deleteFrom('settings').where('key', '=', key).executeTakeFirst();
    return Number(res.numDeletedRows) > 0;
  }
}
