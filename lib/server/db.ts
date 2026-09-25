import 'server-only';

import { Pool, type PoolClient } from 'pg';

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

export async function transaction(
  fn: (client: PoolClient) => Promise<void>,
): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await fn(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** メールアドレスからユーザー ID を引く。存在しなければ null。 */
export async function getUserIdByEmail(email: string): Promise<string | null> {
  const result = await getPool().query<{ id: string }>(
    'SELECT id FROM users WHERE email = $1',
    [email],
  );
  return result.rows[0]?.id ?? null;
}
