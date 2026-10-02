import 'server-only';

import { DEFAULT_MEAL_SPLIT } from '@/lib/meal-split';
import { getPool } from '@/lib/server/db';
import type { MealSplit } from '@/lib/types';

/** その日の朝昼晩の配分。未設定なら既定の配分。 */
export async function getMealSplit(
  userId: string,
  date: string,
): Promise<MealSplit> {
  const result = await getPool().query<{
    breakfast_end: number;
    lunch_end: number;
  }>(
    'SELECT breakfast_end, lunch_end FROM pfc_meal_splits WHERE user_id = $1 AND date = $2',
    [userId, date],
  );
  const row = result.rows[0];
  return row
    ? { breakfastEnd: row.breakfast_end, lunchEnd: row.lunch_end }
    : { ...DEFAULT_MEAL_SPLIT };
}

/** その日の朝昼晩の配分を保存する。 */
export async function saveMealSplit(
  userId: string,
  date: string,
  split: MealSplit,
): Promise<void> {
  await getPool().query(
    `INSERT INTO pfc_meal_splits (user_id, date, breakfast_end, lunch_end, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (user_id, date) DO UPDATE SET
       breakfast_end = EXCLUDED.breakfast_end,
       lunch_end = EXCLUDED.lunch_end,
       updated_at = now()`,
    [userId, date, split.breakfastEnd, split.lunchEnd],
  );
}
