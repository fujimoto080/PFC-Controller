import 'server-only';

import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    if (!databaseUrl) {
      throw new Error('DATABASE_URL が未設定です');
    }
    pool = new Pool({ connectionString: databaseUrl });
  }
  return pool;
}
