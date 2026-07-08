import 'server-only';

import { getPool } from '@/lib/pg-pool';
import type { FoodItem, FoodItemInput } from '@/lib/types';

interface FoodRow {
  food_id: string;
  name: string;
  protein: number;
  fat: number;
  carbs: number;
  calories: number;
  timestamp_ms: string | number;
  store: string | null;
  store_group: string | null;
  image: string | null;
}

function rowToFoodItem(row: FoodRow): FoodItem {
  return {
    id: row.food_id,
    name: row.name,
    protein: row.protein,
    fat: row.fat,
    carbs: row.carbs,
    calories: row.calories,
    timestamp: Number(row.timestamp_ms),
    store: row.store ?? undefined,
    storeGroup: row.store_group ?? undefined,
    image: row.image ?? undefined,
  };
}

const RETURNING = `food_id, name, protein, fat, carbs, calories, timestamp_ms, store, store_group, image`;

/**
 * 食品辞書の1件を upsert する。
 * - 新規行は position を末尾（既存最大 +1）に採番する。
 * - 既存行は position を維持したままフィールドのみ更新する。
 *
 * 既定食品(generated_foods.json)はクライアント側でマージされるだけで DB には行が無いため、
 * それらを編集したときも insert 側の分岐で行が作られるよう upsert にしている。
 */
export async function upsertFood(
  userId: string,
  id: string,
  input: FoodItemInput,
): Promise<FoodItem> {
  const pool = getPool();
  const result = await pool.query<FoodRow>(
    `INSERT INTO pfc_foods
       (user_id, food_id, position, name, protein, fat, carbs, calories, timestamp_ms, store, store_group, image)
     VALUES (
       $1, $2,
       COALESCE((SELECT MAX(position) + 1 FROM pfc_foods WHERE user_id = $1), 0),
       $3, $4, $5, $6, $7, $8, $9, $10, $11
     )
     ON CONFLICT (user_id, food_id) DO UPDATE SET
       name = EXCLUDED.name,
       protein = EXCLUDED.protein,
       fat = EXCLUDED.fat,
       carbs = EXCLUDED.carbs,
       calories = EXCLUDED.calories,
       timestamp_ms = EXCLUDED.timestamp_ms,
       store = EXCLUDED.store,
       store_group = EXCLUDED.store_group,
       image = EXCLUDED.image
     RETURNING ${RETURNING}`,
    [
      userId,
      id,
      input.name,
      input.protein,
      input.fat,
      input.carbs,
      input.calories,
      input.timestamp,
      input.store ?? null,
      input.storeGroup ?? null,
      input.image ?? null,
    ],
  );
  return rowToFoodItem(result.rows[0]);
}

/**
 * 食品辞書の1件を削除する。冪等（対象が無くてもエラーにしない）。
 * 既定食品は DB 行を持たないことがあり、その削除でも 404 を返さないようにするため。
 */
export async function deleteFood(userId: string, id: string): Promise<void> {
  const pool = getPool();
  await pool.query(`DELETE FROM pfc_foods WHERE user_id = $1 AND food_id = $2`, [
    userId,
    id,
  ]);
}
