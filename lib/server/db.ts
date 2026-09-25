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
