import fs from 'fs';
import path from 'path';
import { Kysely, MysqlDialect, PostgresDialect } from 'kysely';
import { createPool as createMysqlPool } from 'mysql2';
import { Pool as PgPool } from 'pg';
import { DatabaseSync, NodeSqliteDialect } from './nodeSqliteDialect.js';
import type { Database as DatabaseSchema } from './types.js';

export type SupportedDriver = 'sqlite' | 'postgres' | 'mysql';

export interface DatabaseConfig {
  driver?: SupportedDriver;
  databaseUrl?: string;
  dbFile?: string;
  isTest?: boolean;
}

let activeDb: Kysely<DatabaseSchema> | null = null;
let activeSqliteInstance: any = null;
let activePgPool: PgPool | null = null;
let activeMysqlPool: ReturnType<typeof createMysqlPool> | null = null;

export function createDatabaseConnection(config: DatabaseConfig = {}): Kysely<DatabaseSchema> {
  const driver = (
    config.driver ||
    process.env.DB_DRIVER ||
    'sqlite'
  ).toLowerCase() as SupportedDriver;

  if (driver === 'postgres') {
    const connectionString = config.databaseUrl || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required when DB_DRIVER=postgres');
    }
    const pool = new PgPool({ connectionString });
    activePgPool = pool;
    return new Kysely<DatabaseSchema>({
      dialect: new PostgresDialect({ pool }),
    });
  }

  if (driver === 'mysql') {
    const connectionString = config.databaseUrl || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required when DB_DRIVER=mysql');
    }
    const pool = createMysqlPool(connectionString);
    activeMysqlPool = pool;
    return new Kysely<DatabaseSchema>({
      dialect: new MysqlDialect({ pool: pool as any }),
    });
  }

  // SQLite (default) using built-in node:sqlite
  let filePath =
    config.dbFile || process.env.DATABASE_URL || process.env.DB_FILE || './data/orbitdeck.sqlite';

  if (config.isTest || filePath === ':memory:') {
    const sqliteDb = new DatabaseSync(':memory:');
    activeSqliteInstance = sqliteDb;
    return new Kysely<DatabaseSchema>({
      dialect: new NodeSqliteDialect({ database: sqliteDb }),
    });
  }

  // If file path starts with sqlite:// or file:, strip it
  filePath = filePath.replace(/^(sqlite:\/\/|file:)/, '');
  const resolvedPath = path.resolve(process.cwd(), filePath);
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sqliteDb = new DatabaseSync(resolvedPath);
  activeSqliteInstance = sqliteDb;

  return new Kysely<DatabaseSchema>({
    dialect: new NodeSqliteDialect({ database: sqliteDb }),
  });
}

export function getDatabase(config?: DatabaseConfig): Kysely<DatabaseSchema> {
  if (!activeDb) {
    activeDb = createDatabaseConnection(config);
  }
  return activeDb;
}

export async function closeDatabase(): Promise<void> {
  if (activeDb) {
    await activeDb.destroy();
    activeDb = null;
  }
  if (activeSqliteInstance) {
    try {
      activeSqliteInstance.close();
    } catch {
      // ignore
    }
    activeSqliteInstance = null;
  }
  if (activePgPool) {
    await activePgPool.end();
    activePgPool = null;
  }
  if (activeMysqlPool) {
    await activeMysqlPool.end();
    activeMysqlPool = null;
  }
}
