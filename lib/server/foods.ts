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
  const row = result.rows[0];
  if (!row) throw new Error('食品の登録に失敗しました');
  return rowToFoodItem(row);
}

/**
 * 食品辞書を複数件まとめて upsert する（seed / 一括インポート用）。
 * upsertFood と同じ規則:
 * - 新規行は position を末尾（既存最大 +1）から採番する。
 * - 既存行（food_id 重複）は position を維持したままフィールドのみ更新する。
 * 1 クエリで処理するため、多数件でも往復は 1 回で済む。
 * 返り値は挿入 or 更新された行数。
 */
export async function upsertFoodsBulk(
  userId: string,
  items: (FoodItemInput & { id: string })[],
): Promise<number> {
  if (items.length === 0) return 0;
  const pool = getPool();
  const result = await pool.query(
    `WITH base AS (
       SELECT COALESCE(MAX(position) + 1, 0) AS start FROM pfc_foods WHERE user_id = $1
     ),
     input AS (
       SELECT * FROM unnest(
         $2::text[], $3::text[], $4::float8[], $5::float8[], $6::float8[],
         $7::float8[], $8::int8[], $9::text[], $10::text[], $11::text[]
       ) WITH ORDINALITY AS t(
         food_id, name, protein, fat, carbs, calories, timestamp_ms, store, store_group, image, ord
       )
     )
     INSERT INTO pfc_foods
       (user_id, food_id, position, name, protein, fat, carbs, calories, timestamp_ms, store, store_group, image)
     SELECT $1, i.food_id, base.start + (i.ord - 1),
            i.name, i.protein, i.fat, i.carbs, i.calories, i.timestamp_ms, i.store, i.store_group, i.image
     FROM input i CROSS JOIN base
     ON CONFLICT (user_id, food_id) DO UPDATE SET
       name = EXCLUDED.name,
       protein = EXCLUDED.protein,
       fat = EXCLUDED.fat,
       carbs = EXCLUDED.carbs,
       calories = EXCLUDED.calories,
       timestamp_ms = EXCLUDED.timestamp_ms,
       store = EXCLUDED.store,
       store_group = EXCLUDED.store_group,
       image = EXCLUDED.image`,
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
