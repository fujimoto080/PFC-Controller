import 'server-only';

import { deleteUserRow, getPool } from '@/lib/server/db';
import {
  FOOD_COLUMNS,
  foodValues,
  toFoodItem,
  type FoodRow,
} from '@/lib/server/food-row';
import type { FoodItem, FoodItemInput } from '@/lib/types';

const COLUMNS = `food_id AS id, ${FOOD_COLUMNS}`;

const UPSERT_SET = `
  name = EXCLUDED.name,
  protein = EXCLUDED.protein,
  fat = EXCLUDED.fat,
  carbs = EXCLUDED.carbs,
  calories = EXCLUDED.calories,
  timestamp_ms = EXCLUDED.timestamp_ms,
  store = EXCLUDED.store,
  store_group = EXCLUDED.store_group,
  image = EXCLUDED.image`;

export async function listFoods(userId: string): Promise<FoodItem[]> {
  const result = await getPool().query<FoodRow>(
    `SELECT ${COLUMNS} FROM pfc_foods WHERE user_id = $1 ORDER BY position ASC`,
    [userId],
  );
  return result.rows.map(toFoodItem);
}

/**
 * 食品辞書の1件を upsert する。
 * - 新規行は position を末尾（既存最大 +1）に採番する。
 * - 既存行は position を維持したままフィールドのみ更新する。
 */
export async function upsertFood(
  userId: string,
  id: string,
  input: FoodItemInput,
): Promise<FoodItem> {
  const result = await getPool().query<FoodRow>(
    `INSERT INTO pfc_foods (user_id, food_id, position, ${FOOD_COLUMNS})
     VALUES (
       $1, $2,
       COALESCE((SELECT MAX(position) + 1 FROM pfc_foods WHERE user_id = $1), 0),
       $3, $4, $5, $6, $7, $8, $9, $10, $11
     )
     ON CONFLICT (user_id, food_id) DO UPDATE SET ${UPSERT_SET}
     RETURNING ${COLUMNS}`,
    [userId, id, ...foodValues(input)],
  );
  const row = result.rows[0];
  if (!row) throw new Error('食品の登録に失敗しました');
  return toFoodItem(row);
}

/**
 * 食品辞書を複数件まとめて upsert する（seed / 一括インポート用）。
 * position の採番と更新規則は upsertFood と同じ。1 クエリで処理する。
 * 返り値は挿入 or 更新された行数。
 */
export async function upsertFoodsBulk(
  userId: string,
  items: FoodItem[],
): Promise<number> {
  const result = await getPool().query(
    `WITH base AS (
       SELECT COALESCE(MAX(position) + 1, 0) AS start FROM pfc_foods WHERE user_id = $1
     ),
     input AS (
       SELECT * FROM unnest(
         $2::text[], $3::text[], $4::float8[], $5::float8[], $6::float8[],
         $7::float8[], $8::int8[], $9::text[], $10::text[], $11::text[]
       ) WITH ORDINALITY AS t(food_id, ${FOOD_COLUMNS}, ord)
     )
     INSERT INTO pfc_foods (user_id, food_id, position, ${FOOD_COLUMNS})
     SELECT $1, i.food_id, base.start + (i.ord - 1),
            i.name, i.protein, i.fat, i.carbs, i.calories, i.timestamp_ms, i.store, i.store_group, i.image
     FROM input i CROSS JOIN base
     ON CONFLICT (user_id, food_id) DO UPDATE SET ${UPSERT_SET}`,
    [
      userId,
      items.map((i) => i.id),
      items.map((i) => i.name),
      items.map((i) => i.protein),
      items.map((i) => i.fat),
      items.map((i) => i.carbs),
      items.map((i) => i.calories),
      items.map((i) => i.timestamp),
      items.map((i) => i.store ?? null),
      items.map((i) => i.storeGroup ?? null),
      items.map((i) => i.image ?? null),
    ],
  );
  return result.rowCount ?? 0;
}

export function deleteFood(userId: string, id: string): Promise<boolean> {
  return deleteUserRow('pfc_foods', 'food_id', userId, id);
}
