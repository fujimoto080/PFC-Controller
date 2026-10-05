import 'server-only';

import { Pool, type PoolClient } from 'pg';
import { timeQuery } from '@/lib/server/query-timing';

/** target.query を、所要時間を記録する版に置き換えた関数を返す。 */
function timedQuery<T extends Pool | PoolClient>(target: T): T['query'] {
  const original = target.query.bind(target) as (
    ...args: unknown[]
  ) => Promise<unknown>;
  return ((query: string | { text: string }, ...rest: unknown[]) =>
    timeQuery(query, () => original(query, ...rest))) as T['query'];
}

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    if (!databaseUrl) {
      throw new Error('DATABASE_URL が未設定です');
    }
    pool = new Pool({ connectionString: databaseUrl });
    pool.query = timedQuery(pool);
  }
  return pool;
}

export async function transaction(
  fn: (client: PoolClient) => Promise<void>,
): Promise<void> {
  const client = await getPool().connect();
  // プールで共有されるクライアントは書き換えず、query だけ差し替えた派生オブジェクトを渡す
  const timed = Object.assign(Object.create(client) as PoolClient, {
    query: timedQuery(client),
  });
  try {
    await timed.query('BEGIN');
    await fn(timed);
    await timed.query('COMMIT');
  } catch (error) {
    await timed.query('ROLLBACK');
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

/** ユーザー所有の 1 行を削除する。対象が無ければ false。 */
export async function deleteUserRow(
  table: 'pfc_foods' | 'pfc_log_items' | 'pfc_log_activities',
  idColumn: 'id' | 'food_id',
  userId: string,
  id: string,
): Promise<boolean> {
  const result = await getPool().query(
    `DELETE FROM ${table} WHERE user_id = $1 AND ${idColumn} = $2`,
    [userId, id],
  );
  return (result.rowCount ?? 0) > 0;
}
