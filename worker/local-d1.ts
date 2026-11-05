import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';

export function createLocalD1Database(dbFilePath = ':memory:') {
  const sqlite = new DatabaseSync(dbFilePath);

  // Initialize schema if memory or new file
  const schemaPath = path.resolve(process.cwd(), 'migrations/0001_initial_schema.sql');
  const seedPath = path.resolve(process.cwd(), 'migrations/0002_seed_data.sql');

  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    sqlite.exec(schemaSql);
  }
  if (fs.existsSync(seedPath)) {
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    sqlite.exec(seedSql);
  }

  const d1Mock: any = {
    prepare(query: string) {
      return {
        _params: [] as any[],
        bind(...params: any[]) {
          this._params = params;
          return this;
        },
        async all() {
          const stmt = sqlite.prepare(query);
          const results = stmt.all(...this._params);
          return { results, success: true };
        },
        async first() {
          const stmt = sqlite.prepare(query);
          const row = stmt.get(...this._params);
          return row || null;
        },
        async run() {
          const stmt = sqlite.prepare(query);
          const info = stmt.run(...this._params);
          return { success: true, meta: info };
        },
      };
    },
    async exec(sql: string) {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
  };

  return { d1: d1Mock, sqlite };
}

