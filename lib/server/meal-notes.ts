import 'server-only';

import { getPool } from '@/lib/server/db';

/** その日の予定・気分。未入力なら空文字。 */
export async function getMealNote(
  userId: string,
  date: string,
): Promise<string> {
  const result = await getPool().query<{ note: string }>(
    'SELECT note FROM pfc_meal_notes WHERE user_id = $1 AND date = $2',
    [userId, date],
  );
  return result.rows[0]?.note ?? '';
}

/** その日の予定・気分を保存する。空にしたら消す。 */
export async function saveMealNote(
  userId: string,
  date: string,
  note: string,
): Promise<void> {
  if (!note) {
    await getPool().query(
      'DELETE FROM pfc_meal_notes WHERE user_id = $1 AND date = $2',
      [userId, date],
    );
    return;
  }
  await getPool().query(
    `INSERT INTO pfc_meal_notes (user_id, date, note, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id, date) DO UPDATE SET
       note = EXCLUDED.note, updated_at = now()`,
    [userId, date, note],
  );
}
