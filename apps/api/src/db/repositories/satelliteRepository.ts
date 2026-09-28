import type { Satellite, SatelliteFilter } from '@orbitdeck/shared';
import type { Kysely } from 'kysely';
import type { Database, SatelliteTable } from '../types.js';

export interface ISatelliteRepository {
  upsertMany(satellites: Satellite[]): Promise<void>;
  findById(noradId: number): Promise<Satellite | null>;
  findAll(filter?: SatelliteFilter & { limit?: number; offset?: number }): Promise<{
    satellites: Satellite[];
    total: number;
  }>;
  toggleFavorite(noradId: number, isFavorite: boolean): Promise<boolean>;
  delete(noradId: number): Promise<boolean>;
  count(): Promise<number>;
  getAllActive(): Promise<Satellite[]>;
}

export class SatelliteRepository implements ISatelliteRepository {
  constructor(private readonly db: Kysely<Database>) {}

  private mapToDomain(row: SatelliteTable): Satellite {
    let groups: Satellite['groups'] = [];
    try {
      groups = JSON.parse(row.groups);
    } catch {
      groups = [];
    }

    return {
      noradId: row.norad_id,
      name: row.name,
      line1: row.line1,
      line2: row.line2,
      groups,
      updatedAt: row.updated_at,
      isFavorite: row.is_favorite === 1,
      intlDes: row.intl_des ?? undefined,
      epochYear: row.epoch_year ?? undefined,
      epochDay: row.epoch_day ?? undefined,
      inclinationDeg: row.inclination_deg ?? undefined,
      periodMinutes: row.period_minutes ?? undefined,
    };
  }

  async upsertMany(satellites: Satellite[]): Promise<void> {
    if (satellites.length === 0) return;

    // Chunk upserts in batches of 100 to prevent exceeding query parameter limits
    const CHUNK_SIZE = 100;
    for (let i = 0; i < satellites.length; i += CHUNK_SIZE) {
      const chunk = satellites.slice(i, i + CHUNK_SIZE);
      const rows = chunk.map((sat) => ({
        norad_id: sat.noradId,
        name: sat.name,
        line1: sat.line1,
        line2: sat.line2,
        groups: JSON.stringify(sat.groups),
        updated_at: sat.updatedAt,
        is_favorite: sat.isFavorite ? 1 : 0,
        intl_des: sat.intlDes ?? null,
        epoch_year: sat.epochYear ?? null,
        epoch_day: sat.epochDay ?? null,
        inclination_deg: sat.inclinationDeg ?? null,
        period_minutes: sat.periodMinutes ?? null,
      }));

      // Kysely cross-dialect upsert
      await this.db
        .insertInto('satellites')
        .values(rows)
        .onConflict((oc) =>
          oc.column('norad_id').doUpdateSet((eb) => ({
            name: eb.ref('excluded.name'),
            line1: eb.ref('excluded.line1'),
            line2: eb.ref('excluded.line2'),
            groups: eb.ref('excluded.groups'),
            updated_at: eb.ref('excluded.updated_at'),
            intl_des: eb.ref('excluded.intl_des'),
            epoch_year: eb.ref('excluded.epoch_year'),
            epoch_day: eb.ref('excluded.epoch_day'),
            inclination_deg: eb.ref('excluded.inclination_deg'),
            period_minutes: eb.ref('excluded.period_minutes'),
          })),
        )
        .execute();
    }
  }

  async findById(noradId: number): Promise<Satellite | null> {
    const row = await this.db
      .selectFrom('satellites')
      .selectAll()
      .where('norad_id', '=', noradId)
      .executeTakeFirst();

    return row ? this.mapToDomain(row) : null;
  }

  async findAll(
    filter?: SatelliteFilter & { limit?: number; offset?: number },
  ): Promise<{ satellites: Satellite[]; total: number }> {
    let query = this.db.selectFrom('satellites');

    if (filter?.query) {
      const q = `%${filter.query.trim().toLowerCase()}%`;
      const isNum = !isNaN(Number(filter.query.trim()));
      query = query.where((eb) => {
        const conditions = [eb(eb.fn('lower', ['name']), 'like', q)];
        if (isNum) {
          conditions.push(eb('norad_id', '=', Number(filter.query!.trim())));
        }
        return eb.or(conditions);
      });
    }

    if (filter?.groups && filter.groups.length > 0) {
      query = query.where((eb) => {
        const groupConds = filter.groups!.map((grp) => eb('groups', 'like', `%"${grp}"%`));
        return eb.or(groupConds);
      });
    }

    if (filter?.favoriteOnly) {
      query = query.where('is_favorite', '=', 1);
    }

    // Count total matching
    const countResult = await query
      .select((eb) => eb.fn.count<number>('norad_id').as('total'))
      .executeTakeFirst();
    const total = Number(countResult?.total ?? 0);

    const limit = filter?.limit;
    const offset = filter?.offset ?? 0;

    let queryBuilder = query.selectAll().orderBy('is_favorite', 'desc').orderBy('name', 'asc');

    if (limit !== undefined && limit > 0) {
      queryBuilder = queryBuilder.limit(limit);
    }
    if (offset > 0) {
      queryBuilder = queryBuilder.offset(offset);
    }

    const rows = await queryBuilder.execute();

    return {
      satellites: rows.map((r) => this.mapToDomain(r)),
      total,
    };
  }

  async toggleFavorite(noradId: number, isFavorite: boolean): Promise<boolean> {
    const result = await this.db
      .updateTable('satellites')
      .set({ is_favorite: isFavorite ? 1 : 0 })
      .where('norad_id', '=', noradId)
      .executeTakeFirst();

    return Number(result.numUpdatedRows) > 0;
  }

  async delete(noradId: number): Promise<boolean> {
    const result = await this.db
      .deleteFrom('satellites')
      .where('norad_id', '=', noradId)
      .executeTakeFirst();

    return Number(result.numDeletedRows) > 0;
  }

  async count(): Promise<number> {
    const res = await this.db
      .selectFrom('satellites')
      .select((eb) => eb.fn.count<number>('norad_id').as('cnt'))
      .executeTakeFirst();
    return Number(res?.cnt ?? 0);
  }

  async getAllActive(): Promise<Satellite[]> {
    const rows = await this.db
      .selectFrom('satellites')
      .selectAll()
      .orderBy('name', 'asc')
      .execute();
    return rows.map((r) => this.mapToDomain(r));
  }
}
