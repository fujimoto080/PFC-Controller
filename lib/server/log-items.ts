import 'server-only';

import { deleteUserRow, getPool } from '@/lib/server/db';
import {
  FOOD_COLUMNS,
  foodValues,
  toFoodItem,
  type FoodRow,
} from '@/lib/server/food-row';
import type { FoodItem, FoodItemInput } from '@/lib/types';
import { formatDate } from '@/lib/utils';

const RETURNING = `id, ${FOOD_COLUMNS}`;

/** 起動時ペイロード用。image はどの画面でも描画していないため取得しない。 */
export async function listLogItems(
  userId: string,
): Promise<(FoodItem & { date: string })[]> {
  const result = await getPool().query<FoodRow & { date: string }>(
    `SELECT id, to_char(date, 'YYYY-MM-DD') AS date, name, protein, fat, carbs, calories,
            timestamp_ms, store, store_group
     FROM pfc_log_items
     WHERE user_id = $1
     ORDER BY timestamp_ms ASC`,
    [userId],
  );
  return result.rows.map((row) => ({ ...toFoodItem(row), date: row.date }));
}

export async function createLogItem(
  userId: string,
  input: FoodItemInput,
): Promise<FoodItem> {
  const result = await getPool().query<FoodRow>(
    `INSERT INTO pfc_log_items (user_id, date, ${FOOD_COLUMNS})
     VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING ${RETURNING}`,
    [userId, formatDate(input.timestamp), ...foodValues(input)],
  );
  const row = result.rows[0];
  if (!row) throw new Error('ログの登録に失敗しました');
  return toFoodItem(row);
}

export async function updateLogItem(
  userId: string,
  id: string,
  input: FoodItemInput,
): Promise<FoodItem | null> {
  const result = await getPool().query<FoodRow>(
    `UPDATE pfc_log_items
     SET date = $3::date, (${FOOD_COLUMNS}) = ($4, $5, $6, $7, $8, $9, $10, $11, $12)
     WHERE user_id = $1 AND id = $2
     RETURNING ${RETURNING}`,
    [userId, id, formatDate(input.timestamp), ...foodValues(input)],
  );
  const row = result.rows[0];
  return row ? toFoodItem(row) : null;
}

export function deleteLogItem(userId: string, id: string): Promise<boolean> {
  return deleteUserRow('pfc_log_items', 'id', userId, id);
}
