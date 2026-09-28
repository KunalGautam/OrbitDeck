import { createRequire } from 'node:module';
import {
  type CompiledQuery,
  type DatabaseConnection,
  type DatabaseIntrospector,
  type Dialect,
  type DialectAdapter,
  type Driver,
  type Kysely,
  type QueryCompiler,
  type QueryResult,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  type TransactionSettings,
} from 'kysely';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite');

export interface NodeSqliteDialectConfig {
  database: any;
}

export class NodeSqliteDialect implements Dialect {
  readonly #config: NodeSqliteDialectConfig;

  constructor(config: NodeSqliteDialectConfig) {
    this.#config = config;
  }

  createDriver(): Driver {
    return new NodeSqliteDriver(this.#config.database);
  }

  createQueryCompiler(): QueryCompiler {
    return new SqliteQueryCompiler();
  }

  createAdapter(): DialectAdapter {
    return new SqliteAdapter();
  }

  createIntrospector(db: Kysely<any>): DatabaseIntrospector {
    return new SqliteIntrospector(db);
  }
}

class NodeSqliteDriver implements Driver {
  readonly #database: any;
  readonly #connection: DatabaseConnection;

  constructor(database: any) {
    this.#database = database;
    this.#connection = new NodeSqliteConnection(database);
  }

  async init(): Promise<void> {}

  async acquireConnection(): Promise<DatabaseConnection> {
    return this.#connection;
  }

  async releaseConnection(): Promise<void> {}

  async destroy(): Promise<void> {
    try {
      this.#database.close();
    } catch {
      // ignore
    }
  }

  async beginTransaction(
    connection: DatabaseConnection,
    _settings: TransactionSettings,
  ): Promise<void> {
    await connection.executeQuery({
      sql: 'begin',
      parameters: [],
      query: { kind: 'RawNode' } as any,
    });
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery({
      sql: 'commit',
      parameters: [],
      query: { kind: 'RawNode' } as any,
    });
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery({
      sql: 'rollback',
      parameters: [],
      query: { kind: 'RawNode' } as any,
    });
  }
}

class NodeSqliteConnection implements DatabaseConnection {
  readonly #database: any;

  constructor(database: any) {
    this.#database = database;
  }

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const stmt = this.#database.prepare(compiledQuery.sql);
    const sql = compiledQuery.sql.trim().toLowerCase();

    const isSelect =
      sql.startsWith('select') || sql.startsWith('pragma') || sql.includes(' returning ');

    if (isSelect) {
      const rows = stmt.all(...(compiledQuery.parameters as any[])) as R[];
      return {
        rows,
      };
    }

    const info = stmt.run(...(compiledQuery.parameters as any[]));
    return {
      numAffectedRows: BigInt(info.changes),
      insertId: BigInt(info.lastInsertRowid),
      rows: [],
    };
  }

  // eslint-disable-next-line require-yield
  async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    yield* [];
    throw new Error('Streaming is not supported by NodeSqliteDialect');
  }
}
export { DatabaseSync };
