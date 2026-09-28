import {
  type CreateGroundStationInput,
  type GroundStation,
  type UpdateGroundStationInput,
  latLonToMaidenhead,
} from '@orbitdeck/shared';
import type { Kysely } from 'kysely';
import { v4 as uuidv4 } from 'uuid';
import type { Database, GroundStationTable } from '../types.js';

export interface IGroundStationRepository {
  findAll(): Promise<GroundStation[]>;
  findById(id: string): Promise<GroundStation | null>;
  findDefault(): Promise<GroundStation | null>;
  create(input: CreateGroundStationInput): Promise<GroundStation>;
  update(id: string, input: UpdateGroundStationInput): Promise<GroundStation | null>;
  delete(id: string): Promise<boolean>;
  setDefault(id: string): Promise<boolean>;
}

export class GroundStationRepository implements IGroundStationRepository {
  constructor(private readonly db: Kysely<Database>) {}

  private mapToDomain(row: GroundStationTable): GroundStation {
    const isProtected =
      row.is_protected === 1 ||
      row.maidenhead?.toUpperCase() === 'MK68XO' ||
      row.maidenhead?.toUpperCase() === 'IO93PL';

    return {
      id: row.id,
      name: row.name,
      latitude: row.latitude,
      longitude: row.longitude,
      altitude: row.altitude,
      maidenhead: row.maidenhead,
      isDefault: row.is_default === 1,
      isProtected,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findAll(): Promise<GroundStation[]> {
    const rows = await this.db
      .selectFrom('ground_stations')
      .selectAll()
      .orderBy('is_default', 'desc')
      .orderBy('name', 'asc')
      .execute();

    return rows.map((r) => this.mapToDomain(r));
  }

  async findById(id: string): Promise<GroundStation | null> {
    const row = await this.db
      .selectFrom('ground_stations')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return row ? this.mapToDomain(row) : null;
  }

  async findDefault(): Promise<GroundStation | null> {
    const row = await this.db
      .selectFrom('ground_stations')
      .selectAll()
      .where('is_default', '=', 1)
      .executeTakeFirst();

    if (row) return this.mapToDomain(row);

    // Fall back to first station if no default explicitly set
    const fallback = await this.db
      .selectFrom('ground_stations')
      .selectAll()
      .limit(1)
      .executeTakeFirst();

    return fallback ? this.mapToDomain(fallback) : null;
  }

  async create(input: CreateGroundStationInput): Promise<GroundStation> {
    const now = new Date().toISOString();
    const id = uuidv4();
    const maidenhead =
      input.maidenhead?.trim() || latLonToMaidenhead(input.latitude, input.longitude, 6);

    const countRes = await this.db
      .selectFrom('ground_stations')
      .select((eb) => eb.fn.count<number>('id').as('cnt'))
      .executeTakeFirst();
    const isFirst = Number(countRes?.cnt ?? 0) === 0;
    const shouldBeDefault = isFirst || Boolean(input.isDefault);

    if (shouldBeDefault) {
      await this.db.updateTable('ground_stations').set({ is_default: 0 }).execute();
    }

    const isProtected =
      Boolean(input.isProtected) ||
      maidenhead.toUpperCase() === 'MK68XO' ||
      maidenhead.toUpperCase() === 'IO93PL';

    const row: GroundStationTable = {
      id,
      name: input.name,
      latitude: input.latitude,
      longitude: input.longitude,
      altitude: input.altitude ?? 0,
      maidenhead,
      is_default: shouldBeDefault ? 1 : 0,
      is_protected: isProtected ? 1 : 0,
      created_at: now,
      updated_at: now,
    };

    await this.db.insertInto('ground_stations').values(row).execute();
    return this.mapToDomain(row);
  }

  async update(id: string, input: UpdateGroundStationInput): Promise<GroundStation | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const lat = input.latitude ?? existing.latitude;
    const lon = input.longitude ?? existing.longitude;
    const maidenhead = input.maidenhead?.trim() || latLonToMaidenhead(lat, lon, 6);

    if (input.isDefault) {
      await this.db.updateTable('ground_stations').set({ is_default: 0 }).execute();
    }

    await this.db
      .updateTable('ground_stations')
      .set({
        name: input.name ?? existing.name,
        latitude: lat,
        longitude: lon,
        altitude: input.altitude ?? existing.altitude,
        maidenhead,
        is_default:
          input.isDefault !== undefined ? (input.isDefault ? 1 : 0) : existing.isDefault ? 1 : 0,
        updated_at: now,
      })
      .where('id', '=', id)
      .execute();

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const target = await this.findById(id);
    if (!target) return false;

    if (
      target.isProtected ||
      target.maidenhead?.toUpperCase() === 'MK68XO' ||
      target.maidenhead?.toUpperCase() === 'IO93PL'
    ) {
      throw new Error('This ground station is protected and cannot be deleted.');
    }

    await this.db.deleteFrom('ground_stations').where('id', '=', id).executeTakeFirst();

    // If the deleted station was default, pick another one as default
    if (target.isDefault) {
      const remaining = await this.db
        .selectFrom('ground_stations')
        .select('id')
        .limit(1)
        .executeTakeFirst();

      if (remaining) {
        await this.db
          .updateTable('ground_stations')
          .set({ is_default: 1 })
          .where('id', '=', remaining.id)
          .execute();
      }
    }

    return true;
  }

  async setDefault(id: string): Promise<boolean> {
    const target = await this.findById(id);
    if (!target) return false;

    await this.db.updateTable('ground_stations').set({ is_default: 0 }).execute();

    await this.db
      .updateTable('ground_stations')
      .set({ is_default: 1 })
      .where('id', '=', id)
      .execute();

    return true;
  }
}
