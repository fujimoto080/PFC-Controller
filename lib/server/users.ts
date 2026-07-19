import 'server-only';

import { getPool } from '@/lib/pg-pool';

/** メールアドレスからユーザー ID を引く。存在しなければ null。 */
export async function getUserIdByEmail(email: string): Promise<string | null> {
  const pool = getPool();
  const result = await pool.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email]);
  return result.rows[0]?.id ?? null;
}
